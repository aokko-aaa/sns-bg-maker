import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase, CF } from '@/lib/supabase'
import { api } from '@/lib/apiClient'
import { useAuth } from '@/hooks/useAuth'
import { parseNatural } from '@/lib/parseNatural'
import type { InboxItem, InboxStatus, InputType } from '@/types/database'

export function useInboxItems() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['inbox', user?.id],
    enabled: !!user,
    queryFn: async (): Promise<InboxItem[]> => {
      if (CF) return api.inbox.list()
      const { data, error } = await supabase
        .from('inbox_items')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      return data ?? []
    },
  })
}

export function useAddInbox() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (args: { raw_text: string; input_type?: InputType }) => {
      if (CF) {
        await api.inbox.create({ raw_text: args.raw_text, input_type: args.input_type })
        return
      }
      const { error } = await supabase.from('inbox_items').insert({
        user_id: user!.id,
        raw_text: args.raw_text,
        input_type: args.input_type ?? 'text',
        status: 'pending',
        parsed: null,
        parsed_at: null,
      })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['inbox'] }),
  })
}

/** Edge Function parse-inbox を呼び、解釈結果を保存する */
export function useParseInbox() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (inbox_id: string) => {
      const { data, error } = await supabase.functions.invoke('parse-inbox', {
        body: { inbox_id },
      })
      if (error) throw error
      if (data?.error) throw new Error(data.error)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['inbox'] }),
  })
}

/** 端末内の解釈エンジンで整理し、結果を保存する（AI/課金なし・オフライン可） */
export function useAutoParseInbox() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (args: { id: string; raw_text: string }) => {
      const parsed = parseNatural(args.raw_text)
      if (CF) {
        await api.inbox.patch(args.id, { parsed })
        return parsed
      }
      const { error } = await supabase
        .from('inbox_items')
        .update({ parsed, parsed_at: new Date().toISOString() })
        .eq('id', args.id)
      if (error) throw error
      return parsed
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['inbox'] }),
  })
}

export function useUpdateInboxStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (args: { id: string; status: InboxStatus }) => {
      if (CF) {
        await api.inbox.patch(args.id, { status: args.status })
        return
      }
      const { error } = await supabase
        .from('inbox_items')
        .update({ status: args.status })
        .eq('id', args.id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['inbox'] }),
  })
}

/** つぶやきを完全に削除（破棄用） */
export function useDeleteInbox() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      if (CF) {
        await api.inbox.remove(id)
        return
      }
      const { error } = await supabase.from('inbox_items').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['inbox'] }),
  })
}
