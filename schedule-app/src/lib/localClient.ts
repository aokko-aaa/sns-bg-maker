// 配布用ローカルモードの保存層。
// Supabase クライアントが使う最小限のAPI（.from().select().eq()... / auth / functions）を
// localStorage 上で再現する。これにより、既存のフックを一切変えずに
// 「端末内だけに保存・ログイン不要」の版を作れる（あなたは誰の情報も預からない）。

type Row = Record<string, unknown>

const storeKey = (t: string) => `localdb:${t}`
function readTable(t: string): Row[] {
  try {
    const s = localStorage.getItem(storeKey(t))
    return s ? (JSON.parse(s) as Row[]) : []
  } catch {
    return []
  }
}
function writeTable(t: string, rows: Row[]) {
  try {
    localStorage.setItem(storeKey(t), JSON.stringify(rows))
  } catch {
    /* 容量超過などは無視 */
  }
}
const uuid = () =>
  (globalThis.crypto?.randomUUID?.() ??
    'id-' + Math.random().toString(36).slice(2) + Date.now())
const now = () => new Date().toISOString()

interface Filter {
  col: string
  op: 'eq' | 'lt' | 'gt'
  val: unknown
}

type Result = { data: unknown; error: { message: string } | null }

class Builder implements PromiseLike<Result> {
  private op: 'select' | 'insert' | 'update' | 'delete' | 'upsert' | null = null
  private payload: unknown = null
  private filters: Filter[] = []
  private orders: { col: string; asc: boolean }[] = []
  private _limit: number | null = null
  private _single = false
  private returning = false
  constructor(private table: string) {}

  select(_cols?: string) {
    if (this.op === 'insert' || this.op === 'upsert') this.returning = true
    else this.op = 'select'
    return this
  }
  insert(payload: unknown) {
    this.op = 'insert'
    this.payload = payload
    return this
  }
  upsert(payload: unknown) {
    this.op = 'upsert'
    this.payload = payload
    return this
  }
  update(payload: unknown) {
    this.op = 'update'
    this.payload = payload
    return this
  }
  delete() {
    this.op = 'delete'
    return this
  }
  eq(col: string, val: unknown) {
    this.filters.push({ col, op: 'eq', val })
    return this
  }
  lt(col: string, val: unknown) {
    this.filters.push({ col, op: 'lt', val })
    return this
  }
  gt(col: string, val: unknown) {
    this.filters.push({ col, op: 'gt', val })
    return this
  }
  order(col: string, opts?: { ascending?: boolean }) {
    this.orders.push({ col, asc: opts?.ascending !== false })
    return this
  }
  limit(n: number) {
    this._limit = n
    return this
  }
  single() {
    this._single = true
    return this
  }

  private match = (r: Row) =>
    this.filters.every((f) => {
      const v = r[f.col] as never
      const val = f.val as never
      if (f.op === 'eq') return v === val
      if (f.op === 'lt') return v < val
      return v > val
    })

  private applyOrder(rows: Row[]) {
    if (!this.orders.length) return rows
    return [...rows].sort((a, b) => {
      for (const o of this.orders) {
        const av = a[o.col] as never
        const bv = b[o.col] as never
        if (av === bv) continue
        const cmp = av < bv ? -1 : 1
        return o.asc ? cmp : -cmp
      }
      return 0
    })
  }

  private run(): Result {
    try {
      const rows = readTable(this.table)
      if (this.op === 'select' || this.op === null) {
        let out = rows.filter(this.match)
        out = this.applyOrder(out)
        if (this._limit != null) out = out.slice(0, this._limit)
        return { data: this._single ? (out[0] ?? null) : out, error: null }
      }
      if (this.op === 'insert' || this.op === 'upsert') {
        const items = Array.isArray(this.payload)
          ? (this.payload as Row[])
          : [this.payload as Row]
        const inserted: Row[] = []
        for (const it of items) {
          const row: Row = { ...it }
          if (this.op === 'upsert' && row.id) {
            const idx = rows.findIndex((r) => r.id === row.id)
            if (idx >= 0) {
              rows[idx] = { ...rows[idx], ...row, updated_at: now() }
              inserted.push(rows[idx]!)
              continue
            }
          }
          row.id = row.id ?? uuid()
          row.created_at = row.created_at ?? now()
          row.updated_at = row.updated_at ?? now()
          rows.push(row)
          inserted.push(row)
        }
        writeTable(this.table, rows)
        const data = this.returning
          ? this._single
            ? (inserted[0] ?? null)
            : inserted
          : null
        return { data, error: null }
      }
      if (this.op === 'update') {
        const upd = rows.map((r) =>
          this.match(r) ? { ...r, ...(this.payload as Row) } : r
        )
        writeTable(this.table, upd)
        return { data: null, error: null }
      }
      // delete
      writeTable(
        this.table,
        rows.filter((r) => !this.match(r))
      )
      return { data: null, error: null }
    } catch (e) {
      return { data: null, error: { message: e instanceof Error ? e.message : String(e) } }
    }
  }

  then<T1 = Result, T2 = never>(
    onF?: ((v: Result) => T1 | PromiseLike<T1>) | null,
    onR?: ((r: unknown) => T2 | PromiseLike<T2>) | null
  ): PromiseLike<T1 | T2> {
    return Promise.resolve(this.run()).then(onF as never, onR as never)
  }
}

const FAKE_USER = {
  id: 'local-user',
  email: 'local@device',
  app_metadata: {},
  user_metadata: {},
  aud: 'local',
  created_at: now(),
}
const FAKE_SESSION = {
  user: FAKE_USER,
  access_token: 'local',
  refresh_token: 'local',
  expires_in: 3600,
  token_type: 'bearer',
}

/** Supabase 互換の最小クライアント（localStorage バック） */
export function createLocalClient() {
  return {
    from: (table: string) => new Builder(table),
    auth: {
      async getSession() {
        return { data: { session: FAKE_SESSION }, error: null }
      },
      async getUser() {
        return { data: { user: FAKE_USER }, error: null }
      },
      onAuthStateChange(_cb: unknown) {
        return { data: { subscription: { unsubscribe() {} } } }
      },
      async signInWithPassword() {
        return { data: { session: FAKE_SESSION, user: FAKE_USER }, error: null }
      },
      async signOut() {
        return { error: null }
      },
    },
    functions: {
      async invoke() {
        return {
          data: null,
          error: { message: 'AI機能はローカル版では使えません' },
        }
      },
    },
  }
}
