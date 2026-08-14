import { jstLocalToIso } from './dates'

export interface BulkRow {
  raw: string
  title: string
  starts_at: string
  ends_at: string
  all_day: boolean
}

export interface BulkParseResult {
  rows: BulkRow[]
  errors: string[] // 解析できなかった行
}

const pad = (n: number) => String(n).padStart(2, '0')
const normTime = (t: string) => {
  const [h, m] = t.split(':')
  return `${(h ?? '0').padStart(2, '0')}:${m ?? '00'}`
}

/**
 * 貼り付けテキストを1行ずつ予定に変換する。
 * 対応例:
 *   2026/08/17 08:30-12:00
 *   08/17 08:30-12:00        （年は fallbackYear）
 *   8月17日(月) 08:30 12:00
 *   2026/08/19               （時刻なし → 終日）
 *   08/20 09:00 会議          （末尾の残りをタイトルに）
 */
export function parseBulk(
  text: string,
  fallbackYear: number,
  defaultTitle: string
): BulkParseResult {
  const rows: BulkRow[] = []
  const errors: string[] = []

  for (const line of text.split('\n')) {
    const raw = line.trim()
    if (!raw) continue

    let y: number
    let mo: number
    let d: number
    let rest: string

    let m = raw.match(/^\s*(\d{4})[/.\-年](\d{1,2})[/.\-月](\d{1,2})/)
    if (m) {
      y = +m[1]
      mo = +m[2]
      d = +m[3]
      rest = raw.slice(m[0].length)
    } else {
      m = raw.match(/^\s*(\d{1,2})[/.\-月](\d{1,2})/)
      if (m) {
        y = fallbackYear
        mo = +m[1]
        d = +m[2]
        rest = raw.slice(m[0].length)
      } else {
        errors.push(raw)
        continue
      }
    }

    if (mo < 1 || mo > 12 || d < 1 || d > 31) {
      errors.push(raw)
      continue
    }

    // 曜日・「日」を除去
    rest = rest
      .replace(/^日/, '')
      .replace(/[（(]\s*[日月火水木金土]\s*[）)]/g, '')

    const times = rest.match(/\d{1,2}:\d{2}/g) ?? []
    const title =
      rest
        .replace(/\d{1,2}:\d{2}/g, '')
        .replace(/[-~〜–—:：、,\s]+/g, ' ')
        .trim() || defaultTitle

    const dateStr = `${y}-${pad(mo)}-${pad(d)}`

    if (times.length >= 1) {
      const startsIso = jstLocalToIso(`${dateStr}T${normTime(times[0]!)}`)
      let endsIso: string
      if (times.length >= 2) {
        endsIso = jstLocalToIso(`${dateStr}T${normTime(times[1]!)}`)
        if (new Date(endsIso) <= new Date(startsIso)) {
          endsIso = new Date(new Date(startsIso).getTime() + 3600000).toISOString()
        }
      } else {
        endsIso = new Date(new Date(startsIso).getTime() + 3600000).toISOString()
      }
      rows.push({ raw, title, starts_at: startsIso, ends_at: endsIso, all_day: false })
    } else {
      // 時刻なし → 終日
      const startsIso = jstLocalToIso(`${dateStr}T00:00`)
      const endsIso = new Date(new Date(startsIso).getTime() + 86400000).toISOString()
      rows.push({ raw, title, starts_at: startsIso, ends_at: endsIso, all_day: true })
    }
  }

  return { rows, errors }
}
