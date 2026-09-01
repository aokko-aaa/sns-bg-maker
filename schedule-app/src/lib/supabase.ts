import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { createLocalClient } from './localClient'
import type { Database } from '@/types/database'

// 配布用ローカルモード:
// ログイン不要・端末内(localStorage)だけに保存。運営側は誰の情報も預からない。
// 有効化の方法は2つ:
//   1) ビルド時に VITE_LOCAL_MODE=true（専用デプロイ用）
//   2) URLに ?local=1 を付けて開く（その端末だけローカル版に切替・以後記憶）
//      ?local=0 で通常(クラウド)版に戻す
const LOCAL_FLAG_KEY = 'app-mode'
function detectLocalMode(): boolean {
  if (import.meta.env.VITE_LOCAL_MODE === 'true') return true
  try {
    const p = new URLSearchParams(window.location.search)
    if (p.get('local') === '1') localStorage.setItem(LOCAL_FLAG_KEY, 'local')
    else if (p.get('local') === '0') localStorage.removeItem(LOCAL_FLAG_KEY)
    return localStorage.getItem(LOCAL_FLAG_KEY) === 'local'
  } catch {
    return false
  }
}
const LOCAL_MODE = detectLocalMode()

// 設計原則 2-3: フロントに置いてよいのは anon(publishable) key と URL のみ。
// これらはブラウザに公開される前提の公開用の値（RLS で守られる）。
// Anthropic API キーなどの秘密は絶対にここに置かず、Edge Function の Secret で扱う。
//
// 環境変数(.env / Vercel)があればそれを優先。無ければ下のフォールバックを使うので、
// Vercel 側で環境変数を設定しなくても本番で接続できる。
const FALLBACK_URL = 'https://yshnutsgkoxadwjhhtlp.supabase.co'
const FALLBACK_ANON_KEY = 'sb_publishable_juKioD-UgFHqwled9wXi1Q__O6h0fFN'

const url = import.meta.env.VITE_SUPABASE_URL || FALLBACK_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || FALLBACK_ANON_KEY

export const isSupabaseConfigured = LOCAL_MODE ? true : Boolean(url && anonKey)

export const supabase: SupabaseClient<Database> = LOCAL_MODE
  ? (createLocalClient() as unknown as SupabaseClient<Database>)
  : createClient<Database>(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    })
