import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase, CF } from '@/lib/supabase'
import { api } from '@/lib/apiClient'

interface AuthValue {
  session: Session | null
  user: User | null
  loading: boolean
  signIn: (username: string, password: string) => Promise<{ error: string | null }>
  signUp: (username: string, password: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthValue | null>(null)

// CF版: {id, username} を User っぽい最小オブジェクトにして使い回す
const asUser = (u: { id: string; username: string }): User =>
  ({ id: u.id, email: u.username } as unknown as User)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (CF) {
      // Cloudflare版: /api/auth/me でセッション確認（Cookie）
      api.auth
        .me()
        .then((u) => setUser(u ? asUser(u) : null))
        .catch(() => setUser(null))
        .finally(() => setLoading(false))
      return
    }
    // Supabase/ローカル版
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setUser(data.session?.user ?? null)
      setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s)
      setUser(s?.user ?? null)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  const signIn: AuthValue['signIn'] = async (username, password) => {
    if (CF) {
      try {
        const { user: u } = await api.auth.login(username, password)
        setUser(asUser(u))
        return { error: null }
      } catch (e) {
        return { error: e instanceof Error ? e.message : 'ログインに失敗しました' }
      }
    }
    const { error } = await supabase.auth.signInWithPassword({ email: username, password })
    return { error: error?.message ?? null }
  }

  const signUp: AuthValue['signUp'] = async (username, password) => {
    if (CF) {
      try {
        const { user: u } = await api.auth.register(username, password)
        setUser(asUser(u))
        return { error: null }
      } catch (e) {
        return { error: e instanceof Error ? e.message : '登録に失敗しました' }
      }
    }
    // Supabase版はメールでのサインアップ（配布では使わない想定）
    const { error } = await supabase.auth.signUp({ email: username, password })
    return { error: error?.message ?? null }
  }

  const signOut = async () => {
    if (CF) {
      await api.auth.logout().catch(() => {})
      setUser(null)
      return
    }
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ session, user, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
