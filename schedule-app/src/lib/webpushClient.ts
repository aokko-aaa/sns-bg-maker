// iOS/PWAのWeb Push購読を有効化する（Phase 2のリマインド用）。
// 前提: アプリをホーム画面に追加（インストール済みPWA, iOS 16.4+）していること。
// 注意: 実際に通知を表示するには、Service Worker に 'push' / 'notificationclick'
//       ハンドラが必要（Phase 2で vite-plugin-pwa を injectManifest 化して追加）。
import { api } from './apiClient'

function urlB64ToUint8(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(b64)
  const out = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

export type PushEnableResult =
  | { ok: true }
  | { ok: false; reason: 'unsupported' | 'denied' | 'no-vapid-key' | 'error'; detail?: string }

export async function enablePushNotifications(): Promise<PushEnableResult> {
  try {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      return { ok: false, reason: 'unsupported' }
    }
    const perm = await Notification.requestPermission()
    if (perm !== 'granted') return { ok: false, reason: 'denied' }

    const { key } = await api.push.publicKey()
    if (!key) return { ok: false, reason: 'no-vapid-key' }

    const reg = await navigator.serviceWorker.ready
    const existing = await reg.pushManager.getSubscription()
    const sub =
      existing ??
      (await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlB64ToUint8(key) as unknown as BufferSource,
      }))

    const json = sub.toJSON()
    const p256dh = json.keys?.p256dh
    const auth = json.keys?.auth
    if (!p256dh || !auth) return { ok: false, reason: 'error', detail: 'no subscription keys' }

    await api.push.subscribe({ endpoint: sub.endpoint, keys: { p256dh, auth } })
    return { ok: true }
  } catch (e) {
    return { ok: false, reason: 'error', detail: e instanceof Error ? e.message : String(e) }
  }
}
