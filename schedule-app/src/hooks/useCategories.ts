import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import type { Category, GroupKey } from '@/types/database'

import { GROUP_COLORS } from '@/lib/palette'

// 初回ログイン時に用意するデフォルトカテゴリ（各 group_key に1つずつ）
const DEFAULT_CATEGORIES: Array<Pick<Category, 'name' | 'group_key' | 'color'>> = [
  { name: '仕事', group_key: 'work', color: GROUP_COLORS.work },
  { name: '家族', group_key: 'family', color: GROUP_COLORS.family },
  { name: '個人', group_key: 'personal', color: GROUP_COLORS.personal },
]

export function useCategories() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['categories', user?.id],
    enabled: !!user,
    queryFn: async (): Promise<Category[]> => {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true })
      if (error) throw error

      // 空なら初回とみなしデフォルトを投入して取り直す
      if (!data || data.length === 0) {
        const rows = DEFAULT_CATEGORIES.map((c, i) => ({
          ...c,
          user_id: user!.id,
          sort_order: i,
        }))
        const { data: seeded, error: seedErr } = await supabase
          .from('categories')
          .insert(rows)
          .select('*')
        if (seedErr) throw seedErr
        return seeded ?? []
      }
      return data
    },
  })
}

export function useUpsertCategory() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (
      c: Partial<Category> & { name: string; group_key: GroupKey; color: string }
    ) => {
      const payload = { ...c, user_id: user!.id, sort_order: c.sort_order ?? 0 }
      const { error } = await supabase.from('categories').upsert(payload)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['categories'] }),
  })
}

export function useDeleteCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('categories').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['categories'] })
      qc.invalidateQueries({ queryKey: ['entries'] })
    },
  })
}
