import { useState } from 'react'
import BottomSheet from './BottomSheet'
import {
  useCategories,
  useDeleteCategory,
  useUpsertCategory,
} from '@/hooks/useCategories'
import { GROUP_LABELS } from '@/hooks/useGroupFilter'
import { GROUP_COLORS } from '@/lib/palette'
import type { Category, GroupKey } from '@/types/database'

const GROUPS: GroupKey[] = ['work', 'family', 'personal']

export default function CategorySheet({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const { data: categories = [] } = useCategories()
  const upsert = useUpsertCategory()
  const del = useDeleteCategory()

  const [name, setName] = useState('')
  const [group, setGroup] = useState<GroupKey>('work')

  // 色は大分類で決まるため、大分類変更時に色も揃える
  async function cycleGroup(c: Category) {
    const order: GroupKey[] = ['work', 'family', 'personal']
    const next = order[(order.indexOf(c.group_key) + 1) % order.length]!
    await upsert.mutateAsync({
      id: c.id,
      name: c.name,
      group_key: next,
      color: GROUP_COLORS[next],
      sort_order: c.sort_order,
    })
  }

  async function rename(c: Category) {
    const newName = window.prompt('カテゴリ名を変更', c.name)
    if (!newName || !newName.trim() || newName.trim() === c.name) return
    await upsert.mutateAsync({
      id: c.id,
      name: newName.trim(),
      group_key: c.group_key,
      color: GROUP_COLORS[c.group_key],
      sort_order: c.sort_order,
    })
  }

  async function add() {
    if (!name.trim()) return
    await upsert.mutateAsync({
      name: name.trim(),
      group_key: group,
      color: GROUP_COLORS[group],
      sort_order: categories.length,
    })
    setName('')
  }

  return (
    <BottomSheet open={open} onClose={onClose} title="カテゴリ管理">
      <div className="flex flex-col gap-4">
        <p className="text-xs text-gray-500">
          色は大分類（Work / Family / Personal）ごとに自動で揃います。
        </p>
        <ul className="flex flex-col gap-1">
          {categories.map((c) => (
            <li
              key={c.id}
              className="flex items-center gap-2 rounded-lg border border-gray-100 px-2 py-2"
            >
              <span
                className="h-4 w-4 shrink-0 rounded-full"
                style={{ backgroundColor: GROUP_COLORS[c.group_key] }}
              />
              <button
                onClick={() => rename(c)}
                className="flex-1 text-left text-sm text-gray-800"
                title="タップで名前を変更"
              >
                {c.name}
              </button>
              <button
                onClick={() => cycleGroup(c)}
                className="rounded-full border border-gray-200 px-2 py-0.5 text-xs text-gray-500"
                title="タップで大分類を変更"
              >
                {GROUP_LABELS[c.group_key]} ▸
              </button>
              <button
                onClick={() => del.mutate(c.id)}
                className="min-h-tap px-2 text-sm text-red-500"
                aria-label="削除"
              >
                削除
              </button>
            </li>
          ))}
        </ul>

        <div className="rounded-lg bg-gray-50 p-3">
          <p className="mb-2 text-sm font-medium text-gray-700">
            中分類を追加
          </p>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="名前（例: A社）"
            className="min-h-tap mb-2 w-full rounded-lg border border-gray-300 px-3 text-base"
          />
          <div className="mb-3 flex gap-2">
            {GROUPS.map((g) => (
              <button
                key={g}
                onClick={() => setGroup(g)}
                className={
                  'min-h-tap flex-1 rounded-lg border text-sm ' +
                  (group === g
                    ? 'font-medium text-white'
                    : 'border-gray-300 text-gray-500')
                }
                style={
                  group === g
                    ? { backgroundColor: GROUP_COLORS[g], borderColor: GROUP_COLORS[g] }
                    : undefined
                }
              >
                {GROUP_LABELS[g]}
              </button>
            ))}
          </div>
          <button
            onClick={add}
            disabled={upsert.isPending}
            className="min-h-tap w-full rounded-lg bg-group-work font-medium text-white disabled:opacity-50"
          >
            追加
          </button>
        </div>
      </div>
    </BottomSheet>
  )
}
