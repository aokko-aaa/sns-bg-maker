import { isSupabaseConfigured } from '@/lib/supabase'

/**
 * Phase 0 用のプレースホルダ。各ビューの実装は後続フェーズで差し替える。
 *  - デイリー/データ基盤 → Phase 1
 *  - マンスリー → Phase 2
 *  - 受信箱 → Phase 3 / 音声 Phase 4
 *  - ウィークリーガント → Phase 5
 */
export default function Placeholder({
  title,
  phase,
}: {
  title: string
  phase: string
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
      <h2 className="text-xl font-bold text-gray-800">{title}</h2>
      <p className="text-sm text-gray-500">{phase} で実装します。</p>
      <span
        className={
          'rounded-full px-3 py-1 text-xs ' +
          (isSupabaseConfigured
            ? 'bg-green-100 text-green-700'
            : 'bg-amber-100 text-amber-700')
        }
      >
        Supabase: {isSupabaseConfigured ? '接続設定あり' : '未設定（.env を確認）'}
      </span>
    </div>
  )
}
