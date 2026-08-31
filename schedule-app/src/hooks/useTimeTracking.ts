import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import type { TimeLog } from '@/types/database'

export type StartTimerInput = {
  label: string
  entry_id?: string | null
  category_id?: string | null
}

/** 現在計測中のログ（ended_at が null）。無ければ null。 */
export function useRunningTimer() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['time_logs', 'running', user?.id],
    enabled: !!user,
    queryFn: async (): Promise<TimeLog | null> => {
      const { data, error } = await supabase
        .from('time_logs')
        .select('*')
        .is('ended_at', null)
        .order('started_at', { ascending: false })
        .limit(1)
      if (error) throw error
      return data?.[0] ?? null
    },
  })
}

/** 計測開始。既に計測中のものがあれば止めてから新規に開始（同時に1つだけ）。 */
export function useStartTimer() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: StartTimerInput) => {
      const nowIso = new Date().toISOString()
      // 走っている計測を止める
      await supabase
        .from('time_logs')
        .update({ ended_at: nowIso })
        .is('ended_at', null)
      const { error } = await supabase.from('time_logs').insert({
        user_id: user!.id,
        label: input.label || '作業',
        entry_id: input.entry_id ?? null,
        category_id: input.category_id ?? null,
        started_at: nowIso,
        ended_at: null,
      })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['time_logs'] }),
  })
}

/** 計測停止（走っている計測すべてに終了時刻を入れる）。 */
export function useStopTimer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const nowIso = new Date().toISOString()
      const { error } = await supabase
        .from('time_logs')
        .update({ ended_at: nowIso })
        .is('ended_at', null)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['time_logs'] }),
  })
}

/** 指定期間 [start, end) に開始したログを取得（レポート用）。 */
export function useTimeLogsInRange(start: Date, end: Date) {
  const { user } = useAuth()
  const startIso = start.toISOString()
  const endIso = end.toISOString()
  return useQuery({
    queryKey: ['time_logs', 'range', user?.id, startIso, endIso],
    enabled: !!user,
    queryFn: async (): Promise<TimeLog[]> => {
      const { data, error } = await supabase
        .from('time_logs')
        .select('*')
        .gte('started_at', startIso)
        .lt('started_at', endIso)
        .order('started_at', { ascending: false })
      if (error) throw error
      return data ?? []
    },
  })
}

/** 1件のログを削除（記録の修正用）。 */
export function useDeleteTimeLog() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('time_logs').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['time_logs'] }),
  })
}
