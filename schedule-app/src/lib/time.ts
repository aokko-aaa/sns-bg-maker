import { formatInTimeZone } from 'date-fns-tz'

// 日付処理はタイムゾーン Asia/Tokyo 固定（技術スタックの規定）
export const TZ = 'Asia/Tokyo'

/** 現在時刻を ISO 8601 (+09:00) で返す。AI 解釈プロンプトに毎回渡す用（仕様 6-2） */
export function nowIsoJst(): string {
  return formatInTimeZone(new Date(), TZ, "yyyy-MM-dd'T'HH:mm:ssXXX")
}

const WEEKDAY_JA = ['日', '月', '火', '水', '木', '金', '土'] as const

/** 今日の曜日（日本語）。AI 解釈プロンプトに毎回渡す用（仕様 6-2） */
export function weekdayJa(date: Date = new Date()): string {
  const idx = Number(formatInTimeZone(date, TZ, 'i')) % 7 // 1(月)〜7(日)
  // date-fns 'i' は 1=月..7=日。JS getDay 準拠の配列に合わせて変換
  return WEEKDAY_JA[idx === 7 ? 0 : idx]
}
