// Web Push 送信（VAPID + aes128gcm, RFC 8291/8188）。Web Cryptoのみで実装。
// ⚠️ この暗号処理は実機のpushエンドポイントでの疎通確認が未実施です（Phase 2で検証）。
// 構造は完成しているので、デプロイ後にVAPID鍵を設定して1通送って確認してください。

import type { Env } from './types'
import { b64urlDecode, b64urlEncode } from './util'

const enc = new TextEncoder()

function concat(...arrs: Uint8Array[]): Uint8Array {
  const len = arrs.reduce((n, a) => n + a.length, 0)
  const out = new Uint8Array(len)
  let o = 0
  for (const a of arrs) {
    out.set(a, o)
    o += a.length
  }
  return out
}

async function hkdf(
  ikm: Uint8Array,
  salt: Uint8Array,
  info: Uint8Array,
  len: number
): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt, info },
    key,
    len * 8
  )
  return new Uint8Array(bits)
}

async function importVapidPrivate(env: Env): Promise<CryptoKey> {
  const pub = b64urlDecode(env.VAPID_PUBLIC_KEY!) // 65 bytes: 0x04 || x(32) || y(32)
  const d = b64urlDecode(env.VAPID_PRIVATE_KEY!) // 32 bytes
  const jwk: JsonWebKey = {
    kty: 'EC',
    crv: 'P-256',
    d: b64urlEncode(d),
    x: b64urlEncode(pub.slice(1, 33)),
    y: b64urlEncode(pub.slice(33, 65)),
    ext: true,
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return crypto.subtle.importKey(
    'jwk',
    jwk as any,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  )
}

async function vapidAuth(env: Env, audience: string): Promise<string> {
  const header = b64urlEncode(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })))
  const payload = b64urlEncode(
    enc.encode(
      JSON.stringify({
        aud: audience,
        exp: Math.floor(Date.now() / 1000) + 12 * 3600,
        sub: env.VAPID_SUBJECT || 'mailto:admin@example.com',
      })
    )
  )
  const signingInput = `${header}.${payload}`
  const key = await importVapidPrivate(env)
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, enc.encode(signingInput))
  return `${signingInput}.${b64urlEncode(sig)}`
}

async function encryptPayload(
  payload: Uint8Array,
  uaPublic: Uint8Array, // 65 bytes
  authSecret: Uint8Array // 16 bytes
): Promise<Uint8Array> {
  const asKeys = (await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveBits']
  )) as CryptoKeyPair
  const asPublic = new Uint8Array(
    (await crypto.subtle.exportKey('raw', asKeys.publicKey)) as ArrayBuffer
  )
  const uaKey = await crypto.subtle.importKey(
    'raw',
    uaPublic,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    []
  )
  const ecdh = new Uint8Array(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey } as any, asKeys.privateKey, 256)
  )
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const keyInfo = concat(enc.encode('WebPush: info\0'), uaPublic, asPublic)
  const ikm = await hkdf(ecdh, authSecret, keyInfo, 32)
  const cek = await hkdf(ikm, salt, enc.encode('Content-Encoding: aes128gcm\0'), 16)
  const nonce = await hkdf(ikm, salt, enc.encode('Content-Encoding: nonce\0'), 12)
  const aesKey = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt'])
  const record = concat(payload, new Uint8Array([2])) // 単一レコードの区切り 0x02
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, aesKey, record))
  // aes128gcm ヘッダ: salt(16) || rs(4) || idlen(1) || keyid(asPublic)
  const header = new Uint8Array(16 + 4 + 1 + asPublic.length)
  header.set(salt, 0)
  new DataView(header.buffer).setUint32(16, 4096, false)
  header[20] = asPublic.length
  header.set(asPublic, 21)
  return concat(header, ct)
}

export async function sendWebPush(
  env: Env,
  sub: { endpoint: string; p256dh: string; auth: string },
  payload: string
): Promise<boolean> {
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) return false
  const body = await encryptPayload(
    enc.encode(payload),
    b64urlDecode(sub.p256dh),
    b64urlDecode(sub.auth)
  )
  const url = new URL(sub.endpoint)
  const jwt = await vapidAuth(env, url.origin)
  const res = await fetch(sub.endpoint, {
    method: 'POST',
    headers: {
      TTL: '2419200',
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream',
      Authorization: `vapid t=${jwt}, k=${env.VAPID_PUBLIC_KEY}`,
    },
    body,
  })
  return res.ok || res.status === 201
}
