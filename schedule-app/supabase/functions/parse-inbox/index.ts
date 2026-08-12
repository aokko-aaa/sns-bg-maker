// Supabase Edge Function: parse-inbox
// 受信箱のつぶやき(raw_text)を Anthropic API で解釈し、inbox_items.parsed を更新する。
//
// 設計原則 2-3: APIキーはフロントに置かず、ここ(Edge Function の Secret)で使う。
// 必要な Secret: ANTHROPIC_API_KEY
// （SUPABASE_URL / SUPABASE_ANON_KEY は Edge Function に自動で入る）

import { createClient } from 'jsr:@supabase/supabase-js@2'

const MODEL = 'claude-haiku-4-5-20251001' // 要件 6-1
const TZ = 'Asia/Tokyo'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function nowJst() {
  const fmt = new Intl.DateTimeFormat('sv-SE', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
  // sv-SE は 'YYYY-MM-DD HH:mm:ss' 形式
  const s = fmt.format(new Date()).replace(' ', 'T')
  return `${s}+09:00`
}

function weekdayJa() {
  const w = new Intl.DateTimeFormat('ja-JP', {
    timeZone: TZ,
    weekday: 'short',
  }).format(new Date())
  return w // 例: '火'
}

function buildSystemPrompt(
  categories: Array<{ id: string; name: string; group_key: string }>
) {
  const cats = categories
    .map((c) => `- ${c.name} (id: ${c.id}, group: ${c.group_key})`)
    .join('\n')
  return `あなたは日本語のスケジュール秘書です。ユーザーのつぶやきを解析し、予定/タスクに整理します。

# 現在情報（相対日付の解決に必ず使う）
- 現在日時: ${nowJst()}
- 今日の曜日: ${weekdayJa()}曜日
- タイムゾーン: Asia/Tokyo

# ユーザーのカテゴリ一覧
${cats || '(カテゴリなし)'}

# 出力ルール
- 必ず次のJSONのみを出力する。説明文やコードフェンスは書かない。
- classification: "schedule"(予定あり) | "memo"(予定でない独り言) | "unclear"(日時が特定できない)
- 1つのつぶやきに複数の予定が含まれることがある → items に複数入れる
- 時刻の指定がなければ all_day: true
- 所要時間の指定がない event は60分をデフォルトにする
- 「そのうち」「いつか」等、日時が確定できないものは classification を "unclear" にし、日時を推測で埋めない
- category_id はカテゴリ一覧から推定。判断できなければ null
- source_phrase は必ず埋める（根拠になった原文の部分）
- 日時は ISO 8601 (+09:00) で出力する

# 出力JSONスキーマ
{
  "classification": "schedule | memo | unclear",
  "items": [
    {
      "title": "string",
      "kind": "event | task",
      "starts_at": "ISO8601+09:00",
      "ends_at": "ISO8601+09:00",
      "all_day": false,
      "category_id": "string or null",
      "confidence": 0.0,
      "source_phrase": "string"
    }
  ],
  "memo": "string or null",
  "reason": "分類理由の短い説明"
}`
}

function extractJson(text: string): unknown {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start === -1 || end === -1) throw new Error('JSONが見つかりません')
  return JSON.parse(text.slice(start, end + 1))
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY が未設定です')

    const authHeader = req.headers.get('Authorization') ?? ''
    // 呼び出したユーザーのJWTでクライアントを作る → RLSで自分のデータのみ操作
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )

    const { inbox_id } = await req.json()
    if (!inbox_id) throw new Error('inbox_id が必要です')

    const { data: item, error: itemErr } = await supabase
      .from('inbox_items')
      .select('id, raw_text')
      .eq('id', inbox_id)
      .single()
    if (itemErr || !item) throw new Error('対象のつぶやきが見つかりません')

    const { data: categories } = await supabase
      .from('categories')
      .select('id, name, group_key')

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1024,
        system: buildSystemPrompt(categories ?? []),
        messages: [{ role: 'user', content: item.raw_text }],
      }),
    })

    if (!res.ok) {
      const t = await res.text()
      throw new Error(`Anthropic API エラー: ${res.status} ${t}`)
    }

    const data = await res.json()
    const text: string = data.content?.[0]?.text ?? ''
    const parsed = extractJson(text)

    const { error: updErr } = await supabase
      .from('inbox_items')
      .update({ parsed, parsed_at: new Date().toISOString() })
      .eq('id', inbox_id)
    if (updErr) throw updErr

    return new Response(JSON.stringify({ parsed }), {
      headers: { ...cors, 'content-type': 'application/json' },
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return new Response(JSON.stringify({ error: msg }), {
      status: 400,
      headers: { ...cors, 'content-type': 'application/json' },
    })
  }
})
