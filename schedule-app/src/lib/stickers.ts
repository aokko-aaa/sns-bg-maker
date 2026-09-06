// 予定に貼る「付箋（ひとことメモ）」。予定ID -> テキスト を端末内 localStorage に保存。
// DB スキーマを変えずに使えるよう、エントリ本体とは別管理（端末ごと）。
import { useSyncExternalStore } from 'react'

const KEY = 'entry-stickers'
type StickerMap = Record<string, string>

function load(): StickerMap {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '{}') as StickerMap
  } catch {
    return {}
  }
}

let cache: StickerMap = load()
const subs = new Set<() => void>()

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(cache))
  } catch {
    /* 容量超過などは無視 */
  }
}

export function getStickerMap(): StickerMap {
  return cache
}

export function getSticker(id: string): string {
  return cache[id] ?? ''
}

/** 付箋を設定（空文字なら削除） */
export function setSticker(id: string, text: string) {
  const t = text.trim()
  if (t) {
    cache = { ...cache, [id]: t }
  } else {
    const { [id]: _omit, ...rest } = cache
    cache = rest
  }
  persist()
  subs.forEach((f) => f())
}

function subscribe(f: () => void) {
  subs.add(f)
  return () => {
    subs.delete(f)
  }
}

/** 付箋マップを購読して再描画に反映するフック */
export function useStickerMap(): StickerMap {
  return useSyncExternalStore(subscribe, getStickerMap, getStickerMap)
}
