import { fromZonedTime } from 'date-fns-tz'
import { jstLocalToIso } from './dates'
import { TZ } from './time'
import type { BulkParseResult, BulkRow } from './parseBulk'

// Googleカレンダー等の .ics(iCalendar) を解析して予定に変換する。
// VEVENT の SUMMARY / DTSTART / DTEND を読み取り、BulkRow に落とす。

function unfold(text: string): string {
  // 折り返し行（改行 + 空白/タブ）を連結
  return text.replace(/\r?\n[ \t]/g, '')
}

function unescapeText(s: string): string {
  return s
    .replace(/\\n/gi, ' ')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\')
    .trim()
}

interface DateParts {
  dateOnly: boolean
  /** dateOnly のとき 'yyyy-MM-dd' */
  isoDate?: string
  /** 時刻ありのとき instant(ISO) */
  instant?: string
}

function parseIcsDate(value: string, params: Record<string, string>): DateParts | null {
  const v = value.trim()
  if (/^\d{8}$/.test(v) || params.VALUE === 'DATE') {
    const d = v.slice(0, 8)
    return { dateOnly: true, isoDate: `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}` }
  }
  const m = v.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z)?$/)
  if (!m) return null
  const [, Y, Mo, D, h, mi, s, z] = m
  const local = `${Y}-${Mo}-${D}T${h}:${mi}:${s}`
  if (z === 'Z') return { dateOnly: false, instant: new Date(`${local}Z`).toISOString() }
  const tz = params.TZID || TZ
  try {
    return { dateOnly: false, instant: fromZonedTime(local, tz).toISOString() }
  } catch {
    return { dateOnly: false, instant: fromZonedTime(local, TZ).toISOString() }
  }
}

/** 'DTSTART;TZID=Asia/Tokyo:20260817T083000' → {name, params, value} */
function splitLine(line: string) {
  const colon = line.indexOf(':')
  if (colon === -1) return null
  const left = line.slice(0, colon)
  const value = line.slice(colon + 1)
  const parts = left.split(';')
  const name = parts[0]!.toUpperCase()
  const params: Record<string, string> = {}
  for (const p of parts.slice(1)) {
    const eq = p.indexOf('=')
    if (eq > 0) params[p.slice(0, eq).toUpperCase()] = p.slice(eq + 1)
  }
  return { name, params, value }
}

export function parseIcs(text: string, defaultTitle: string): BulkParseResult {
  const rows: BulkRow[] = []
  const errors: string[] = []
  const lines = unfold(text).split(/\r?\n/)

  let cur: {
    summary?: string
    start?: DateParts | null
    end?: DateParts | null
  } | null = null

  for (const raw of lines) {
    const line = raw.trim()
    if (!line) continue
    if (/^BEGIN:VEVENT$/i.test(line)) {
      cur = {}
      continue
    }
    if (/^END:VEVENT$/i.test(line)) {
      if (cur) finalize(cur)
      cur = null
      continue
    }
    if (!cur) continue
    const parsed = splitLine(line)
    if (!parsed) continue
    if (parsed.name === 'SUMMARY') cur.summary = unescapeText(parsed.value)
    else if (parsed.name === 'DTSTART') cur.start = parseIcsDate(parsed.value, parsed.params)
    else if (parsed.name === 'DTEND') cur.end = parseIcsDate(parsed.value, parsed.params)
  }

  function finalize(ev: NonNullable<typeof cur>) {
    const title = ev.summary || defaultTitle || '予定'
    if (!ev.start) {
      errors.push(`${title}（開始日時が読めません）`)
      return
    }
    if (ev.start.dateOnly) {
      const startsIso = jstLocalToIso(`${ev.start.isoDate}T00:00`)
      // 終日: DTEND は「翌0:00(排他)」なのでそのまま終端に使える
      const endsIso = ev.end?.isoDate
        ? jstLocalToIso(`${ev.end.isoDate}T00:00`)
        : new Date(new Date(startsIso).getTime() + 86400000).toISOString()
      rows.push({ raw: title, title, starts_at: startsIso, ends_at: endsIso, all_day: true })
    } else {
      const startsIso = ev.start.instant!
      const endsIso =
        ev.end?.instant ??
        new Date(new Date(startsIso).getTime() + 3600000).toISOString()
      rows.push({ raw: title, title, starts_at: startsIso, ends_at: endsIso, all_day: false })
    }
  }

  return { rows, errors }
}
