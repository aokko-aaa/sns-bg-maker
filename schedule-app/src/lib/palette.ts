import type { GroupKey } from '@/types/database'

// アプリのアクセント色を1か所に集約（背景のパステル調に合わせたやわらかいトーン）。
// ここを変えると、フィルタ・レーン・デフォルトカテゴリ・ボタンの基調色が揃って変わる。
export const GROUP_COLORS: Record<GroupKey | 'other', string> = {
  work: '#5E97D0', // やわらかい青
  family: '#E58C74', // やわらかいコーラル
  personal: '#6FBF9B', // やわらかいミント
  other: '#A6AEBB', // グレー（未分類）
}

// カテゴリ追加時に選べる色（背景のトーンに寄せたパステル）
export const CATEGORY_PALETTE = [
  '#5E97D0', // 青
  '#E58C74', // コーラル
  '#6FBF9B', // ミント
  '#A99BDD', // ラベンダー
  '#E8C56A', // イエロー
  '#7FC7D6', // アクア
]

/** 背景色に対して読みやすい文字色（白 or 濃色）を返す */
export function contrastText(hex: string): string {
  const h = hex.replace('#', '')
  if (h.length < 6) return '#ffffff'
  const r = parseInt(h.slice(0, 2), 16) / 255
  const g = parseInt(h.slice(2, 4), 16) / 255
  const b = parseInt(h.slice(4, 6), 16) / 255
  const lin = (c: number) =>
    c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  const L = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
  // 明るい色には濃色、暗い色には白
  return L > 0.55 ? '#26374d' : '#ffffff'
}
