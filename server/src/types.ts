import type { Hono } from 'hono'

export interface Env {
  DB: D1Database
  ASSETS: Fetcher
  APP_NAME?: string
  SESSION_SECRET?: string
  VAPID_PUBLIC_KEY?: string
  VAPID_PRIVATE_KEY?: string
  VAPID_SUBJECT?: string
}

// c.get('uid') でログイン中のユーザーIDを取り出せるようにする
export type Vars = { uid: string }

export type App = Hono<{ Bindings: Env; Variables: Vars }>
