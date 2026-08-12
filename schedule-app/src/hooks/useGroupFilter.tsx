import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { GroupKey } from '@/types/database'

// 要件 5-5: group_key（仕事/家族/個人）のトグル。
// 選択状態はアプリ全体で共有し、画面を移動しても維持する。

const ALL_GROUPS: GroupKey[] = ['work', 'family', 'personal']

interface GroupFilterValue {
  /** 現在有効な group_key の集合。空でない前提（全部OFFにはしない） */
  active: GroupKey[]
  toggle: (g: GroupKey) => void
  isActive: (g: GroupKey) => boolean
}

const GroupFilterContext = createContext<GroupFilterValue | null>(null)

export function GroupFilterProvider({ children }: { children: ReactNode }) {
  const [active, setActive] = useState<GroupKey[]>(ALL_GROUPS)

  const toggle = useCallback((g: GroupKey) => {
    setActive((prev) => {
      const next = prev.includes(g)
        ? prev.filter((x) => x !== g)
        : [...prev, g]
      // 全部OFFは無意味なので、最後の1つは外させない
      return next.length === 0 ? prev : next
    })
  }, [])

  const value = useMemo<GroupFilterValue>(
    () => ({
      active,
      toggle,
      isActive: (g) => active.includes(g),
    }),
    [active, toggle]
  )

  return (
    <GroupFilterContext.Provider value={value}>
      {children}
    </GroupFilterContext.Provider>
  )
}

export function useGroupFilter(): GroupFilterValue {
  const ctx = useContext(GroupFilterContext)
  if (!ctx)
    throw new Error('useGroupFilter must be used within GroupFilterProvider')
  return ctx
}

export const GROUP_LABELS: Record<GroupKey, string> = {
  work: 'Work',
  family: 'Family',
  personal: 'Personal',
}
