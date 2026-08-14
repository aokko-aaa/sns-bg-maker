// TODO(kind='task')のチェックリストを entries.notes に保存する。
// 1行1項目。完了は先頭に [x]、未完は [ ]。（DBスキーマ変更なしで実現）

export interface ChecklistItem {
  text: string
  done: boolean
}

export function parseChecklist(notes: string | null | undefined): ChecklistItem[] {
  if (!notes) return []
  const out: ChecklistItem[] = []
  for (const line of notes.split('\n')) {
    const m = line.match(/^\s*\[( |x|X)\]\s?(.*)$/)
    if (m) {
      out.push({ done: m[1]!.toLowerCase() === 'x', text: m[2]! })
    } else {
      const t = line.trim()
      if (t) out.push({ done: false, text: t })
    }
  }
  return out
}

export function serializeChecklist(items: ChecklistItem[]): string {
  return items
    .filter((i) => i.text.trim())
    .map((i) => `[${i.done ? 'x' : ' '}] ${i.text.trim()}`)
    .join('\n')
}

/** 完了率(0-100)。項目が無ければ 0 */
export function checklistProgress(items: ChecklistItem[]): number {
  const valid = items.filter((i) => i.text.trim())
  if (valid.length === 0) return 0
  const done = valid.filter((i) => i.done).length
  return Math.round((done / valid.length) * 100)
}
