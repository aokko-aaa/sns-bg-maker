import { Hono } from 'hono'
import type { Env, Vars } from '../types'
import { nowIso, uuid } from '../util'
import { resolveTargetUser, timingSafeEqual } from '../target'

// 外部カレンダー（タイムツリー等）からの予定取り込み。
// POST /api/import?token=XXX  （token は IMPORT_TOKEN）
// Body:
// {
//   "source":"timetree",
//   "range":{"from":"YYYY-MM-DD","to":"YYYY-MM-DD"},
//   "calendars":["寺","家"](任意: 今回同期したカレンダー名。省略時は items から導出),
//   "items":[{"ext_id":"…","calendar":"寺","title":"…","date":"YYYY-MM-DD",
//             "start":"HH:mm"|null,"end":"HH:mm"|null,"all_day":true|false,"memo":"…"|null}]
// }
// - source+ext_id で upsert（二重に入らない）。kind=event として保存。
// - range期間内で source一致・同じ calendar の予定のうち、今回来なかったものは削除。
// - source='timetree' 以外（＝手入力 manual など）には一切触らない。

type Item = {
  ext_id?: string
  calendar?: string | null
  title?: string
  date?: string
  start?: string | null
  end?: string | null
  all_day?: boolean
  memo?: string | null
}
type Body = {
  source?: string
  range?: { from?: string; to?: string }
  calendars?: string[]
  items?: Item[]
}

// JST壁時計 → UTC ISO
const jst = (date: string, hm: string) => new Date(`${date}T${hm}:00+09:00`).toISOString()
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const HM_RE = /^\d{2}:\d{2}$/

const r = new Hono<{ Bindings: Env; Variables: Vars }>()

r.post('/', async (c) => {
  // 書き込み用トークン
  const expected = c.env.IMPORT_TOKEN ?? ''
  const given = c.req.query('token') ?? ''
  if (!expected || !timingSafeEqual(given, expected)) {
    return c.json({ error: 'unauthorized' }, 401)
  }
  const t0 = await resolveTargetUser(c.env)
  if (t0.error) return c.json({ error: t0.error.msg }, t0.error.status)
  const uid = t0.uid!

  let body: Body
  try {
    body = await c.req.json<Body>()
  } catch {
    return c.json({ error: 'invalid JSON' }, 400)
  }
  const source = (body.source ?? 'timetree').trim() || 'timetree'
  const from = body.range?.from ?? ''
  const to = body.range?.to ?? ''
  if (!DATE_RE.test(from) || !DATE_RE.test(to)) {
    return c.json({ error: 'range.from / range.to は YYYY-MM-DD で必要です' }, 400)
  }
  const items = Array.isArray(body.items) ? body.items : []
  if (items.length > 2000) return c.json({ error: '一度に取り込めるのは2000件までです' }, 400)

  let added = 0
  let updated = 0
  const keptExtIds: string[] = []
  const calSet = new Set<string>()

  for (const it of items) {
    const ext_id = (it.ext_id ?? '').trim()
    const title = (it.title ?? '').trim()
    const date = it.date ?? ''
    if (!ext_id || !title || !DATE_RE.test(date)) continue // 不正な行はスキップ
    const allDay = !!it.all_day
    const calendar = it.calendar ?? null
    if (calendar) calSet.add(calendar)

    let starts_at: string
    let ends_at: string
    if (allDay || !it.start || !HM_RE.test(it.start)) {
      starts_at = jst(date, '00:00')
      ends_at = new Date(new Date(starts_at).getTime() + 86400000).toISOString()
    } else {
      starts_at = jst(date, it.start)
      if (it.end && HM_RE.test(it.end)) {
        const e = jst(date, it.end)
        ends_at = new Date(e).getTime() > new Date(starts_at).getTime() ? e : starts_at
      } else {
        ends_at = starts_at // 終わり未定
      }
    }
    const memo = it.memo ?? null
    const t = nowIso()

    const existing = await c.env.DB.prepare(
      'select id from entries where user_id=? and source=? and ext_id=?'
    )
      .bind(uid, source, ext_id)
      .first<{ id: string }>()
    if (existing) {
      await c.env.DB.prepare(
        `update entries set title=?, calendar=?, kind='event', starts_at=?, ends_at=?, all_day=?, notes=?, updated_at=?
         where id=? and user_id=?`
      )
        .bind(title, calendar, starts_at, ends_at, allDay ? 1 : 0, memo, t, existing.id, uid)
        .run()
      updated++
    } else {
      await c.env.DB.prepare(
        `insert into entries
         (id,user_id,title,category_id,kind,starts_at,ends_at,all_day,progress,notes,source,inbox_id,ext_id,calendar,created_at,updated_at)
         values (?,?,?,?, 'event', ?,?,?,0,?,?,?,?,?,?,?)`
      )
        .bind(uuid(), uid, title, null, starts_at, ends_at, allDay ? 1 : 0, memo, source, null, ext_id, calendar, t, t)
        .run()
      added++
    }
    keptExtIds.push(ext_id)
  }

  // 削除: source一致・同じcalendar・range期間内で、今回来なかったもの。
  // 対象カレンダー = body.calendars（あれば）∪ items に出たcalendar
  const calendars = Array.from(new Set([...(body.calendars ?? []), ...calSet])).filter(Boolean)
  let removed = 0
  if (calendars.length > 0) {
    const calPh = calendars.map(() => '?').join(',')
    const keepPh = keptExtIds.length ? keptExtIds.map(() => '?').join(',') : 'null'
    const sql =
      `delete from entries where user_id=? and source=? ` +
      `and calendar in (${calPh}) ` +
      `and date(starts_at,'+9 hours') between ? and ? ` +
      `and ext_id is not null and ext_id not in (${keepPh})`
    const binds = [uid, source, ...calendars, from, to, ...keptExtIds]
    const res = await c.env.DB.prepare(sql).bind(...binds).run()
    removed = (res.meta as { changes?: number })?.changes ?? 0
  }

  return c.json({ ok: true, added, updated, removed })
})

export default r
