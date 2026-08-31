/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  /** 'true' で配布用ローカルモード（ログイン不要・端末内保存） */
  readonly VITE_LOCAL_MODE?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
