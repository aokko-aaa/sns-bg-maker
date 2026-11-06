// Cloudflare版（アカウント＋同期）のAPIクライアント。
// Phase 2 で各フック（useEntries 等）を Supabase からこの client 呼び出しへ差し替える。
// 同一オリジンの /api を叩き、セッションCookieで認証する。
import type {
  Category,
  Entry,
  InboxItem,
  MonthlyGoal,
  TimeLog,
} from '@/types/database'

const BASE = '/api'

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(BASE + path, {
    credentials: 'include',
    headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
    ...init,
  })
  const text = await res.text()
  const data = text ? JSON.parse(text) : null
  if (!res.ok) {
    const msg = (data && (data as { error?: string }).error) || `HTTP ${res.status}`
    throw Object.assign(new Error(msg), { status: res.status })
  }
  return data as T
}

const body = (v: unknown) => ({ body: JSON.stringify(v) })

export type AuthUser = { id: string; username: string }
export type EntryInputApi = Omit<
  Entry,
  'id' | 'user_id' | 'created_at' | 'updated_at'
>

export const api = {
  auth: {
    /** 未ログインなら null */
    async me(): Promise<AuthUser | null> {
      try {
        const r = await req<{ user: AuthUser }>('/auth/me')
        return r.user
      } catch (e) {
        if ((e as { status?: number }).status === 401) return null
        throw e
      }
    },
    register: (username: string, password: string) =>
      req<{ user: AuthUser }>('/auth/register', { method: 'POST', ...body({ username, password }) }),
    login: (username: string, password: string) =>
      req<{ user: AuthUser }>('/auth/login', { method: 'POST', ...body({ username, password }) }),
    logout: () => req<{ ok: true }>('/auth/logout', { method: 'POST' }),
  },

  categories: {
    list: () => req<Category[]>('/categories'),
    upsert: (c: Partial<Category> & { name: string; group_key: string; color: string }) =>
      req<Category>('/categories', { method: 'POST', ...body(c) }),
    remove: (id: string, reassignTo?: string | null) =>
      req<{ ok: true }>(
        `/categories/${id}` + (reassignTo ? `?reassignTo=${encodeURIComponent(reassignTo)}` : ''),
        { method: 'DELETE' }
      ),
  },

  entries: {
    range: (startIso: string, endIso: string) =>
      req<Entry[]>(
        `/entries?start=${encodeURIComponent(startIso)}&end=${encodeURIComponent(endIso)}`
      ),
    overdueTasks: (beforeIso: string) =>
      req<Entry[]>(`/entries/overdue-tasks?before=${encodeURIComponent(beforeIso)}`),
    create: (input: EntryInputApi) => req<Entry>('/entries', { method: 'POST', ...body(input) }),
    update: (id: string, input: EntryInputApi) =>
      req<Entry>(`/entries/${id}`, { method: 'PUT', ...body(input) }),
    patch: (id: string, patch: { progress?: number; notes?: string | null }) =>
      req<Entry>(`/entries/${id}`, { method: 'PATCH', ...body(patch) }),
    remove: (id: string) => req<{ ok: true }>(`/entries/${id}`, { method: 'DELETE' }),
    bulk: (rows: EntryInputApi[]) =>
      req<{ ok: true; added: number }>('/entries/bulk', { method: 'POST', ...body({ rows }) }),
  },

  timeLogs: {
    running: () => req<TimeLog[]>('/time-logs/running'),
    range: (startIso: string, endIso: string) =>
      req<TimeLog[]>(
        `/time-logs?start=${encodeURIComponent(startIso)}&end=${encodeURIComponent(endIso)}`
      ),
    start: (v: { label: string; entry_id?: string | null; category_id?: string | null }) =>
      req<TimeLog>('/time-logs/start', { method: 'POST', ...body(v) }),
    stop: (id: string) => req<{ ok: true }>(`/time-logs/${id}/stop`, { method: 'POST' }),
  },

  goals: {
    get: (month: string) => req<MonthlyGoal | null>(`/goals/${month}`),
    put: (month: string, goal: string) =>
      req<MonthlyGoal>(`/goals/${month}`, { method: 'PUT', ...body({ goal }) }),
  },

  inbox: {
    list: () => req<InboxItem[]>('/inbox'),
    create: (v: { raw_text: string; input_type?: string }) =>
      req<InboxItem>('/inbox', { method: 'POST', ...body(v) }),
    patch: (id: string, v: { status?: string; parsed?: unknown }) =>
      req<InboxItem>(`/inbox/${id}`, { method: 'PATCH', ...body(v) }),
    remove: (id: string) => req<{ ok: true }>(`/inbox/${id}`, { method: 'DELETE' }),
  },

  push: {
    publicKey: () => req<{ key: string | null }>('/push/public-key'),
    subscribe: (sub: { endpoint: string; keys: { p256dh: string; auth: string } }) =>
      req<{ ok: true }>('/push/subscribe', { method: 'POST', ...body(sub) }),
    getPrefs: () => req<{ enabled: boolean; notify_hour: number }>('/push/prefs'),
    putPrefs: (v: { enabled?: boolean; notify_hour?: number }) =>
      req<{ ok: true; enabled: boolean; notify_hour: number }>('/push/prefs', {
        method: 'PUT',
        ...body(v),
      }),
  },
}
