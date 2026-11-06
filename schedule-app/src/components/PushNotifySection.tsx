import { useEffect, useState } from 'react'
import { api } from '@/lib/apiClient'
import { enablePushNotifications } from '@/lib/webpushClient'

/** iPhone等に「明日のぶん」を通知する設定（Cloudflare版） */
export default function PushNotifySection() {
  const [prefs, setPrefs] = useState<{ enabled: boolean; notify_hour: number } | null>(null)
  const [subscribed, setSubscribed] = useState<boolean | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  useEffect(() => {
    api.push
      .getPrefs()
      .then(setPrefs)
      .catch(() => setPrefs({ enabled: true, notify_hour: 21 }))
    // 既に購読済みか（Service Worker）
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      navigator.serviceWorker.ready
        .then((reg) => reg.pushManager.getSubscription())
        .then((s) => setSubscribed(!!s))
        .catch(() => setSubscribed(false))
    } else {
      setSubscribed(false)
    }
  }, [])

  async function onEnable() {
    setBusy(true)
    setMsg(null)
    const r = await enablePushNotifications()
    setBusy(false)
    if (r.ok) {
      setSubscribed(true)
      setMsg('通知をオンにしました🔔')
    } else {
      const map: Record<string, string> = {
        unsupported: 'この端末/ブラウザは通知に未対応です。iPhoneはホーム画面に追加してから開いてください。',
        denied: '通知が許可されませんでした。端末の設定から許可してください。',
        'no-vapid-key': 'サーバー側の通知キーが未設定です（運営の設定待ち）。',
        error: '設定に失敗しました。',
      }
      setMsg(map[r.reason] ?? '設定に失敗しました。')
    }
  }

  const hour = prefs?.notify_hour ?? 21

  return (
    <section className="rounded-xl border border-group-work/20 bg-group-work/5 px-3 py-3">
      <div className="flex items-center gap-2">
        <span className="text-sm font-bold text-gray-800">🔔 iPhoneに通知</span>
        {subscribed && (
          <span className="rounded-full bg-group-work px-2 py-0.5 text-[10px] font-bold text-white">
            オン
          </span>
        )}
      </div>
      <p className="mt-1 text-xs text-gray-500">
        毎日、翌日の予定とやること（TODO）をスマホの通知でお届けします。
        <br />
        ※ iPhoneは「ホーム画面に追加」してから開いて、通知を許可してください。
      </p>

      {!subscribed ? (
        <button
          onClick={onEnable}
          disabled={busy}
          className="mt-3 min-h-tap w-full rounded-lg bg-group-work text-sm font-medium text-white disabled:opacity-50"
        >
          {busy ? '設定中…' : '通知をオンにする'}
        </button>
      ) : (
        <div className="mt-3 flex flex-col gap-2">
          <label className="flex items-center justify-between text-sm text-gray-700">
            通知を受け取る
            <input
              type="checkbox"
              checked={prefs?.enabled ?? true}
              onChange={async (e) => {
                const enabled = e.target.checked
                setPrefs((p) => (p ? { ...p, enabled } : p))
                await api.push.putPrefs({ enabled })
              }}
              className="h-5 w-5"
            />
          </label>
          <label className="flex items-center justify-between text-sm text-gray-700">
            送る時刻（毎日）
            <select
              value={hour}
              onChange={async (e) => {
                const notify_hour = Number(e.target.value)
                setPrefs((p) => (p ? { ...p, notify_hour } : p))
                await api.push.putPrefs({ notify_hour })
              }}
              className="min-h-tap rounded-lg border border-gray-300 px-2 text-sm"
            >
              {Array.from({ length: 24 }, (_, h) => (
                <option key={h} value={h}>
                  {h}:00
                </option>
              ))}
            </select>
          </label>
        </div>
      )}

      {msg && <p className="mt-2 text-xs text-gray-500">{msg}</p>}
    </section>
  )
}
