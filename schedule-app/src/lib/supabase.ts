import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

// 設計原則 2-3: フロントに置いてよいのは anon key と URL のみ。
// Anthropic API キーは絶対にここに置かず、Edge Function の Secret で扱う。
const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

/** 環境変数が未設定でもアプリ全体が落ちないよう、接続可否を明示的に持つ */
export const isSupabaseConfigured = Boolean(url && anonKey)

if (!isSupabaseConfigured) {
  // 開発時に気づけるよう警告のみ（本番ビルドは設定済み前提）
  console.warn(
    '[supabase] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY が未設定です。.env を確認してください。'
  )
}

export const supabase = createClient<Database>(
  url ?? 'http://localhost',
  anonKey ?? 'public-anon-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  }
)
