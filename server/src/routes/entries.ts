import { Hono } from 'hono'
import type { Env, Vars } from '../types'
import { requireAuth } from '../auth'
import { nowIso, toBool, uuid } from '../util'

const r = new Hono<{ Bindings: Env; Variables: Vars }>()
r.use('*', requireAuth)

type Row = Record<string, unknown> & { all_day: number }
const mapEntry = (row: Row) => ({ ...row, all_day: toBool(row.all_day) })

type EntryBody = {
  title: string
  category_id?: string | null
  kind?: 'event' | 'task'
  starts_at: string
  ends_at: string
  all_day?: boolean
  progress?: number | null
  notes?: string | null
  source?: string
  inbox_id?: string | null
}

// 期間 [start,end) にかかる予定（starts_at<end かつ ends_at>start）
r.get('/', async (c) => {
  const uid = c.get('uid')
  const start = c.req.query('start')
  const end = c.req.query('end')
  let stmt
  if (start && end) {
    stmt = c.env.DB.prepare(
      'select * from entries where user_id=? and starts_at<? and ends_at>? order by starts_at asc'
    ).bind(uid, end, start)
  } else {
    stmt = c.env.DB.prepare('select * from entries where user_id=? order by starts_at asc').bind(uid)
  }
  const { results } = await stmt.all<Row>()
  return c.json((results ?? []).map(mapEntry))
})

// 期限切れ・未完了のTODO（持ち越し用）: ends_at<=境界 かつ task かつ progress<100
r.get('/overdue-tasks', async (c) => {
  const before = c.req.query('before')
  if (!before) return c.json({ error: 'before が必要です' }, 400)
  const { results } = await c.env.DB.prepare(
    "select * from entries where user_id=? and kind='task' and (progress is null or progress<100) and ends_at<=? order by ends_at desc limit 50"
  )
    .bind(c.get('uid'), before)
    .all<Row>()
  return c.json((results ?? []).map(mapEntry))
})

async function insertOne(c: any, uid: string, b: EntryBody) {
  const id = uuid()
  const t = nowIso()
  await c.env.DB.prepare(
    `insert into entries
     (id,user_id,title,category_id,kind,starts_at,ends_at,all_day,progress,notes,source,inbox_id,created_at,updated_at)
     values (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
  )
    .bind(
      id,
      uid,
      b.title,
      b.category_id ?? null,
      b.kind ?? 'event',
      b.starts_at,
      b.ends_at,
      b.all_day ? 1 : 0,
      b.progress ?? 0,
      b.notes ?? null,
      b.source ?? 'manual',
      b.inbox_id ?? null,
      t,
      t
    )
    .run()
  return id
}

// 新規作成
r.post('/', async (c) => {
  const uid = c.get('uid')
  const b = await c.req.json<EntryBody>()
  if (!b?.title || !b?.starts_at || !b?.ends_at) return c.json({ error: '項目が不足しています' }, 400)
  const id = await insertOne(c, uid, b)
  const row = await c.env.DB.prepare('select * from entries where id=?').bind(id).first<Row>()
  return c.json(row ? mapEntry(row) : null)
})

// まとめて作成（複製・繰り返し・一括取り込み）
r.post('/bulk', async (c) => {
  const uid = c.get('uid')
  const b = await c.req.json<{ rows: EntryBody[] }>()
  const rows = Array.isArray(b?.rows) ? b.rows : []
  if (rows.length === 0) return c.json({ error: 'rows が空です' }, 400)
  let added = 0
  for (const row of rows) {
    if (!row?.title || !row?.starts_at || !row?.ends_at) continue
    await insertOne(c, uid, row)
    added++
  }
  return c.json({ ok: true, added })
})

// 更新
r.put('/:id', async (c) => {
  const uid = c.get('uid')
  const id = c.req.param('id')
  const b = await c.req.json<EntryBody>()
  await c.env.DB.prepare(
    `update entries set title=?, category_id=?, kind=?, starts_at=?, ends_at=?, all_day=?, progress=?, notes=?, updated_at=?
     where id=? and user_id=?`
  )
    .bind(
      b.title,
      b.category_id ?? null,
      b.kind ?? 'event',
      b.starts_at,
      b.ends_at,
      b.all_day ? 1 : 0,
      b.progress ?? 0,
      b.notes ?? null,
      nowIso(),
      id,
      uid
    )
    .run()
  const row = await c.env.DB.prepare('select * from entries where id=? and user_id=?')
    .bind(id, uid)
    .first<Row>()
  return c.json(row ? mapEntry(row) : null)
})

// 進捗/チェックリストだけ更新（TODOの完了トグル等）
r.patch('/:id', async (c) => {
  const uid = c.get('uid')
  const id = c.req.param('id')
  const b = await c.req.json<{ progress?: number; notes?: string | null }>()
  const sets: string[] = []
  const vals: unknown[] = []
  if (b.progress !== undefined) {
    sets.push('progress=?')
    vals.push(b.progress)
  }
  if (b.notes !== undefined) {
    sets.push('notes=?')
    vals.push(b.notes)
  }
  if (sets.length === 0) return c.json({ error: '更新項目がありません' }, 400)
  sets.push('updated_at=?')
  vals.push(nowIso())
  vals.push(id, uid)
  await c.env.DB.prepare(`update entries set ${sets.join(', ')} where id=? and user_id=?`)
    .bind(...vals)
    .run()
  const row = await c.env.DB.prepare('select * from entries where id=? and user_id=?')
    .bind(id, uid)
    .first<Row>()
  return c.json(row ? mapEntry(row) : null)
})

// 削除
r.delete('/:id', async (c) => {
  await c.env.DB.prepare('delete from entries where id=? and user_id=?')
    .bind(c.req.param('id'), c.get('uid'))
    .run()
  return c.json({ ok: true })
})

export default r
