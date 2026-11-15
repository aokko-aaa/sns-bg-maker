import type { Hono } from 'hono'

export interface Env {
  DB: D1Database
  ASSETS: Fetcher
  APP_NAME?: string
  SESSION_SECRET?: string
  VAPID_PUBLIC_KEY?: string
  VAPID_PRIVATE_KEY?: string
  VAPID_SUBJECT?: string
  // 読み出し専用 digest 用。?token= がこれと一致したときだけ返す
  DIGEST_TOKEN?: string
  // 対象ユーザーを固定したいとき（省略時は単一ユーザーを自動採用）
  DIGEST_USER_ID?: string
}

// c.get('uid') でログイン中のユーザーIDを取り出せるようにする
export type Vars = { uid: string }

export type App = Hono<{ Bindings: Env; Variables: Vars }>
