import { addDays } from 'date-fns'
import { formatInTimeZone } from 'date-fns-tz'
import { jstLocalToIso } from './dates'
import { TZ } from './time'
import type { ParsedInbox, ParsedInboxItem } from '@/types/database'

// 端末内で日本語のつぶやきを解釈して予定候補にする（AI/課金なし）。
// 例:「9月11日、美容院の予定を13時から」「来週火曜10時に歯医者」「今日の10時からBBQ」

// 全角数字・記号を半角へ
function normalize(s: string): string {
  return s
    .replace(/[０-９]/g, (d) => String('０１２３４５６７８９'.indexOf(d)))
    .replace(/[：]/g, ':')
    .replace(/[〜～ー–]/g, '~')
}

const WEEKDAY: Record<string, number> = {
  日: 0, 月: 1, 火: 2, 水: 3, 木: 4, 金: 5, 土: 6,
}

const pad = (n: number) => String(n).padStart(2, '0')

export function parseNatural(text: string, now: Date = new Date()): ParsedInbox {
  const raw = text.trim()
  const s = normalize(raw)

  const todayStr = formatInTimeZone(now, TZ, 'yyyy-MM-dd')
  const [ty] = todayStr.split('-').map(Number)
  const todayNoon = new Date(jstLocalToIso(`${todayStr}T12:00`))
  const todayDow = Number(formatInTimeZone(todayNoon, TZ, 'i')) % 7 // 日=0..土=6

  const phrases: string[] = []
  let dateStr: string | null = null

  // ── 日付 ─────────────────────────────
  // 絶対日付: M月D日
  let m = s.match(/(\d{1,2})\s*月\s*(\d{1,2})\s*日/)
  if (!m) m = s.match(/(\d{1,2})\/(\d{1,2})/)
  if (m) {
    const mo = Number(m[1])
    const da = Number(m[2])
    if (mo >= 1 && mo <= 12 && da >= 1 && da <= 31) {
      let year = ty
      const cand = `${year}-${pad(mo)}-${pad(da)}`
      if (cand < todayStr) year += 1 // 過去日なら翌年とみなす
      dateStr = `${year}-${pad(mo)}-${pad(da)}`
      phrases.push(m[0])
    }
  }

  // 相対語: 今日/明日/明後日/昨日
  if (!dateStr) {
    const rel: Array<[RegExp, number]> = [
      [/明後日|あさって/, 2],
      [/明日|あした|あす/, 1],
      [/今日|本日|きょう/, 0],
      [/昨日|きのう/, -1],
    ]
    for (const [re, diff] of rel) {
      const mm = s.match(re)
      if (mm) {
        dateStr = formatInTimeZone(addDays(todayNoon, diff), TZ, 'yyyy-MM-dd')
        phrases.push(mm[0])
        break
      }
    }
  }

  // 曜日（来週/再来週/今週 の修飾つき）
  if (!dateStr) {
    const wm = s.match(/(来週|再来週|今週|次の?|今度の?)?\s*([日月火水木金土])曜?日?/)
    if (wm && WEEKDAY[wm[2]!] !== undefined) {
      const target = WEEKDAY[wm[2]!]!
      let diff = (target - todayDow + 7) % 7
      const mod = wm[1] ?? ''
      if (/来週|次/.test(mod)) diff += 7
      else if (/再来週/.test(mod)) diff += 14
      // 修飾なしで今日と同じ曜日 → 今日として扱う（diff=0）
      dateStr = formatInTimeZone(addDays(todayNoon, diff), TZ, 'yyyy-MM-dd')
      phrases.push(wm[0])
    }
  }

  // ── 時刻 ─────────────────────────────
  let startH: number | null = null
  let startM = 0
  let endH: number | null = null
  let endM = 0

  const ampm = (h: number): number => {
    if (/午後|夕方|夜/.test(s) && h < 12) return h + 12
    if (/午前|朝/.test(s) && h === 12) return 0
    return h
  }

  // 範囲: 10時〜12時 / 13:00-15:00 / 10時から12時
  const range = s.match(
    /(\d{1,2})\s*(?::(\d{2})|時\s*(半|(\d{1,2})\s*分)?)\s*(?:から|~|-)\s*(\d{1,2})\s*(?::(\d{2})|時\s*(半|(\d{1,2})\s*分)?)/
  )
  if (range) {
    startH = ampm(Number(range[1]))
    startM = range[2]
      ? Number(range[2])
      : range[3] === '半'
        ? 30
        : Number(range[4] ?? 0)
    endH = ampm(Number(range[5]))
    endM = range[6]
      ? Number(range[6])
      : range[7] === '半'
        ? 30
        : Number(range[8] ?? 0)
    phrases.push(range[0])
  } else {
    // 単一: 13時 / 13時半 / 13時30分 / 13:00 /（「から」がついても可）
    const single = s.match(/(\d{1,2})\s*(?::(\d{2})|時\s*(半|(\d{1,2})\s*分)?)/)
    if (single) {
      startH = ampm(Number(single[1]))
      startM = single[2]
        ? Number(single[2])
        : single[3] === '半'
          ? 30
          : Number(single[4] ?? 0)
      phrases.push(single[0])
    }
  }

  // ── 組み立て ─────────────────────────
  const hasTime = startH !== null
  // 日付も時刻も無ければ解釈不能
  if (!dateStr && !hasTime) {
    return {
      classification: 'unclear',
      items: [],
      memo: null,
      reason: '日付や時刻が見つかりませんでした。手動で予定にできます。',
    }
  }
  const day = dateStr ?? todayStr

  let startsIso: string
  let endsIso: string
  let allDay: boolean
  if (!hasTime) {
    allDay = true
    startsIso = jstLocalToIso(`${day}T00:00`)
    endsIso = new Date(new Date(startsIso).getTime() + 86400000).toISOString()
  } else {
    allDay = false
    if (startH! > 23) startH = 23
    startsIso = jstLocalToIso(`${day}T${pad(startH!)}:${pad(startM)}`)
    if (endH !== null) {
      let e = jstLocalToIso(`${day}T${pad(Math.min(endH, 23))}:${pad(endM)}`)
      if (new Date(e).getTime() <= new Date(startsIso).getTime()) {
        e = new Date(new Date(startsIso).getTime() + 3600000).toISOString()
      }
      endsIso = e
    } else {
      endsIso = new Date(new Date(startsIso).getTime() + 3600000).toISOString()
    }
  }

  // ── タイトル抽出（日時表現と助詞・定型句を除く） ──
  let title = normalize(raw)
  for (const p of phrases) title = title.replace(p, ' ')
  title = title
    .replace(/[、。「」『』（）()！!？?・:~-]/g, ' ')
    .replace(/(の)?予定(を|に)?/g, ' ')
    .replace(/(入れたい|いれたい|入れたく|入れて|いれて|入れる|したい|お願いします?|よろしく)/g, ' ')
    .replace(/(から|まで|ごろ|頃|くらい|ぐらい|あたり)/g, ' ')
    .replace(/(午前|午後|朝|夕方|夜)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    // 先頭・末尾に残った助詞を除去
    .replace(/^[のにはをがへとで\s]+/, '')
    .replace(/[のにはをがへとで\s]+$/, '')
    .trim()
  if (!title) title = '予定'

  const item: ParsedInboxItem = {
    title,
    kind: 'event',
    starts_at: startsIso,
    ends_at: endsIso,
    all_day: allDay,
    category_id: null,
    confidence: 0.6,
    source_phrase: phrases.join(' '),
  }

  return { classification: 'schedule', items: [item], memo: null, reason: '' }
}
