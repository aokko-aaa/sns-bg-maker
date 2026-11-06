import { Hono } from 'hono'
import type { Env, Vars } from '../types'
import { requireAuth } from '../auth'
import { nowIso, uuid } from '../util'

const r = new Hono<{ Bindings: Env; Variables: Vars }>()
r.use('*', requireAuth)

// parsed は JSON文字列で保存しているので、読み出し時にパースして返す
function mapInbox(row: Record<string, unknown>) {
  const parsed = row.parsed
  return {
    ...row,
    parsed: typeof parsed === 'string' && parsed ? safeJson(parsed) : null,
  }
}
function safeJson(s: string): unknown {
  try {
    return JSON.parse(s)
  } catch {
    return null
  }
}

r.get('/', async (c) => {
  const { results } = await c.env.DB.prepare(
    'select * from inbox_items where user_id=? order by created_at desc'
  )
    .bind(c.get('uid'))
    .all<Record<string, unknown>>()
  return c.json((results ?? []).map(mapInbox))
})

r.post('/', async (c) => {
  const uid = c.get('uid')
  const b = await c.req.json<{ raw_text: string; input_type?: string }>()
  if (!b?.raw_text?.trim()) return c.json({ error: 'raw_text が必要です' }, 400)
  const id = uuid()
  await c.env.DB.prepare(
    'insert into inbox_items (id,user_id,raw_text,input_type,status,parsed,parsed_at,created_at) values (?,?,?,?,?,?,?,?)'
  )
    .bind(id, uid, b.raw_text.trim(), b.input_type ?? 'text', 'pending', null, null, nowIso())
    .run()
  const row = await c.env.DB.prepare('select * from inbox_items where id=?').bind(id).first<Record<string, unknown>>()
  return c.json(row ? mapInbox(row) : null)
})

// ステータス更新 / 解釈結果の保存
r.patch('/:id', async (c) => {
  const uid = c.get('uid')
  const id = c.req.param('id')
  const b = await c.req.json<{ status?: string; parsed?: unknown }>()
  const sets: string[] = []
  const vals: unknown[] = []
  if (b.status !== undefined) {
    sets.push('status=?')
    vals.push(b.status)
  }
  if (b.parsed !== undefined) {
    sets.push('parsed=?', 'parsed_at=?')
    vals.push(JSON.stringify(b.parsed), nowIso())
  }
  if (sets.length === 0) return c.json({ error: '更新項目がありません' }, 400)
  vals.push(id, uid)
  await c.env.DB.prepare(`update inbox_items set ${sets.join(', ')} where id=? and user_id=?`)
    .bind(...vals)
    .run()
  const row = await c.env.DB.prepare('select * from inbox_items where id=? and user_id=?')
    .bind(id, uid)
    .first<Record<string, unknown>>()
  return c.json(row ? mapInbox(row) : null)
})

r.delete('/:id', async (c) => {
  await c.env.DB.prepare('delete from inbox_items where id=? and user_id=?')
    .bind(c.req.param('id'), c.get('uid'))
    .run()
  return c.json({ ok: true })
})

export default r
