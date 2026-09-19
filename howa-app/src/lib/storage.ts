import type { Neta } from '../data/types'

const KEY = 'howa-app/saved/v1'

export type SavedNeta = {
  neta: Neta
  memo: string
  savedAt: string
  /** 保存したときの入力（どの気持ちから出たネタか） */
  fromEmotions: string[]
  fromText: string
}

function read(): SavedNeta[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as SavedNeta[]) : []
  } catch {
    return []
  }
}

function write(list: SavedNeta[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(list))
  } catch {
    // 容量オーバーやプライベートモードでは黙って諦める（生成自体は続けられる）
  }
}

export const savedStore = {
  list: read,
  add(item: SavedNeta): SavedNeta[] {
    const list = read()
    if (list.some((x) => x.neta.id === item.neta.id)) return list
    const next = [item, ...list]
    write(next)
    return next
  },
  remove(id: string): SavedNeta[] {
    const next = read().filter((x) => x.neta.id !== id)
    write(next)
    return next
  },
  updateMemo(id: string, memo: string): SavedNeta[] {
    const next = read().map((x) => (x.neta.id === id ? { ...x, memo } : x))
    write(next)
    return next
  },
}
