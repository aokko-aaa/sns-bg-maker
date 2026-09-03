import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import type { TimeLog } from '@/types/database'

export type StartTimerInput = {
  label: string
  entry_id?: string | null
  category_id?: string | null
}

/** 現在計測中のログ（ended_at が null）。無ければ null。※後方互換の単数版。 */
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

/** 現在計測中のログすべて（同時計測に対応）。新しい順。 */
export function useRunningTimers() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['time_logs', 'running-all', user?.id],
    enabled: !!user,
    queryFn: async (): Promise<TimeLog[]> => {
      const { data, error } = await supabase
        .from('time_logs')
        .select('*')
        .is('ended_at', null)
        .order('started_at', { ascending: false })
      if (error) throw error
      return data ?? []
    },
  })
}

/** 計測開始。既存の計測は止めず、新しい計測を1つ追加（複数同時計測OK）。 */
export function useStartTimer() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: StartTimerInput) => {
      const nowIso = new Date().toISOString()
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

/** 計測停止。id 指定でその1件だけ、未指定なら走っている計測すべてを止める。 */
export function useStopTimer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id?: string) => {
      const nowIso = new Date().toISOString()
      const base = supabase.from('time_logs').update({ ended_at: nowIso })
      const { error } = id
        ? await base.eq('id', id)
        : await base.is('ended_at', null)
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
