// Supabase のエラーは Error インスタンスではなくプレーンオブジェクト
// （message / details / hint / code を持つ）なので、実メッセージを取り出す。
export function errMessage(e: unknown): string {
  if (e == null) return '不明なエラー'
  if (typeof e === 'string') return e
  if (e instanceof Error) return e.message
  const o = e as Record<string, unknown>
  const base =
    (o.message as string) ||
    (o.error_description as string) ||
    (o.details as string) ||
    (o.hint as string) ||
    JSON.stringify(o)
  return o.code ? `${base}（${o.code}）` : base
}
