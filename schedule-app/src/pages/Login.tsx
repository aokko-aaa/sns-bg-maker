import { useState, type FormEvent } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { isSupabaseConfigured } from '@/lib/supabase'

export default function Login() {
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setErr(null)
    setBusy(true)
    const { error } = await signIn(email.trim(), password)
    setBusy(false)
    if (error) setErr(error)
  }

  return (
    <div className="mx-auto flex h-full max-w-md flex-col justify-center bg-white px-6">
      <h1 className="mb-1 text-center text-xl font-bold text-gray-800">
        スケジュール管理
      </h1>
      <p className="mb-8 text-center text-sm text-gray-500">ログイン</p>

      {!isSupabaseConfigured && (
        <div className="mb-4 rounded-lg bg-amber-100 p-3 text-sm text-amber-800">
          Supabase が未設定です。<code>.env</code> に URL と anon キーを設定して
          再起動してください。
        </div>
      )}

      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <label className="text-sm text-gray-600">
          メールアドレス
          <input
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 min-h-tap w-full rounded-lg border border-gray-300 px-3 text-base"
          />
        </label>
        <label className="text-sm text-gray-600">
          パスワード
          <input
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 min-h-tap w-full rounded-lg border border-gray-300 px-3 text-base"
          />
        </label>

        {err && <p className="text-sm text-red-600">{err}</p>}

        <button
          type="submit"
          disabled={busy}
          className="min-h-tap mt-2 rounded-lg bg-group-work font-medium text-white disabled:opacity-50"
        >
          {busy ? '確認中…' : 'ログイン'}
        </button>
      </form>

      <p className="mt-6 text-center text-xs text-gray-400">
        アカウントは Supabase の管理画面で作成します（Authentication → Add user）。
      </p>
    </div>
  )
}
