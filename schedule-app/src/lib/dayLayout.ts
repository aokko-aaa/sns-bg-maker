import { endOfDayJst, minutesFromDayStart, startOfDayJst } from './dates'
import type { Entry } from '@/types/database'

export interface TimedBlock {
  entry: Entry
  topMin: number
  heightMin: number
  /** 0..1 の左位置 */
  left: number
  /** 0..1 の幅 */
  width: number
}

/** その日の帯（終日・日またぎ）に置くか、時刻軸に置くかを判定 */
export function isBandEntry(e: Entry, day: Date): boolean {
  if (e.all_day) return true
  const ds = startOfDayJst(day).getTime()
  const de = endOfDayJst(day).getTime()
  return new Date(e.starts_at).getTime() < ds || new Date(e.ends_at).getTime() > de
}

/**
 * 時刻軸に置く entries を、重なりを考慮して列に振り分ける。
 * 重なりクラスタごとに最大同時列数を求め、等幅で横に並べる（要件 5-1）。
 */
export function layoutTimed(entries: Entry[], day: Date): TimedBlock[] {
  const timed = entries
    .filter((e) => !isBandEntry(e, day))
    .map((e) => {
      const topMin = minutesFromDayStart(e.starts_at, day)
      const endMin = minutesFromDayStart(e.ends_at, day)
      // 最低15分の高さを確保（タップしやすさ）
      const heightMin = Math.max(15, endMin - topMin)
      return { entry: e, topMin, heightMin }
    })
    .sort((a, b) => a.topMin - b.topMin || a.heightMin - b.heightMin)

  const blocks: TimedBlock[] = []
  let cluster: typeof timed = []
  let clusterEnd = -1

  const flush = () => {
    if (cluster.length === 0) return
    // 列割り当て
    const cols: number[] = [] // 各列の現在終了min
    const colOf = new Map<Entry, number>()
    for (const b of cluster) {
      let placed = -1
      for (let i = 0; i < cols.length; i++) {
        if (b.topMin >= cols[i]) {
          placed = i
          break
        }
      }
      if (placed === -1) {
        placed = cols.length
        cols.push(0)
      }
      cols[placed] = b.topMin + b.heightMin
      colOf.set(b.entry, placed)
    }
    const n = cols.length
    for (const b of cluster) {
      const col = colOf.get(b.entry)!
      blocks.push({
        ...b,
        left: col / n,
        width: 1 / n,
      })
    }
    cluster = []
    clusterEnd = -1
  }

  for (const b of timed) {
    if (cluster.length > 0 && b.topMin >= clusterEnd) flush()
    cluster.push(b)
    clusterEnd = Math.max(clusterEnd, b.topMin + b.heightMin)
  }
  flush()
  return blocks
}
