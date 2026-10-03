import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase, LOCAL_MODE } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import type { ChatImportToken } from '@/types/database'

// 推測されにくい長めのトークン
function genToken(): string {
  const buf = new Uint8Array(24)
  crypto.getRandomValues(buf)
  return Array.from(buf, (b) => b.toString(16).padStart(2, '0')).join('')
}

/** 自分のチャット登録トークンを取得（クラウド版のみ） */
export function useChatImportToken() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['chat_import', user?.id],
    enabled: !LOCAL_MODE && !!user,
    queryFn: async (): Promise<ChatImportToken | null> => {
      const { data, error } = await supabase
        .from('chat_import_tokens')
        .select('*')
        .maybeSingle()
      if (error) throw error
      return data ?? null
    },
  })
}

/** トークンを発行（未作成なら作成、あれば作り直し） */
export function useGenerateChatToken() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (): Promise<string> => {
      const token = genToken()
      const { error } = await supabase.from('chat_import_tokens').upsert(
        {
          user_id: user!.id,
          token,
          enabled: true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      )
      if (error) throw error
      return token
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['chat_import'] }),
  })
}

/** 有効/無効の切り替え（無効にすると外部から登録できなくなる） */
export function useToggleChatImport() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (enabled: boolean) => {
      const { error } = await supabase
        .from('chat_import_tokens')
        .update({ enabled, updated_at: new Date().toISOString() })
        .eq('user_id', user!.id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['chat_import'] }),
  })
}
