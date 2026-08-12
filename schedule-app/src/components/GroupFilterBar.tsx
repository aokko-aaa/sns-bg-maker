import { GROUP_LABELS, useGroupFilter } from '@/hooks/useGroupFilter'
import type { GroupKey } from '@/types/database'

const GROUP_COLORS: Record<GroupKey, string> = {
  work: '#4F86F7',
  family: '#F7845F',
  personal: '#5FC77E',
}

const ORDER: GroupKey[] = ['work', 'family', 'personal']

/** 3ビュー共通のカテゴリ（group_key）フィルタ。要件 5-5 */
export default function GroupFilterBar() {
  const { isActive, toggle } = useGroupFilter()
  return (
    <div className="flex gap-2 px-3 py-2">
      {ORDER.map((g) => {
        const on = isActive(g)
        return (
          <button
            key={g}
            onClick={() => toggle(g)}
            className="min-h-tap flex-1 rounded-full border px-3 text-sm font-medium transition-colors"
            style={{
              borderColor: GROUP_COLORS[g],
              backgroundColor: on ? GROUP_COLORS[g] : 'transparent',
              color: on ? '#fff' : GROUP_COLORS[g],
            }}
            aria-pressed={on}
          >
            {GROUP_LABELS[g]}
          </button>
        )
      })}
    </div>
  )
}
