import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase, LOCAL_MODE } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import type { LineLink } from '@/types/database'

// 紛らわしい文字を避けた合言葉（6桁）
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
function genCode(): string {
  let s = ''
  const buf = new Uint32Array(6)
  crypto.getRandomValues(buf)
  for (let i = 0; i < 6; i++) s += CODE_CHARS[buf[i] % CODE_CHARS.length]
  return s
}

/** 自分のLINE連携設定を取得（クラウド版のみ。ローカル版は常にnull） */
export function useLineLink() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['line_link', user?.id],
    enabled: !LOCAL_MODE && !!user,
    queryFn: async (): Promise<LineLink | null> => {
      const { data, error } = await supabase
        .from('line_links')
        .select('*')
        .maybeSingle()
      if (error) throw error
      return data ?? null
    },
  })
}

/** 未作成なら行を作り、合言葉を発行する（連携開始用） */
export function useStartLineLink() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (): Promise<string> => {
      const code = genCode()
      const { error } = await supabase.from('line_links').upsert(
        {
          user_id: user!.id,
          link_code: code,
          line_user_id: null,
          linked_at: null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      )
      if (error) throw error
      return code
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['line_link'] }),
  })
}

/** 通知のON/OFF・時刻を更新 */
export function useUpdateLineLink() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (patch: Partial<Pick<LineLink, 'enabled' | 'notify_hour'>>) => {
      const { error } = await supabase
        .from('line_links')
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq('user_id', user!.id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['line_link'] }),
  })
}

/** 連携を解除（LINE側は友だちのままだが、送信対象から外す） */
export function useUnlinkLine() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('line_links')
        .update({
          line_user_id: null,
          link_code: null,
          enabled: false,
          linked_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', user!.id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['line_link'] }),
  })
}
