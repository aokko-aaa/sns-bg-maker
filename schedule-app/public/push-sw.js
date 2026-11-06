/* Web Push: 通知の表示とクリック遷移。生成SWに importScripts される。
   ローカル版では push は使われないため休眠状態（害なし）。 */
self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch (e) {
    data = { body: event.data && event.data.text ? event.data.text() : '' }
  }
  const title = data.title || 'MY SCHEDULE'
  const options = {
    body: data.body || '',
    data: { url: data.url || '/' },
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = (event.notification.data && event.notification.data.url) || '/'
  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      for (const c of all) {
        if ('focus' in c) return c.focus()
      }
      if (self.clients.openWindow) return self.clients.openWindow(url)
    })()
  )
})
