import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import type { MonthlyGoal } from '@/types/database'

/** 指定月（'YYYY-MM'）の目標を取得。無ければ null。 */
export function useMonthlyGoal(month: string) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['monthly_goal', user?.id, month],
    enabled: !!user,
    queryFn: async (): Promise<MonthlyGoal | null> => {
      const { data, error } = await supabase
        .from('monthly_goals')
        .select('*')
        .eq('month', month)
        .limit(1)
      if (error) throw error
      return data?.[0] ?? null
    },
  })
}

/** 月の目標を保存（無ければ追加、あれば更新）。 */
export function useSaveMonthlyGoal() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (args: { id?: string; month: string; goal: string }) => {
      const nowIso = new Date().toISOString()
      if (args.id) {
        const { error } = await supabase
          .from('monthly_goals')
          .update({ goal: args.goal, updated_at: nowIso })
          .eq('id', args.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('monthly_goals').insert({
          user_id: user!.id,
          month: args.month,
          goal: args.goal,
          updated_at: nowIso,
        })
        if (error) throw error
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['monthly_goal'] }),
  })
}
