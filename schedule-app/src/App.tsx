import { useState } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import BottomTabBar from '@/components/BottomTabBar'
import GroupFilterBar from '@/components/GroupFilterBar'
import CategorySheet from '@/components/CategorySheet'
import Placeholder from '@/pages/Placeholder'
import DayView from '@/pages/DayView'
import MonthView from '@/pages/MonthView'
import Login from '@/pages/Login'
import { useAuth } from '@/hooks/useAuth'

const TITLES: Record<string, string> = {
  '/day': 'デイリー',
  '/week': 'ウィークリー',
  '/month': 'マンスリー',
  '/inbox': '受信箱',
}

export default function App() {
  const { session, loading } = useAuth()
  const { pathname } = useLocation()
  const [catOpen, setCatOpen] = useState(false)

  const title = TITLES[pathname] ?? 'スケジュール'
  const showFilter = pathname !== '/inbox'

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-gray-400">
        読み込み中…
      </div>
    )
  }

  if (!session) return <Login />

  return (
    <div className="relative mx-auto flex h-full max-w-md flex-col bg-white">
      <header className="pt-safe border-b border-gray-200 bg-white">
        <div className="flex items-center justify-between px-4 py-3">
          <h1 className="text-base font-bold text-gray-800">{title}</h1>
          <button
            onClick={() => setCatOpen(true)}
            className="min-h-tap min-w-tap text-lg text-gray-500"
            aria-label="カテゴリ管理"
          >
            ⚙
          </button>
        </div>
        {showFilter && <GroupFilterBar />}
      </header>

      <main className="relative flex flex-1 flex-col overflow-hidden">
        <Routes>
          <Route path="/" element={<Navigate to="/day" replace />} />
          <Route path="/day" element={<DayView />} />
          <Route
            path="/week"
            element={<Placeholder title="ウィークリー（ガント）" phase="Phase 5" />}
          />
          <Route path="/month" element={<MonthView />} />
          <Route
            path="/inbox"
            element={<Placeholder title="受信箱" phase="Phase 3" />}
          />
          <Route path="*" element={<Navigate to="/day" replace />} />
        </Routes>
      </main>

      <BottomTabBar />

      <CategorySheet open={catOpen} onClose={() => setCatOpen(false)} />
    </div>
  )
}
