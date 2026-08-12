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

export { addDays, toZonedTime }
