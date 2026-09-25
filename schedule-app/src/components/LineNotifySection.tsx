import { useState } from 'react'
import { LOCAL_MODE } from '@/lib/supabase'
import {
  useLineLink,
  useStartLineLink,
  useUpdateLineLink,
  useUnlinkLine,
} from '@/hooks/useLineLink'
import { errMessage } from '@/lib/errors'

// 任意: LINE公式アカウントの友だち追加URL（設定していれば「友だち追加」ボタンを出す）
const ADD_URL = import.meta.env.VITE_LINE_ADD_URL as string | undefined

/** LINEで「翌日の予定・やること」を毎晩受け取る設定（クラウド版のみ） */
export default function LineNotifySection() {
  const { data: link, isLoading, refetch, isFetching } = useLineLink()
  const start = useStartLineLink()
  const update = useUpdateLineLink()
  const unlink = useUnlinkLine()
  const [code, setCode] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  // ローカル版（端末内だけ）では通知サーバーが無いので使えない
  if (LOCAL_MODE) {
    return (
      <section className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-3">
        <div className="text-sm font-bold text-gray-700">🔔 LINEで翌日のお知らせ</div>
        <p className="mt-1 text-xs text-gray-500">
          この機能はクラウド版（ログインあり）でご利用いただけます。ローカル版は端末の中だけで動くため、
          自動送信はできません。
        </p>
      </section>
    )
  }

  const linked = !!link?.line_user_id
  const hour = link?.notify_hour ?? 21

  async function onStart() {
    setErr(null)
    try {
      const c = await start.mutateAsync()
      setCode(c)
    } catch (e) {
      setErr('連携の開始に失敗: ' + errMessage(e))
    }
  }

  return (
    <section className="rounded-xl border border-group-work/20 bg-group-work/5 px-3 py-3">
      <div className="flex items-center gap-2">
        <span className="text-sm font-bold text-gray-800">🔔 LINEで翌日のお知らせ</span>
        {linked && (
          <span className="rounded-full bg-group-work px-2 py-0.5 text-[10px] font-bold text-white">
            連携済み
          </span>
        )}
      </div>
      <p className="mt-1 text-xs text-gray-500">
        毎晩、翌日の予定とやること（TODO）をLINEに自動でお届けします。
      </p>

      {isLoading ? (
        <p className="mt-2 text-xs text-gray-400">読み込み中…</p>
      ) : linked ? (
        // ── 連携済み: ON/OFF・時刻・解除 ──
        <div className="mt-3 flex flex-col gap-2">
          <label className="flex items-center justify-between text-sm text-gray-700">
            通知を受け取る
            <input
              type="checkbox"
              checked={!!link?.enabled}
              onChange={(e) => update.mutate({ enabled: e.target.checked })}
              className="h-5 w-5"
            />
          </label>
          <label className="flex items-center justify-between text-sm text-gray-700">
            送る時刻（毎日）
            <select
              value={hour}
              onChange={(e) => update.mutate({ notify_hour: Number(e.target.value) })}
              className="min-h-tap rounded-lg border border-gray-300 px-2 text-sm"
            >
              {Array.from({ length: 24 }, (_, h) => (
                <option key={h} value={h}>
                  {h}:00
                </option>
              ))}
            </select>
          </label>
          <button
            onClick={() => {
              if (confirm('LINEへの通知を解除しますか？')) unlink.mutate()
            }}
            className="self-start text-xs text-red-500 underline"
          >
            連携を解除する
          </button>
        </div>
      ) : code ? (
        // ── 合言葉を表示して連携待ち ──
        <div className="mt-3 rounded-lg bg-white p-3">
          <p className="text-xs text-gray-600">
            ① LINEで公式アカウントを友だち追加 → ② 下の合言葉をトークに送信してください。
          </p>
          <div className="my-2 select-all text-center text-2xl font-bold tracking-[0.3em] text-group-work">
            {code}
          </div>
          {ADD_URL && (
            <a
              href={ADD_URL}
              target="_blank"
              rel="noopener"
              className="mb-2 block rounded-lg bg-[#06C755] py-2 text-center text-sm font-bold text-white"
            >
              LINEで友だち追加
            </a>
          )}
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="min-h-tap w-full rounded-lg border border-group-work text-sm font-medium text-group-work disabled:opacity-50"
          >
            {isFetching ? '確認中…' : '送信したら「更新」'}
          </button>
          <p className="mt-1 text-[11px] text-gray-400">
            送信後にここが「連携済み」になれば完了です。
          </p>
        </div>
      ) : (
        // ── 未連携: 開始 ──
        <button
          onClick={onStart}
          disabled={start.isPending}
          className="mt-3 min-h-tap w-full rounded-lg bg-group-work text-sm font-medium text-white disabled:opacity-50"
        >
          {start.isPending ? '準備中…' : 'LINE連携をはじめる'}
        </button>
      )}

      {err && <p className="mt-2 text-xs text-red-600">{err}</p>}
    </section>
  )
}
