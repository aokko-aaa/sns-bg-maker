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
  /** 終日・日またぎ（全高の縦帯として描く） */
  band: boolean
}

/** その日の帯（終日・日またぎ）に置くか判定 */
export function isBandEntry(e: Entry, day: Date): boolean {
  if (e.all_day) return true
  const ds = startOfDayJst(day).getTime()
  const de = endOfDayJst(day).getTime()
  return new Date(e.starts_at).getTime() < ds || new Date(e.ends_at).getTime() > de
}

interface Item {
  entry: Entry
  topMin: number
  heightMin: number
  band: boolean
}

/** entries を、終日=全高／時刻あり=時間帯 の区間に変換 */
function buildItems(entries: Entry[], day: Date): Item[] {
  return entries
    .map((e) => {
      if (isBandEntry(e, day)) {
        return { entry: e, topMin: 0, heightMin: 24 * 60, band: true }
      }
      const topMin = minutesFromDayStart(e.starts_at, day)
      const endMin = minutesFromDayStart(e.ends_at, day)
      return {
        entry: e,
        topMin,
        heightMin: Math.max(15, endMin - topMin),
        band: false,
      }
    })
    // 終日を先に（左端に来るように）、次に開始が早い順
    .sort(
      (a, b) =>
        Number(b.band) - Number(a.band) ||
        a.topMin - b.topMin ||
        a.heightMin - b.heightMin
    )
}

/** 重なりクラスタごとに列へ振り分け、等幅で横に並べる */
function packIntervals(items: Item[]): TimedBlock[] {
  const blocks: TimedBlock[] = []
  let cluster: Item[] = []
  let clusterEnd = -1

  const flush = () => {
    if (cluster.length === 0) return
    const cols: number[] = []
    const colOf = new Map<Entry, number>()
    for (const b of cluster) {
      let placed = -1
      for (let i = 0; i < cols.length; i++) {
        if (b.topMin >= cols[i]!) {
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
      blocks.push({ ...b, left: col / n, width: 1 / n })
    }
    cluster = []
    clusterEnd = -1
  }

  // クラスタリングは開始位置順で行う
  const byStart = [...items].sort(
    (a, b) => a.topMin - b.topMin || a.heightMin - b.heightMin
  )
  for (const b of byStart) {
    if (cluster.length > 0 && b.topMin >= clusterEnd) flush()
    cluster.push(b)
    clusterEnd = Math.max(clusterEnd, b.topMin + b.heightMin)
  }
  flush()
  return blocks
}

/** その日の全 entries（終日=縦帯・時刻あり=時間帯）を配置 */
export function layoutDay(entries: Entry[], day: Date): TimedBlock[] {
  return packIntervals(buildItems(entries, day))
}
