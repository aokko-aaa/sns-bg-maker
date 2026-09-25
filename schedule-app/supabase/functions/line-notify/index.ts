// Supabase Edge Function: line-notify
// 毎正時(UTC)に pg_cron から叩かれ、「JSTで各ユーザーの通知時刻」の人にだけ
// 翌日ぶんの予定・やること(TODO)を LINE で送る。
//
// 必要な Secret（Supabase → Edge Functions → line-notify の環境変数）:
//   LINE_CHANNEL_ACCESS_TOKEN  … 送信用（長期のチャネルアクセストークン）
//   CRON_SECRET                … cronからの呼び出しを認証する合言葉（任意の長い文字列）
//   SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY … 全ユーザーぶんを読むため service_role（自動で入る）

import { createClient } from 'jsr:@supabase/supabase-js@2'

const LINE_PUSH = 'https://api.line.me/v2/bot/message/push'
const TZ = 'Asia/Tokyo'

// JSTの now を数値で取り出す
function jstParts(d = new Date()) {
  const p = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hour12: false,
  }).formatToParts(d)
  const get = (t: string) => p.find((x) => x.type === t)?.value ?? '00'
  return {
    y: Number(get('year')),
    m: Number(get('month')),
    d: Number(get('day')),
    hour: Number(get('hour')) % 24,
  }
}

const pad = (n: number) => String(n).padStart(2, '0')

// ISO(UTC) → JSTの 'HH:mm'
function hhmmJst(iso: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(iso))
}

type Entry = {
  title: string
  kind: 'event' | 'task'
  starts_at: string
  ends_at: string
  all_day: boolean
  progress: number | null
}

function buildMessage(dateLabel: string, rows: Entry[]): string | null {
  const events = rows
    .filter((e) => e.kind === 'event')
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at))
  const tasks = rows.filter(
    (e) => e.kind === 'task' && (e.progress ?? 0) < 100
  )
  if (events.length === 0 && tasks.length === 0) return null

  const lines: string[] = [`🌷 明日（${dateLabel}）の予定とやること`]
  if (events.length > 0) {
    lines.push('', '■ 予定')
    for (const e of events) {
      const when = e.all_day
        ? '終日'
        : e.ends_at === e.starts_at
          ? `${hhmmJst(e.starts_at)}〜`
          : `${hhmmJst(e.starts_at)}〜${hhmmJst(e.ends_at)}`
      lines.push(`・${when} ${e.title}`)
    }
  }
  if (tasks.length > 0) {
    lines.push('', '■ やること（TODO）')
    for (const t of tasks) lines.push(`☐ ${t.title}`)
  }
  return lines.join('\n')
}

async function push(to: string, text: string, token: string): Promise<boolean> {
  const res = await fetch(LINE_PUSH, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ to, messages: [{ type: 'text', text }] }),
  })
  return res.ok
}

Deno.serve(async (req) => {
  // cron 認証
  const cronSecret = Deno.env.get('CRON_SECRET') ?? ''
  if (req.headers.get('x-cron-secret') !== cronSecret) {
    return new Response('forbidden', { status: 403 })
  }
  const token = Deno.env.get('LINE_CHANNEL_ACCESS_TOKEN') ?? ''
  if (!token) return new Response('no token', { status: 500 })

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const now = jstParts()
  // 「明日」のJST日付
  const tomorrow = new Date(Date.UTC(now.y, now.m - 1, now.d) + 86400000)
  const ty = tomorrow.getUTCFullYear()
  const tm = tomorrow.getUTCMonth() + 1
  const td = tomorrow.getUTCDate()
  const dateLabel = `${tm}/${td}`
  // 明日の [00:00, 翌00:00) を JST基準で UTC instant に
  const startIso = new Date(`${ty}-${pad(tm)}-${pad(td)}T00:00:00+09:00`).toISOString()
  const endIso = new Date(new Date(startIso).getTime() + 86400000).toISOString()

  // いまが通知時刻(JST hour一致)で、連携済み・ONの人だけ
  const { data: links, error } = await admin
    .from('line_links')
    .select('user_id, line_user_id')
    .eq('enabled', true)
    .eq('notify_hour', now.hour)
    .not('line_user_id', 'is', null)
  if (error) return new Response(error.message, { status: 500 })

  let sent = 0
  for (const link of links ?? []) {
    const { data: rows } = await admin
      .from('entries')
      .select('title, kind, starts_at, ends_at, all_day, progress')
      .eq('user_id', link.user_id)
      .lt('starts_at', endIso)
      .gt('ends_at', startIso)
    const msg = buildMessage(dateLabel, (rows ?? []) as Entry[])
    if (!msg) continue // 明日ぶんが無ければ送らない
    if (await push(link.line_user_id as string, msg, token)) sent++
  }

  return new Response(JSON.stringify({ ok: true, hour: now.hour, sent }), {
    headers: { 'content-type': 'application/json' },
  })
})
