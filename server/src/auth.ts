import { getCookie, setCookie, deleteCookie } from 'hono/cookie'
import type { Context, MiddlewareHandler } from 'hono'
import type { Env, Vars } from './types'
import { b64urlDecode, b64urlEncode, fromHex, nowIso, toHex, uuid } from './util'

const PBKDF2_ITERS = 100_000
const SESSION_DAYS = 60
const COOKIE = 'sess'

const enc = new TextEncoder()

async function pbkdf2(password: string, salt: Uint8Array): Promise<string> {
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, [
    'deriveBits',
  ])
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERS, hash: 'SHA-256' },
    key,
    256
  )
  return toHex(bits)
}

export async function hashPassword(password: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const hash = await pbkdf2(password, salt)
  return { salt: toHex(salt.buffer), hash }
}

export async function verifyPassword(password: string, saltHex: string, hashHex: string) {
  const hash = await pbkdf2(password, fromHex(saltHex))
  return timingSafeEqual(hash, hashHex)
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

function secret(env: Env): string {
  return env.SESSION_SECRET || 'dev-insecure-secret-change-me'
}

async function hmac(data: string, key: string): Promise<string> {
  const k = await crypto.subtle.importKey(
    'raw',
    enc.encode(key),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', k, enc.encode(data))
  return b64urlEncode(sig)
}

export async function signSession(uid: string, env: Env): Promise<string> {
  const exp = Date.now() + SESSION_DAYS * 86400_000
  const payload = b64urlEncode(enc.encode(JSON.stringify({ uid, exp })))
  const sig = await hmac(payload, secret(env))
  return `${payload}.${sig}`
}

export async function verifySession(token: string, env: Env): Promise<string | null> {
  const dot = token.indexOf('.')
  if (dot < 0) return null
  const payload = token.slice(0, dot)
  const sig = token.slice(dot + 1)
  const expected = await hmac(payload, secret(env))
  if (!timingSafeEqual(sig, expected)) return null
  try {
    const obj = JSON.parse(new TextDecoder().decode(b64urlDecode(payload))) as {
      uid: string
      exp: number
    }
    if (!obj.uid || !obj.exp || obj.exp < Date.now()) return null
    return obj.uid
  } catch {
    return null
  }
}

function isHttps(c: Context): boolean {
  return new URL(c.req.url).protocol === 'https:'
}

export async function startSession(c: Context<{ Bindings: Env; Variables: Vars }>, uid: string) {
  const token = await signSession(uid, c.env)
  setCookie(c, COOKIE, token, {
    httpOnly: true,
    secure: isHttps(c), // localのhttpでも使えるように
    sameSite: 'Lax',
    path: '/',
    maxAge: SESSION_DAYS * 86400,
  })
}

export function endSession(c: Context<{ Bindings: Env; Variables: Vars }>) {
  deleteCookie(c, COOKIE, { path: '/' })
}

/** 認証必須ミドルウェア: 未ログインは401。成功で c.set('uid', ...) */
export const requireAuth: MiddlewareHandler<{ Bindings: Env; Variables: Vars }> = async (
  c,
  next
) => {
  const token = getCookie(c, COOKIE)
  const uid = token ? await verifySession(token, c.env) : null
  if (!uid) return c.json({ error: 'unauthorized' }, 401)
  c.set('uid', uid)
  await next()
}

// 新規ユーザー作成（no-PII: username + password のみ）
export async function createUser(env: Env, username: string, password: string) {
  const { salt, hash } = await hashPassword(password)
  const id = uuid()
  await env.DB.prepare(
    'insert into users (id, username, pass_salt, pass_hash, created_at) values (?,?,?,?,?)'
  )
    .bind(id, username, salt, hash, nowIso())
    .run()
  return id
}
