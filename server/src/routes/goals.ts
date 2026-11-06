import { Hono } from 'hono'
import type { Env, Vars } from '../types'
import { requireAuth } from '../auth'
import { nowIso, uuid } from '../util'

const r = new Hono<{ Bindings: Env; Variables: Vars }>()
r.use('*', requireAuth)

// 月の目標を取得（無ければ空）
r.get('/:month', async (c) => {
  const row = await c.env.DB.prepare('select * from monthly_goals where user_id=? and month=?')
    .bind(c.get('uid'), c.req.param('month'))
    .first()
  return c.json(row ?? null)
})

// 月の目標を設定（upsert）
r.put('/:month', async (c) => {
  const uid = c.get('uid')
  const month = c.req.param('month')
  const b = await c.req.json<{ goal: string }>()
  const goal = b?.goal ?? ''
  const t = nowIso()
  const existing = await c.env.DB.prepare(
    'select id from monthly_goals where user_id=? and month=?'
  )
    .bind(uid, month)
    .first<{ id: string }>()
  if (existing) {
    await c.env.DB.prepare('update monthly_goals set goal=?, updated_at=? where id=?')
      .bind(goal, t, existing.id)
      .run()
  } else {
    await c.env.DB.prepare(
      'insert into monthly_goals (id,user_id,month,goal,created_at,updated_at) values (?,?,?,?,?,?)'
    )
      .bind(uuid(), uid, month, goal, t, t)
      .run()
  }
  const row = await c.env.DB.prepare('select * from monthly_goals where user_id=? and month=?')
    .bind(uid, month)
    .first()
  return c.json(row)
})

export default r
