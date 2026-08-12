import { formatInTimeZone, fromZonedTime, toZonedTime } from 'date-fns-tz'
import { addDays } from 'date-fns'
import { TZ } from './time'

// すべて Asia/Tokyo 固定で計算する（技術スタックの規定）。
// マシンのタイムゾーンに依存しないよう、date-fns-tz で「その瞬間(instant)」に変換して扱う。

/** 'yyyy-MM-dd'（JST基準の日付キー） */
export function dayKey(d: Date): string {
  return formatInTimeZone(d, TZ, 'yyyy-MM-dd')
}

/** JST のその日の 0:00 の instant（Date） */
export function startOfDayJst(d: Date): Date {
  return fromZonedTime(`${dayKey(d)}T00:00:00`, TZ)
}

/** JST のその日の翌日 0:00 の instant（= その日の終端） */
export function endOfDayJst(d: Date): Date {
  return addDays(startOfDayJst(d), 1)
}

/** datetime-local の値（JSTの壁時計時刻）を instant(ISO) に変換 */
export function jstLocalToIso(localValue: string): string {
  // localValue 例: '2026-08-19T10:00'
  return fromZonedTime(localValue, TZ).toISOString()
}

/** instant(ISO) を datetime-local 用の JST 壁時計文字列に変換 */
export function isoToJstLocal(iso: string): string {
  return formatInTimeZone(new Date(iso), TZ, "yyyy-MM-dd'T'HH:mm")
}

/** 表示用: 'HH:mm'（JST） */
export function fmtHm(iso: string): string {
  return formatInTimeZone(new Date(iso), TZ, 'HH:mm')
}

/** 表示用: 'M月d日(曜)'（JST） */
export function fmtDateLabel(d: Date): string {
  const w = ['日', '月', '火', '水', '木', '金', '土'][Number(formatInTimeZone(d, TZ, 'c')) - 1]
  return `${formatInTimeZone(d, TZ, 'M月d日')}(${w})`
}

/** JST の壁時計での「0:00からの経過分」。範囲外は 0..1440 にクランプ */
export function minutesFromDayStart(iso: string, day: Date): number {
  const start = startOfDayJst(day).getTime()
  const m = (new Date(iso).getTime() - start) / 60000
  return Math.max(0, Math.min(1440, m))
}

/** 月グリッド（日曜始まりの6週=42セル）。JST基準の日付キーで組み立てる */
export function monthGrid(anchor: Date): Array<{
  key: string
  date: Date
  inMonth: boolean
}> {
  const ym = formatInTimeZone(anchor, TZ, 'yyyy-MM')
  const first = fromZonedTime(`${ym}-01T00:00:00`, TZ)
  const firstDow = Number(formatInTimeZone(first, TZ, 'c')) % 7 // 0=日..6=土
  const gridStart = addDays(first, -firstDow)
  return Array.from({ length: 42 }, (_, i) => {
    const date = addDays(gridStart, i)
    return {
      key: dayKey(date),
      date,
      inMonth: formatInTimeZone(date, TZ, 'yyyy-MM') === ym,
    }
  })
}

/** 表示用: 'yyyy年M月' */
export function fmtMonthLabel(d: Date): string {
  return formatInTimeZone(d, TZ, 'yyyy年M月')
}

/** entry がその日(JST)にかかっているか */
export function entryOverlapsDay(
  startsAt: string,
  endsAt: string,
  day: Date
): boolean {
  const ds = startOfDayJst(day).getTime()
  const de = endOfDayJst(day).getTime()
  return new Date(startsAt).getTime() < de && new Date(endsAt).getTime() > ds
}

/** その週の日曜0:00(JST)の instant */
export function startOfWeekJst(d: Date): Date {
  const dow = Number(formatInTimeZone(d, TZ, 'c')) % 7 // 0=日..6=土
  return addDays(startOfDayJst(d), -dow)
}

/** その週の7日分の Date（日曜始まり） */
export function weekDays(anchor: Date): Date[] {
  const s = startOfWeekJst(anchor)
  return Array.from({ length: 7 }, (_, i) => addDays(s, i))
}

/** 表示用: 'M/d'（JST） */
export function fmtMd(d: Date): string {
  return formatInTimeZone(d, TZ, 'M/d')
}

/** 月を加算した Date（JST基準） */
export function addMonths(d: Date, n: number): Date {
  const ym = formatInTimeZone(d, TZ, 'yyyy-MM')
  const [y, m] = ym.split('-').map(Number)
  const total = (y * 12 + (m - 1)) + n
  const ny = Math.floor(total / 12)
  const nm = (total % 12) + 1
  return fromZonedTime(`${ny}-${String(nm).padStart(2, '0')}-01T00:00:00`, TZ)
}

export { addDays, toZonedTime }
