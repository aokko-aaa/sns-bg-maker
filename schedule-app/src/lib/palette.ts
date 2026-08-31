import type { GroupKey } from '@/types/database'

// アプリのアクセント色を1か所に集約（背景のパステル調に合わせたやわらかいトーン）。
// ここを変えると、フィルタ・レーン・デフォルトカテゴリ・ボタンの基調色が揃って変わる。
export const GROUP_COLORS: Record<GroupKey | 'other', string> = {
  work: '#5E97D0', // やわらかい青
  family: '#E58C74', // やわらかいコーラル
  personal: '#6FBF9B', // やわらかいミント
  other: '#A6AEBB', // グレー（未分類）
}

// 中分類ごとに選べる色。大分類のトーンに馴染む範囲でバリエーションを用意。
// work=青系 / family=暖色系 / personal=緑系（彩度・明度は既存トーンに合わせる）。
export const GROUP_SWATCHES: Record<GroupKey, string[]> = {
  // 青系: 明るさと色み（水色〜濃紺〜シアン〜青紫）で見分けやすく
  work: ['#8FC1E8', '#5E97D0', '#34659E', '#45B3C9', '#7C86E0', '#2F8FB8'],
  // 暖色系: 金〜コーラル〜テラコッタ〜ピンク〜ローズ〜ピーチ
  family: ['#F0B267', '#E58C74', '#D2604E', '#E4A0C0', '#C96C86', '#E8B98A'],
  // 緑系: ライム〜ミント〜エメラルド〜オリーブ〜青緑〜リーフ
  personal: ['#A7D98A', '#6FBF9B', '#3E9E7E', '#B7C95E', '#4FB0A6', '#86C579'],
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
