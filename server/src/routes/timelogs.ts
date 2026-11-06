import { Hono } from 'hono'
import type { Env, Vars } from '../types'
import { requireAuth } from '../auth'
import { nowIso, uuid } from '../util'

const r = new Hono<{ Bindings: Env; Variables: Vars }>()
r.use('*', requireAuth)

// 計測中（ended_at が null）
r.get('/running', async (c) => {
  const { results } = await c.env.DB.prepare(
    'select * from time_logs where user_id=? and ended_at is null order by started_at asc'
  )
    .bind(c.get('uid'))
    .all()
  return c.json(results ?? [])
})

// 期間の実績（レポート用）
r.get('/', async (c) => {
  const uid = c.get('uid')
  const start = c.req.query('start')
  const end = c.req.query('end')
  let stmt
  if (start && end) {
    stmt = c.env.DB.prepare(
      'select * from time_logs where user_id=? and started_at>=? and started_at<? order by started_at asc'
    ).bind(uid, start, end)
  } else {
    stmt = c.env.DB.prepare(
      'select * from time_logs where user_id=? order by started_at desc limit 200'
    ).bind(uid)
  }
  const { results } = await stmt.all()
  return c.json(results ?? [])
})

// 計測開始
r.post('/start', async (c) => {
  const uid = c.get('uid')
  const b = await c.req.json<{ label: string; entry_id?: string | null; category_id?: string | null }>()
  const id = uuid()
  await c.env.DB.prepare(
    'insert into time_logs (id,user_id,entry_id,category_id,label,started_at,ended_at,created_at) values (?,?,?,?,?,?,?,?)'
  )
    .bind(id, uid, b.entry_id ?? null, b.category_id ?? null, b.label ?? '作業', nowIso(), null, nowIso())
    .run()
  const row = await c.env.DB.prepare('select * from time_logs where id=?').bind(id).first()
  return c.json(row)
})

// 計測停止
r.post('/:id/stop', async (c) => {
  await c.env.DB.prepare('update time_logs set ended_at=? where id=? and user_id=? and ended_at is null')
    .bind(nowIso(), c.req.param('id'), c.get('uid'))
    .run()
  return c.json({ ok: true })
})

// 1件削除（記録の修正用）
r.delete('/:id', async (c) => {
  await c.env.DB.prepare('delete from time_logs where id=? and user_id=?')
    .bind(c.req.param('id'), c.get('uid'))
    .run()
  return c.json({ ok: true })
})

export default r
