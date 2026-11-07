import { useState, type FormEvent } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { isSupabaseConfigured, CF } from '@/lib/supabase'

export default function Login() {
  const { signIn, signUp } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setErr(null)
    setBusy(true)
    const fn = CF && mode === 'register' ? signUp : signIn
    const { error } = await fn(email.trim(), password)
    setBusy(false)
    if (error) setErr(error)
  }

  return (
    <div className="mx-auto flex h-full max-w-md flex-col justify-center bg-white px-6">
      <h1 className="mb-1 text-center text-xl font-bold text-gray-800">MY SCHEDULE</h1>
      <p className="mb-8 text-center text-sm text-gray-500">
        {CF ? (mode === 'register' ? '新規登録' : 'ログイン') : 'ログイン'}
      </p>

      {!CF && !isSupabaseConfigured && (
        <div className="mb-4 rounded-lg bg-amber-100 p-3 text-sm text-amber-800">
          Supabase が未設定です。<code>.env</code> に URL と anon キーを設定して再起動してください。
        </div>
      )}

      {/* CF版: ログイン / 新規登録 切り替え */}
      {CF && (
        <div className="mb-4 flex overflow-hidden rounded-xl border border-gray-200">
          {(['login', 'register'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                setMode(m)
                setErr(null)
              }}
              className={
                'min-h-tap flex-1 text-sm font-medium ' +
                (mode === m ? 'bg-group-work text-white' : 'bg-white text-gray-500')
              }
            >
              {m === 'login' ? 'ログイン' : '新規登録'}
            </button>
          ))}
        </div>
      )}

      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <label className="text-sm text-gray-600">
          {CF ? 'ユーザー名' : 'メールアドレス'}
          <input
            type={CF ? 'text' : 'email'}
            autoComplete={CF ? 'username' : 'email'}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={CF ? '例: ao（ニックネームでOK）' : ''}
            className="mt-1 min-h-tap w-full rounded-lg border border-gray-300 px-3 text-base"
          />
        </label>
        <label className="text-sm text-gray-600">
          パスワード
          <input
            type="password"
            autoComplete={CF && mode === 'register' ? 'new-password' : 'current-password'}
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
          {busy ? '確認中…' : CF && mode === 'register' ? 'アカウントを作る' : 'ログイン'}
        </button>
      </form>

      {CF ? (
        <p className="mt-6 text-center text-xs text-gray-400">
          氏名やメールは登録しません。ユーザー名とパスワードだけで使えます。
        </p>
      ) : (
        <p className="mt-6 text-center text-xs text-gray-400">
          アカウントは Supabase の管理画面で作成します（Authentication → Add user）。
        </p>
      )}
    </div>
  )
}
