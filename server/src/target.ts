import type { Env } from './types'

// token方式のエンドポイント（digest/import/done）が対象とするユーザーを決める。
// DIGEST_USER_ID があればそれ。無ければ単一ユーザーを自動採用。複数いると409。
export async function resolveTargetUser(
  env: Env
): Promise<{ uid?: string; error?: { msg: string; status: 404 | 409 } }> {
  if (env.DIGEST_USER_ID) return { uid: env.DIGEST_USER_ID }
  const { results } = await env.DB.prepare('select id from users limit 2').all<{ id: string }>()
  if (!results || results.length === 0) return { error: { msg: 'no user', status: 404 } }
  if (results.length > 1) return { error: { msg: 'multiple users; set DIGEST_USER_ID', status: 409 } }
  return { uid: results[0].id }
}

const enc = new TextEncoder()
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  const ab = enc.encode(a)
  const bb = enc.encode(b)
  for (let i = 0; i < ab.length; i++) diff |= ab[i] ^ bb[i]
  return diff === 0
}
