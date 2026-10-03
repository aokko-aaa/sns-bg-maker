// Supabase Edge Function: import-entries
// チャット(Claude)などの外部から、合言葉トークンで予定をまとめて登録する。
// 「アプリに表示したトークン」を持つ相手だけが、その本人のカレンダーに書き込める。
//
// 必要な Secret: なし（トークン自体がDBで本人に紐づく）
//   SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY は自動で入る。
// デプロイ: supabase functions deploy import-entries --no-verify-jwt
//
// 呼び出し例:
//   POST https://<PROJECT_REF>.functions.supabase.co/import-entries
//   headers: { 'content-type':'application/json', 'x-import-token':'<TOKEN>' }
//   body: { "events": [
//     { "title":"打合せ", "starts_at":"2026-10-05T19:00:00+09:00" },
//     { "title":"歯医者", "starts_at":"2026-10-06T14:00:00+09:00", "ends_at":"2026-10-06T15:00:00+09:00" },
//     { "title":"資源ごみ", "starts_at":"2026-10-07T00:00:00+09:00", "all_day":true, "kind":"task" }
//   ] }

import { createClient } from 'jsr:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type, x-import-token',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'content-type': 'application/json' },
  })

const MAX = 100 // 1回に登録できる上限

type InEvent = {
  title?: string
  starts_at?: string
  ends_at?: string
  all_day?: boolean
  kind?: 'event' | 'task'
  category_id?: string | null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'POSTで呼んでください' }, 405)

  const token = req.headers.get('x-import-token') ?? ''
  if (!token) return json({ error: 'x-import-token が必要です' }, 401)

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  // トークン → user_id（有効なものだけ）
  const { data: link } = await admin
    .from('chat_import_tokens')
    .select('user_id, enabled')
    .eq('token', token)
    .maybeSingle()
  if (!link || !link.enabled) return json({ error: 'トークンが無効です' }, 401)

  let body: { events?: InEvent[] }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'JSONが不正です' }, 400)
  }
  const events = Array.isArray(body.events) ? body.events : []
  if (events.length === 0) return json({ error: 'events が空です' }, 400)
  if (events.length > MAX) return json({ error: `一度に登録できるのは${MAX}件までです` }, 400)

  const nowIso = new Date().toISOString()
  const rows: Record<string, unknown>[] = []
  const errors: string[] = []

  events.forEach((e, i) => {
    const title = (e.title ?? '').trim()
    if (!title) return errors.push(`#${i + 1}: title がありません`)
    if (!e.starts_at) return errors.push(`#${i + 1}: starts_at がありません`)
    const start = new Date(e.starts_at)
    if (isNaN(start.getTime())) return errors.push(`#${i + 1}: starts_at が不正です`)
    const allDay = !!e.all_day
    let end: Date
    if (e.ends_at) {
      end = new Date(e.ends_at)
      if (isNaN(end.getTime())) return errors.push(`#${i + 1}: ends_at が不正です`)
    } else {
      // 省略時: 終日は翌0:00、時刻ありは+1時間
      end = new Date(start.getTime() + (allDay ? 86400000 : 3600000))
    }
    const kind = e.kind === 'task' ? 'task' : 'event'
    rows.push({
      user_id: link.user_id,
      title,
      category_id: e.category_id ?? null,
      kind,
      starts_at: start.toISOString(),
      ends_at: end.toISOString(),
      all_day: allDay,
      progress: 0,
      notes: null,
      source: 'inbox', // 外部取り込み由来
      inbox_id: null,
      updated_at: nowIso,
    })
  })

  if (rows.length === 0) return json({ error: '登録できる予定がありません', errors }, 400)

  const { error } = await admin.from('entries').insert(rows)
  if (error) return json({ error: error.message }, 500)

  return json({ ok: true, added: rows.length, skipped: errors })
})
