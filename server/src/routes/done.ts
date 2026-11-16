import { Hono } from 'hono'
import type { Env, Vars } from '../types'
import { nowIso } from '../util'
import { resolveTargetUser, timingSafeEqual } from '../target'

// TODOを完了にする（それ以外の変更・削除はしない）。
// GET /api/done?token=XXX&id=YYY   （token は IMPORT_TOKEN）
// kind=task のものだけ progress=100（完了）にする。

const r = new Hono<{ Bindings: Env; Variables: Vars }>()

r.get('/', async (c) => {
  const expected = c.env.IMPORT_TOKEN ?? ''
  const given = c.req.query('token') ?? ''
  if (!expected || !timingSafeEqual(given, expected)) {
    return c.json({ error: 'unauthorized' }, 401)
  }
  const id = c.req.query('id') ?? ''
  if (!id) return c.json({ error: 'id が必要です' }, 400)

  const t0 = await resolveTargetUser(c.env)
  if (t0.error) return c.json({ error: t0.error.msg }, t0.error.status)
  const uid = t0.uid!

  const res = await c.env.DB.prepare(
    "update entries set progress=100, updated_at=? where id=? and user_id=? and kind='task'"
  )
    .bind(nowIso(), id, uid)
    .run()
  const changed = (res.meta as { changes?: number })?.changes ?? 0
  if (changed === 0) return c.json({ ok: false, error: 'TODOが見つかりません' }, 404)
  return c.json({ ok: true })
})

export default r
