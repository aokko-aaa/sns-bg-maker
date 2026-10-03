import { useState } from 'react'
import { LOCAL_MODE } from '@/lib/supabase'
import {
  useChatImportToken,
  useGenerateChatToken,
  useToggleChatImport,
} from '@/hooks/useChatImport'
import { errMessage } from '@/lib/errors'

// Supabase の Functions URL を接続先から導出
const SUPA_URL =
  (import.meta.env.VITE_SUPABASE_URL as string | undefined) ||
  'https://yshnutsgkoxadwjhhtlp.supabase.co'
function fnUrl(): string {
  try {
    const ref = new URL(SUPA_URL).host.split('.')[0]
    return `https://${ref}.functions.supabase.co/import-entries`
  } catch {
    return ''
  }
}

/** チャット(Claude)から予定を直接登録するためのトークン設定（クラウド版のみ） */
export default function ChatImportSection() {
  const { data: row, isLoading } = useChatImportToken()
  const gen = useGenerateChatToken()
  const toggle = useToggleChatImport()
  const [err, setErr] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  if (LOCAL_MODE) {
    return (
      <section className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-3">
        <div className="text-sm font-bold text-gray-700">💬 チャットから登録</div>
        <p className="mt-1 text-xs text-gray-500">
          この機能はクラウド版（ログインあり）でご利用いただけます。
        </p>
      </section>
    )
  }

  const url = fnUrl()
  const token = row?.token
  const enabled = !!row?.enabled

  async function copy(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(label)
      setTimeout(() => setCopied(null), 1500)
    } catch {
      setErr('コピーに失敗しました。長押しで選択してください。')
    }
  }

  async function onGen() {
    setErr(null)
    try {
      await gen.mutateAsync()
    } catch (e) {
      setErr('発行に失敗: ' + errMessage(e))
    }
  }

  const forClaude = token
    ? `予定登録API: ${url}\nトークン: ${token}\nこの2つを使い、私が伝える予定を import-entries に登録してください。`
    : ''

  return (
    <section className="rounded-xl border border-group-work/20 bg-group-work/5 px-3 py-3">
      <div className="flex items-center gap-2">
        <span className="text-sm font-bold text-gray-800">💬 チャットから登録（Claude連携）</span>
        {token && enabled && (
          <span className="rounded-full bg-group-work px-2 py-0.5 text-[10px] font-bold text-white">
            有効
          </span>
        )}
      </div>
      <p className="mt-1 text-xs text-gray-500">
        下の「Claudeに伝える文」をコピーしてClaudeに渡すと、チャットに投げた予定が
        そのままこのアプリに登録されます。
      </p>

      {isLoading ? (
        <p className="mt-2 text-xs text-gray-400">読み込み中…</p>
      ) : !token ? (
        <button
          onClick={onGen}
          disabled={gen.isPending}
          className="mt-3 min-h-tap w-full rounded-lg bg-group-work text-sm font-medium text-white disabled:opacity-50"
        >
          {gen.isPending ? '発行中…' : 'トークンを発行する'}
        </button>
      ) : (
        <div className="mt-3 flex flex-col gap-2">
          <button
            onClick={() => copy(forClaude, 'Claudeに伝える文')}
            className="min-h-tap rounded-lg bg-group-work text-sm font-bold text-white"
          >
            {copied === 'Claudeに伝える文' ? 'コピーしました ✓' : '📋 Claudeに伝える文をコピー'}
          </button>

          <div className="rounded-lg bg-white p-2 text-xs">
            <div className="text-gray-400">API URL</div>
            <div className="mb-1 flex items-center gap-2">
              <code className="flex-1 break-all text-gray-700">{url}</code>
              <button onClick={() => copy(url, 'url')} className="shrink-0 text-group-work underline">
                {copied === 'url' ? '✓' : 'コピー'}
              </button>
            </div>
            <div className="text-gray-400">トークン（秘密）</div>
            <div className="flex items-center gap-2">
              <code className="flex-1 break-all text-gray-700">{token}</code>
              <button onClick={() => copy(token, 'token')} className="shrink-0 text-group-work underline">
                {copied === 'token' ? '✓' : 'コピー'}
              </button>
            </div>
          </div>

          <label className="flex items-center justify-between text-sm text-gray-700">
            この連携を有効にする
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => toggle.mutate(e.target.checked)}
              className="h-5 w-5"
            />
          </label>
          <button
            onClick={() => {
              if (confirm('トークンを作り直しますか？古いトークンは使えなくなります。')) onGen()
            }}
            className="self-start text-xs text-gray-400 underline"
          >
            トークンを作り直す
          </button>
          <p className="text-[11px] text-gray-400">
            ※ トークンは予定の書き込みができる合言葉です。SNS等に貼らないでください。
          </p>
        </div>
      )}

      {err && <p className="mt-2 text-xs text-red-600">{err}</p>}
    </section>
  )
}
