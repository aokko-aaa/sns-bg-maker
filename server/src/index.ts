import { Hono } from 'hono'
import type { Env, Vars } from './types'
import authR from './routes/auth'
import categoriesR from './routes/categories'
import entriesR from './routes/entries'
import timelogsR from './routes/timelogs'
import goalsR from './routes/goals'
import inboxR from './routes/inbox'
import pushR from './routes/push'
import { sendWebPush } from './webpush'
import { toBool } from './util'

const app = new Hono<{ Bindings: Env; Variables: Vars }>()

app.get('/api/health', (c) => c.json({ ok: true, app: c.env.APP_NAME ?? 'MY SCHEDULE' }))
app.route('/api/auth', authR)
app.route('/api/categories', categoriesR)
app.route('/api/entries', entriesR)
app.route('/api/time-logs', timelogsR)
app.route('/api/goals', goalsR)
app.route('/api/inbox', inboxR)
app.route('/api/push', pushR)

// /api 以外はフロント(SPA)を配信。未知パスは index.html（not_found_handling=SPA）
app.all('*', (c) => c.env.ASSETS.fetch(c.req.raw))

// ── 毎晩のリマインド ───────────────────────────────
function jstParts(d = new Date()) {
  const p = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hour12: false,
  }).formatToParts(d)
  const g = (t: string) => Number(p.find((x) => x.type === t)?.value ?? '0')
  return { y: g('year'), m: g('month'), d: g('day'), hour: g('hour') % 24 }
}
const pad = (n: number) => String(n).padStart(2, '0')
function hhmmJst(iso: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Tokyo',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(iso))
}

type ERow = {
  title: string
  kind: string
  starts_at: string
  ends_at: string
  all_day: number
  progress: number | null
}
function buildMessage(dateLabel: string, rows: ERow[]): string | null {
  const events = rows
    .filter((e) => e.kind === 'event')
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at))
  const tasks = rows.filter((e) => e.kind === 'task' && (e.progress ?? 0) < 100)
  if (events.length === 0 && tasks.length === 0) return null
  const lines = [`明日（${dateLabel}）の予定とやること`]
  if (events.length) {
    lines.push('【予定】')
    for (const e of events) {
      const when = toBool(e.all_day)
        ? '終日'
        : e.ends_at === e.starts_at
          ? `${hhmmJst(e.starts_at)}〜`
          : `${hhmmJst(e.starts_at)}〜${hhmmJst(e.ends_at)}`
      lines.push(`・${when} ${e.title}`)
    }
  }
  if (tasks.length) {
    lines.push('【やること】')
    for (const t of tasks) lines.push(`☐ ${t.title}`)
  }
  return lines.join('\n')
}

async function runReminders(env: Env) {
  const now = jstParts()
  const tomorrow = new Date(Date.UTC(now.y, now.m - 1, now.d) + 86400000)
  const ty = tomorrow.getUTCFullYear()
  const tm = tomorrow.getUTCMonth() + 1
  const td = tomorrow.getUTCDate()
  const startIso = new Date(`${ty}-${pad(tm)}-${pad(td)}T00:00:00+09:00`).toISOString()
  const endIso = new Date(new Date(startIso).getTime() + 86400000).toISOString()
  const dateLabel = `${tm}/${td}`

  const { results: prefs } = await env.DB.prepare(
    'select user_id from reminder_prefs where enabled=1 and notify_hour=?'
  )
    .bind(now.hour)
    .all<{ user_id: string }>()

  for (const p of prefs ?? []) {
    const subs =
      (
        await env.DB.prepare(
          'select endpoint,p256dh,auth from push_subscriptions where user_id=?'
        )
          .bind(p.user_id)
          .all<{ endpoint: string; p256dh: string; auth: string }>()
      ).results ?? []
    if (subs.length === 0) continue
    const { results: rows } = await env.DB.prepare(
      'select title,kind,starts_at,ends_at,all_day,progress from entries where user_id=? and starts_at<? and ends_at>?'
    )
      .bind(p.user_id, endIso, startIso)
      .all<ERow>()
    const msg = buildMessage(dateLabel, rows ?? [])
    if (!msg) continue
    const payload = JSON.stringify({ title: 'MY SCHEDULE', body: msg, url: '/' })
    for (const s of subs) {
      try {
        await sendWebPush(env, s, payload)
      } catch {
        /* 1件の失敗で止めない */
      }
    }
  }
}

export default {
  fetch: (req: Request, env: Env, ctx: ExecutionContext) => app.fetch(req, env, ctx),
  scheduled: (_event: ScheduledController, env: Env, ctx: ExecutionContext) => {
    ctx.waitUntil(runReminders(env))
  },
}
