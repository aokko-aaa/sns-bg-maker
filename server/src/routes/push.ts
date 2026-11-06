import { Hono } from 'hono'
import type { Env, Vars } from '../types'
import { requireAuth } from '../auth'
import { nowIso, toBool, uuid } from '../util'

const r = new Hono<{ Bindings: Env; Variables: Vars }>()

// 購読に必要な公開鍵（これはログイン不要で返してよい）
r.get('/public-key', (c) => c.json({ key: c.env.VAPID_PUBLIC_KEY ?? null }))

r.use('*', requireAuth)

// 端末の購読情報を登録（iOS: ホーム追加→通知許可で得られる）
r.post('/subscribe', async (c) => {
  const uid = c.get('uid')
  const b = await c.req.json<{
    endpoint?: string
    keys?: { p256dh?: string; auth?: string }
  }>()
  const endpoint = b?.endpoint
  const p256dh = b?.keys?.p256dh
  const auth = b?.keys?.auth
  if (!endpoint || !p256dh || !auth) return c.json({ error: '購読情報が不足しています' }, 400)
  // endpoint 一意。既存は上書き（この利用者のものとして）
  await c.env.DB.prepare('delete from push_subscriptions where endpoint=?').bind(endpoint).run()
  await c.env.DB.prepare(
    'insert into push_subscriptions (id,user_id,endpoint,p256dh,auth,created_at) values (?,?,?,?,?,?)'
  )
    .bind(uuid(), uid, endpoint, p256dh, auth, nowIso())
    .run()
  return c.json({ ok: true })
})

// リマインド設定
r.get('/prefs', async (c) => {
  const row = await c.env.DB.prepare('select * from reminder_prefs where user_id=?')
    .bind(c.get('uid'))
    .first<{ enabled: number; notify_hour: number }>()
  return c.json(
    row
      ? { enabled: toBool(row.enabled), notify_hour: row.notify_hour }
      : { enabled: true, notify_hour: 21 }
  )
})

r.put('/prefs', async (c) => {
  const uid = c.get('uid')
  const b = await c.req.json<{ enabled?: boolean; notify_hour?: number }>()
  const enabled = b.enabled === false ? 0 : 1
  const hour = Math.max(0, Math.min(23, Number(b.notify_hour ?? 21)))
  const t = nowIso()
  const existing = await c.env.DB.prepare('select user_id from reminder_prefs where user_id=?')
    .bind(uid)
    .first()
  if (existing) {
    await c.env.DB.prepare(
      'update reminder_prefs set enabled=?, notify_hour=?, updated_at=? where user_id=?'
    )
      .bind(enabled, hour, t, uid)
      .run()
  } else {
    await c.env.DB.prepare(
      'insert into reminder_prefs (user_id,enabled,notify_hour,created_at,updated_at) values (?,?,?,?,?)'
    )
      .bind(uid, enabled, hour, t, t)
      .run()
  }
  return c.json({ ok: true, enabled: !!enabled, notify_hour: hour })
})

export default r
