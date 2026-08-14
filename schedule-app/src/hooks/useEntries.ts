import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { formatInTimeZone } from 'date-fns-tz'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { endOfDayJst, jstLocalToIso, startOfDayJst } from '@/lib/dates'
import { TZ } from '@/lib/time'
import type { Entry } from '@/types/database'

export type EntryInput = Omit<
  Entry,
  'id' | 'user_id' | 'created_at' | 'updated_at'
> & { id?: string }

/** 指定した日にかかる entries を取得（開始がその日の終端より前で、終了がその日の開始より後） */
export function useEntriesForDay(day: Date) {
  const { user } = useAuth()
  const dayStart = startOfDayJst(day)
  const dayEnd = endOfDayJst(day)
  return useQuery({
    queryKey: ['entries', 'day', user?.id, dayStart.toISOString()],
    enabled: !!user,
    queryFn: async (): Promise<Entry[]> => {
      const { data, error } = await supabase
        .from('entries')
        .select('*')
        .lt('starts_at', dayEnd.toISOString())
        .gt('ends_at', dayStart.toISOString())
        .order('starts_at', { ascending: true })
      if (error) throw error
      return data ?? []
    },
  })
}

/** 指定期間 [start, end) にかかる entries を取得（月グリッド等の範囲取得用） */
export function useEntriesForRange(start: Date, end: Date) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['entries', 'range', user?.id, start.toISOString(), end.toISOString()],
    enabled: !!user,
    queryFn: async (): Promise<Entry[]> => {
      const { data, error } = await supabase
        .from('entries')
        .select('*')
        .lt('starts_at', end.toISOString())
        .gt('ends_at', start.toISOString())
        .order('starts_at', { ascending: true })
      if (error) throw error
      return data ?? []
    },
  })
}

export function useSaveEntry() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: EntryInput) => {
      const payload = {
        ...input,
        user_id: user!.id,
        updated_at: new Date().toISOString(),
      }
      const { error } = await supabase.from('entries').upsert(payload)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['entries'] }),
  })
}

export type BulkEntryInput = {
  title: string
  category_id: string | null
  kind: Entry['kind']
  starts_at: string
  ends_at: string
  all_day: boolean
}

/** 複数の予定をまとめて登録（貼り付け一括追加用） */
export function useBulkAddEntries() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (rows: BulkEntryInput[]) => {
      const payload = rows.map((r) => ({
        ...r,
        user_id: user!.id,
        progress: 0,
        notes: null,
        source: 'manual' as const,
        inbox_id: null,
      }))
      const { error } = await supabase.from('entries').insert(payload)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['entries'] }),
  })
}

/** 期限切れ（過去）で未完了のタスクを取得（持ち越し候補） */
export function useOverdueTasks() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['entries', 'overdue', user?.id],
    enabled: !!user,
    queryFn: async (): Promise<Entry[]> => {
      const todayStart = startOfDayJst(new Date()).toISOString()
      const { data, error } = await supabase
        .from('entries')
        .select('*')
        .eq('kind', 'task')
        .lt('progress', 100)
        .lt('ends_at', todayStart)
        .order('ends_at', { ascending: false })
        .limit(50)
      if (error) throw error
      return data ?? []
    },
  })
}

/** タスクを今日へ持ち越す（時刻・所要時間は維持、終日は今日の日付に） */
export function useCarryOverToday() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (e: Entry) => {
      const durMs =
        new Date(e.ends_at).getTime() - new Date(e.starts_at).getTime()
      const today = formatInTimeZone(new Date(), TZ, 'yyyy-MM-dd')
      const hhmm = e.all_day
        ? '00:00'
        : formatInTimeZone(new Date(e.starts_at), TZ, 'HH:mm')
      const startsIso = jstLocalToIso(`${today}T${hhmm}`)
      const endsIso = new Date(new Date(startsIso).getTime() + durMs).toISOString()
      const { error } = await supabase
        .from('entries')
        .update({
          starts_at: startsIso,
          ends_at: endsIso,
          updated_at: new Date().toISOString(),
        })
        .eq('id', e.id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['entries'] }),
  })
}

/** TODO のチェックリスト(notes)と完了率(progress)を更新する */
export function useUpdateChecklist() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (args: { id: string; notes: string; progress: number }) => {
      const { error } = await supabase
        .from('entries')
        .update({
          notes: args.notes,
          progress: args.progress,
          updated_at: new Date().toISOString(),
        })
        .eq('id', args.id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['entries'] }),
  })
}

/** TODO の完了/未完（progress 0↔100）を切り替える */
export function useSetProgress() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (args: { id: string; progress: number }) => {
      const { error } = await supabase
        .from('entries')
        .update({ progress: args.progress, updated_at: new Date().toISOString() })
        .eq('id', args.id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['entries'] }),
  })
}

export function useDeleteEntry() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('entries').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['entries'] }),
  })
}
