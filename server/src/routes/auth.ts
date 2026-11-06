import { Hono } from 'hono'
import type { Env, Vars } from '../types'
import {
  createUser,
  endSession,
  requireAuth,
  startSession,
  verifyPassword,
} from '../auth'

const r = new Hono<{ Bindings: Env; Variables: Vars }>()

r.post('/register', async (c) => {
  const { username, password } = await c.req.json<{ username?: string; password?: string }>().catch(
    () => ({ username: undefined, password: undefined })
  )
  const name = (username ?? '').trim()
  const pass = password ?? ''
  if (name.length < 3) return c.json({ error: 'ユーザー名は3文字以上にしてください' }, 400)
  if (pass.length < 6) return c.json({ error: 'パスワードは6文字以上にしてください' }, 400)
  const existing = await c.env.DB.prepare('select id from users where username=?')
    .bind(name)
    .first()
  if (existing) return c.json({ error: 'そのユーザー名は使われています' }, 409)
  const uid = await createUser(c.env, name, pass)
  await startSession(c, uid)
  return c.json({ user: { id: uid, username: name } })
})

r.post('/login', async (c) => {
  const { username, password } = await c.req.json<{ username?: string; password?: string }>().catch(
    () => ({ username: undefined, password: undefined })
  )
  const name = (username ?? '').trim()
  const pass = password ?? ''
  const u = await c.env.DB.prepare(
    'select id, username, pass_salt, pass_hash from users where username=?'
  )
    .bind(name)
    .first<{ id: string; username: string; pass_salt: string; pass_hash: string }>()
  if (!u || !(await verifyPassword(pass, u.pass_salt, u.pass_hash))) {
    return c.json({ error: 'ユーザー名かパスワードが違います' }, 401)
  }
  await startSession(c, u.id)
  return c.json({ user: { id: u.id, username: u.username } })
})

r.post('/logout', (c) => {
  endSession(c)
  return c.json({ ok: true })
})

r.get('/me', requireAuth, async (c) => {
  const u = await c.env.DB.prepare('select id, username from users where id=?')
    .bind(c.get('uid'))
    .first()
  return c.json({ user: u })
})

export default r
