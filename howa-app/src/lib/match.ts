import { EMOTIONS } from '../data/emotions'
import type { EmotionId } from '../data/types'

/** 自由記述から感情タグを推定する（選択済みの補助） */
export function detectEmotions(text: string): EmotionId[] {
  if (!text.trim()) return []
  const hits: { id: EmotionId; n: number }[] = []
  for (const e of EMOTIONS) {
    let n = 0
    for (const k of e.keywords) if (text.includes(k)) n++
    if (n > 0) hits.push({ id: e.id, n })
  }
  return hits
    .sort((a, b) => b.n - a.n)
    .slice(0, 4)
    .map((h) => h.id)
}

export type Ranked<T> = { item: T; score: number }

/**
 * 感情タグの一致を主、自由記述の語の一致を従として並べ替える。
 * スコアが0でも候補からは外さない（切り口の数を確保するため）。
 */
export function rankItems<T>(
  items: readonly T[],
  selected: readonly EmotionId[],
  text: string,
  getEmotions: (t: T) => readonly EmotionId[],
  getWords: (t: T) => readonly string[],
): Ranked<T>[] {
  const sel = new Set(selected)
  const body = text.trim()
  return items
    .map((item) => {
      let score = 0
      const tags = getEmotions(item)
      for (const t of tags) if (sel.has(t)) score += 3
      if (body) {
        for (const w of getWords(item)) {
          if (w && body.includes(w)) score += 2
        }
      }
      return { item, score }
    })
    .sort((a, b) => b.score - a.score)
}
