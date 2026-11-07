import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './App'
import { AuthProvider } from './hooks/useAuth'
import { GroupFilterProvider } from './hooks/useGroupFilter'
import './index.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 30,
      refetchOnWindowFocus: false,
    },
  },
})

// 新しい版を公開したら、開いている画面も自動で新しい版に切り替える。
// - アプリを表に出したとき（スマホでホーム画面から開き直したときなど）に更新を確認
// - 新しい Service Worker が有効になったら、1回だけ再読み込み
if ('serviceWorker' in navigator) {
  // 初回インストール時（もともと SW が無い）は再読み込みしない
  const hadController = Boolean(navigator.serviceWorker.controller)
  let reloading = false
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || reloading) return
    reloading = true
    window.location.reload()
  })
  const checkUpdate = () => {
    navigator.serviceWorker
      .getRegistration()
      .then((reg) => reg?.update())
      .catch(() => {})
  }
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') checkUpdate()
  })
  // 開きっぱなしでも1時間ごとに確認
  window.setInterval(checkUpdate, 60 * 60 * 1000)
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <GroupFilterProvider>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </GroupFilterProvider>
      </AuthProvider>
    </QueryClientProvider>
  </React.StrictMode>
)
