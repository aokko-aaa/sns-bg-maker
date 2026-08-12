import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { endOfDayJst, startOfDayJst } from '@/lib/dates'
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
