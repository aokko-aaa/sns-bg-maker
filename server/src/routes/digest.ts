import { Hono } from 'hono'
import type { Env, Vars } from '../types'
import { toBool } from '../util'
import { resolveTargetUser, timingSafeEqual } from '../target'

// 読み出し専用の「今日・明日ダイジェスト」。
// GET /api/digest?token=XXX  → token が DIGEST_TOKEN と一致したときだけ返す（不一致/未指定は401）。
// 書き込みは一切しない（SELECTのみ）。

const TZ = 'Asia/Tokyo'

function jstYmd(d = new Date()) {
  const p = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(d)
  const g = (t: string) => Number(p.find((x) => x.type === t)?.value ?? '0')
  return { y: g('year'), m: g('month'), d: g('day') }
}
const pad = (n: number) => String(n).padStart(2, '0')
const ymd = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`
// JSTの壁時計 HH:mm
function hhmmJst(iso: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(iso))
}
// ISOのJST日付 yyyy-MM-dd
function dateJst(iso: string): string {
  const p = jstYmd(new Date(iso))
  return ymd(p.y, p.m, p.d)
}

type Row = {
  id: string
  kind: string
  title: string
  starts_at: string
  ends_at: string
  all_day: number
  progress: number | null
  notes: string | null
}

const r = new Hono<{ Bindings: Env; Variables: Vars }>()

r.get('/', async (c) => {
  // トークン認証（ログイン不要・専用トークン）
  const expected = c.env.DIGEST_TOKEN ?? ''
  const given = c.req.query('token') ?? ''
  if (!expected || !timingSafeEqual(given, expected)) {
    return c.json({ error: 'unauthorized' }, 401)
  }

  // 対象ユーザー: 指定があればそれ、無ければ単一ユーザーを自動採用
  const t0 = await resolveTargetUser(c.env)
  if (t0.error) return c.json({ error: t0.error.msg }, t0.error.status)
  const uid = t0.uid!

  // 今日・明日（JST）の範囲
  const t = jstYmd()
  const todayStart = new Date(`${ymd(t.y, t.m, t.d)}T00:00:00+09:00`).toISOString()
  const tomorrowEnd = new Date(new Date(todayStart).getTime() + 2 * 86400000).toISOString()
  const todayDate = ymd(t.y, t.m, t.d)
  const tomDate = dateJst(new Date(new Date(todayStart).getTime() + 86400000).toISOString())

  // 今日・明日にかかる予定/タスク
  const range = await c.env.DB.prepare(
    'select id,kind,title,starts_at,ends_at,all_day,progress,notes from entries where user_id=? and starts_at<? and ends_at>?'
  )
    .bind(uid, tomorrowEnd, todayStart)
    .all<Row>()
  // 期限切れ・未完了のタスク（やり残し＝持ち越し）
  const overdue = await c.env.DB.prepare(
    "select id,kind,title,starts_at,ends_at,all_day,progress,notes from entries where user_id=? and kind='task' and (progress is null or progress<100) and ends_at<=?"
  )
    .bind(uid, todayStart)
    .all<Row>()

  const seen = new Set<string>()
  const rows: Array<Row & { overdue: boolean }> = []
  for (const e of range.results ?? []) {
    // タスクは未完了のみ。予定は全部。
    if (e.kind === 'task' && (e.progress ?? 0) >= 100) continue
    if (seen.has(e.id)) continue
    seen.add(e.id)
    rows.push({ ...e, overdue: false })
  }
  for (const e of overdue.results ?? []) {
    if (seen.has(e.id)) continue
    seen.add(e.id)
    rows.push({ ...e, overdue: true })
  }

  const items = rows
    .map((e) => {
      const allDay = toBool(e.all_day)
      const isTask = e.kind === 'task'
      const openEnded = e.ends_at === e.starts_at
      return {
        id: e.id,
        kind: e.kind,
        title: e.title,
        date: dateJst(e.starts_at),
        start: allDay || isTask ? null : hhmmJst(e.starts_at),
        end: allDay || isTask || openEnded ? null : hhmmJst(e.ends_at),
        all_day: allDay,
        done: (e.progress ?? 0) >= 100,
        overdue: e.overdue, // task の「やり残し」判定（予定は常にfalse）
        memo: isTask ? null : e.notes ?? null,
      }
    })
    .sort((a, b) => {
      if (a.date !== b.date) return a.date < b.date ? -1 : 1
      const as = a.start ?? '99:99'
      const bs = b.start ?? '99:99'
      return as < bs ? -1 : as > bs ? 1 : 0
    })

  return c.json({
    timezone: TZ,
    generated_at: new Date().toISOString(),
    range: { today: todayDate, tomorrow: tomDate },
    items,
  })
})

export default r
