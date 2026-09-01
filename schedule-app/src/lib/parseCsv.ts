import { jstLocalToIso } from './dates'
import type { BulkParseResult, BulkRow } from './parseBulk'

const pad = (n: number) => String(n).padStart(2, '0')
const normTime = (t: string) => {
  const [h, m] = t.split(':')
  return `${(h ?? '0').padStart(2, '0')}:${m ?? '00'}`
}

/**
 * CSV/TSVの1行をセルに分割する（簡易ダブルクオート対応）。
 * タブがあればタブ区切り、無ければカンマ区切り。
 */
function splitCells(line: string): string[] {
  const delim = line.includes('\t') ? '\t' : ','
  const cells: string[] = []
  let cur = ''
  let inQ = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQ) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"'
          i++
        } else inQ = false
      } else cur += ch
    } else if (ch === '"') {
      inQ = true
    } else if (ch === delim) {
      cells.push(cur)
      cur = ''
    } else {
      cur += ch
    }
  }
  cells.push(cur)
  return cells.map((c) => c.trim())
}

function parseDate(
  cell: string,
  fallbackYear: number
): { y: number; mo: number; d: number } | null {
  let m = cell.match(/^(\d{4})[/.\-年](\d{1,2})[/.\-月](\d{1,2})/)
  if (m) return { y: +m[1], mo: +m[2], d: +m[3] }
  m = cell.match(/^(\d{1,2})[/.\-月](\d{1,2})/)
  if (m) return { y: fallbackYear, mo: +m[1], d: +m[2] }
  return null
}

// ヘッダー行らしさ（先頭が日付でなく、見出しっぽい語を含む）
const HEADER_HINT = /日付|date|開始|start|終了|end|title|タイトル|件名|予定/i

/**
 * CSV / TSV を予定に変換する。
 * 想定フォーマット（ヘッダー行はあってもなくてもOK）:
 *   日付, 開始, 終了, タイトル
 *   2026/08/17, 08:30, 12:00, 会議
 *   2026/08/18, , , お休み          ← 時刻なしは終日
 *   08/20, 09:00, , 打合せ          ← 年は fallbackYear、終了省略で+1h
 * 列の順番は「日付が先頭」だけ守ればよく、時刻(HH:MM)以外の余りはタイトル扱い。
 */
export function parseCsv(
  text: string,
  fallbackYear: number,
  defaultTitle: string
): BulkParseResult {
  const rows: BulkRow[] = []
  const errors: string[] = []
  let seenData = false

  for (const line of text.split('\n')) {
    const raw = line.trim()
    if (!raw) continue

    const cells = splitCells(raw)
    const dt = parseDate(cells[0] ?? '', fallbackYear)
    if (!dt) {
      // まだデータ行を1件も読んでおらず、見出しっぽければヘッダーとして黙って飛ばす
      if (!seenData && HEADER_HINT.test(raw)) continue
      errors.push(raw)
      continue
    }
    if (dt.mo < 1 || dt.mo > 12 || dt.d < 1 || dt.d > 31) {
      errors.push(raw)
      continue
    }
    seenData = true

    const dateStr = `${dt.y}-${pad(dt.mo)}-${pad(dt.d)}`
    // 2列目以降をまとめて解釈: HH:MM を時刻、残りをタイトルに
    const rest = cells.slice(1).join(' ')
    const times = rest.match(/\d{1,2}:\d{2}/g) ?? []
    const title =
      rest
        .replace(/\d{1,2}:\d{2}/g, '')
        .replace(/[-~〜–—:：]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim() || defaultTitle

    if (times.length >= 1) {
      const startsIso = jstLocalToIso(`${dateStr}T${normTime(times[0]!)}`)
      let endsIso: string
      if (times.length >= 2) {
        endsIso = jstLocalToIso(`${dateStr}T${normTime(times[1]!)}`)
        if (new Date(endsIso) <= new Date(startsIso)) {
          endsIso = new Date(
            new Date(startsIso).getTime() + 3600000
          ).toISOString()
        }
      } else {
        endsIso = new Date(new Date(startsIso).getTime() + 3600000).toISOString()
      }
      rows.push({ raw, title, starts_at: startsIso, ends_at: endsIso, all_day: false })
    } else {
      const startsIso = jstLocalToIso(`${dateStr}T00:00`)
      const endsIso = new Date(
        new Date(startsIso).getTime() + 86400000
      ).toISOString()
      rows.push({ raw, title, starts_at: startsIso, ends_at: endsIso, all_day: true })
    }
  }

  return { rows, errors }
}
