import { useState } from 'react'
import BottomSheet from './BottomSheet'
import {
  useCategories,
  useDeleteCategory,
  useUpsertCategory,
} from '@/hooks/useCategories'
import { GROUP_LABELS } from '@/hooks/useGroupFilter'
import type { GroupKey } from '@/types/database'

const GROUPS: GroupKey[] = ['work', 'family', 'personal']
const PALETTE = ['#4F86F7', '#F7845F', '#5FC77E', '#B78BEA', '#F2C14E', '#EA6A8B']

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
  const [color, setColor] = useState(PALETTE[0])

  async function add() {
    if (!name.trim()) return
    await upsert.mutateAsync({
      name: name.trim(),
      group_key: group,
      color,
      sort_order: categories.length,
    })
    setName('')
  }

  return (
    <BottomSheet open={open} onClose={onClose} title="カテゴリ管理">
      <div className="flex flex-col gap-4">
        <ul className="flex flex-col gap-1">
          {categories.map((c) => (
            <li
              key={c.id}
              className="flex items-center gap-2 rounded-lg border border-gray-100 px-2 py-2"
            >
              <span
                className="h-4 w-4 shrink-0 rounded-full"
                style={{ backgroundColor: c.color }}
              />
              <span className="flex-1 text-sm text-gray-800">{c.name}</span>
              <span className="text-xs text-gray-400">
                {GROUP_LABELS[c.group_key]}
              </span>
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
          <p className="mb-2 text-sm font-medium text-gray-700">追加</p>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="カテゴリ名（例: クライアントA）"
            className="min-h-tap mb-2 w-full rounded-lg border border-gray-300 px-3 text-base"
          />
          <div className="mb-2 flex gap-2">
            {GROUPS.map((g) => (
              <button
                key={g}
                onClick={() => setGroup(g)}
                className={
                  'min-h-tap flex-1 rounded-lg border text-sm ' +
                  (group === g
                    ? 'border-group-work bg-group-work/10 font-medium text-group-work'
                    : 'border-gray-300 text-gray-500')
                }
              >
                {GROUP_LABELS[g]}
              </button>
            ))}
          </div>
          <div className="mb-3 flex gap-2">
            {PALETTE.map((p) => (
              <button
                key={p}
                onClick={() => setColor(p)}
                className="h-8 w-8 rounded-full"
                style={{
                  backgroundColor: p,
                  outline: color === p ? '2px solid #333' : 'none',
                  outlineOffset: 2,
                }}
                aria-label={`色 ${p}`}
              />
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
