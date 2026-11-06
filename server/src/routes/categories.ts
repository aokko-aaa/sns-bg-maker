import { Hono } from 'hono'
import type { Env, Vars } from '../types'
import { requireAuth } from '../auth'
import { nowIso, uuid } from '../util'

const r = new Hono<{ Bindings: Env; Variables: Vars }>()
r.use('*', requireAuth)

// 一覧
r.get('/', async (c) => {
  const { results } = await c.env.DB.prepare(
    'select * from categories where user_id=? order by sort_order asc, created_at asc'
  )
    .bind(c.get('uid'))
    .all()
  return c.json(results ?? [])
})

// 追加 / 更新（id があれば更新）
r.post('/', async (c) => {
  const uid = c.get('uid')
  const b = await c.req.json<{
    id?: string
    name: string
    group_key: string
    color: string
    sort_order?: number
  }>()
  if (!b?.name || !b?.group_key || !b?.color) return c.json({ error: '項目が不足しています' }, 400)
  if (b.id) {
    // 自分のものだけ更新
    await c.env.DB.prepare(
      'update categories set name=?, group_key=?, color=?, sort_order=? where id=? and user_id=?'
    )
      .bind(b.name, b.group_key, b.color, b.sort_order ?? 0, b.id, uid)
      .run()
    const row = await c.env.DB.prepare('select * from categories where id=? and user_id=?')
      .bind(b.id, uid)
      .first()
    return c.json(row)
  }
  const id = uuid()
  await c.env.DB.prepare(
    'insert into categories (id,user_id,name,group_key,color,sort_order,created_at) values (?,?,?,?,?,?,?)'
  )
    .bind(id, uid, b.name, b.group_key, b.color, b.sort_order ?? 0, nowIso())
    .run()
  const row = await c.env.DB.prepare('select * from categories where id=?').bind(id).first()
  return c.json(row)
})

// 削除（?reassignTo= で、その予定を別カテゴリ/未分類へ付け替え）
r.delete('/:id', async (c) => {
  const uid = c.get('uid')
  const id = c.req.param('id')
  const reassignTo = c.req.query('reassignTo') || null
  await c.env.DB.prepare('update entries set category_id=? where category_id=? and user_id=?')
    .bind(reassignTo, id, uid)
    .run()
  await c.env.DB.prepare('delete from categories where id=? and user_id=?').bind(id, uid).run()
  return c.json({ ok: true })
})

export default r
