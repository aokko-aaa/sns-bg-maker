// 作業時間の表示ヘルパー。

/** 経過時間を H:MM:SS / MM:SS で（計測バーのライブ表示用） */
export function fmtElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const s = total % 60
  const m = Math.floor(total / 60) % 60
  const h = Math.floor(total / 3600)
  const pad = (n: number) => String(n).padStart(2, '0')
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`
}

/** 集計時間を「◯時間◯分」で（レポート用）。0分なら「0分」 */
export function fmtHours(ms: number): string {
  const totalMin = Math.round(ms / 60000)
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  if (h > 0 && m > 0) return `${h}時間${m}分`
  if (h > 0) return `${h}時間`
  return `${m}分`
}

/** ログの継続時間(ms)。計測中(ended_at=null)は now までを返す。 */
export function logDurationMs(
  log: { started_at: string; ended_at: string | null },
  now: number = Date.now()
): number {
  const start = new Date(log.started_at).getTime()
  const end = log.ended_at ? new Date(log.ended_at).getTime() : now
  return Math.max(0, end - start)
}
