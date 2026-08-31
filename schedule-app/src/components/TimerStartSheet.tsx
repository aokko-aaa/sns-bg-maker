import { useState } from 'react'
import BottomSheet from './BottomSheet'
import { useCategories } from '@/hooks/useCategories'
import { useStartTimer } from '@/hooks/useTimeTracking'
import { GROUP_LABELS } from '@/hooks/useGroupFilter'
import type { GroupKey } from '@/types/database'

export default function TimerStartSheet({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const { data: categories = [] } = useCategories()
  const start = useStartTimer()
  const [label, setLabel] = useState('作業')
  const [categoryId, setCategoryId] = useState<string | null>(null)

  const field =
    'min-h-tap w-full rounded-lg border border-gray-300 px-3 text-base'

  async function onStart() {
    await start.mutateAsync({ label: label.trim() || '作業', category_id: categoryId })
    onClose()
  }

  return (
    <BottomSheet open={open} onClose={onClose} title="作業を計測する">
      <div className="flex flex-col gap-3">
        <label className="text-sm text-gray-600">
          作業内容
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="例: 資料作成"
            className={field + ' mt-1'}
          />
        </label>

        <label className="text-sm text-gray-600">
          分類（集計に使います・任意）
          <select
            value={categoryId ?? ''}
            onChange={(e) => setCategoryId(e.target.value || null)}
            className={field + ' mt-1'}
          >
            <option value="">（未分類）</option>
            {(['work', 'family', 'personal'] as GroupKey[]).map((g) => {
              const cs = categories.filter((c) => c.group_key === g)
              if (cs.length === 0) return null
              return (
                <optgroup key={g} label={GROUP_LABELS[g]}>
                  {cs.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </optgroup>
              )
            })}
          </select>
        </label>

        <button
          onClick={onStart}
          disabled={start.isPending}
          className="min-h-tap rounded-lg bg-group-work font-medium text-white disabled:opacity-40"
        >
          {start.isPending ? '開始中…' : '▶ 計測をはじめる'}
        </button>
      </div>
    </BottomSheet>
  )
}
