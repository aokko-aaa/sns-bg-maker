import { useEffect, useState } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import BottomTabBar from '@/components/BottomTabBar'
import GroupFilterBar from '@/components/GroupFilterBar'
import CategorySheet from '@/components/CategorySheet'
import BulkAddSheet from '@/components/BulkAddSheet'
import BackgroundSheet from '@/components/BackgroundSheet'
import DayView from '@/pages/DayView'
import WeekView from '@/pages/WeekView'
import MonthView from '@/pages/MonthView'
import InboxView from '@/pages/InboxView'
import ReportView from '@/pages/ReportView'
import TimerBar from '@/components/TimerBar'
import Login from '@/pages/Login'
import { useAuth } from '@/hooks/useAuth'
import { applyBg, loadBg } from '@/lib/background'

const TITLES: Record<string, string> = {
  '/day': 'Daily',
  '/week': 'Weekly',
  '/month': 'Monthly',
  '/inbox': '音声入力',
  '/report': '稼働時間',
}

export default function App() {
  const { session, loading } = useAuth()
  const { pathname } = useLocation()
  const [catOpen, setCatOpen] = useState(false)
  const [bulkOpen, setBulkOpen] = useState(false)
  const [bgOpen, setBgOpen] = useState(false)

  // 保存済みの背景設定を適用
  useEffect(() => {
    applyBg(loadBg())
  }, [])

  const title = TITLES[pathname] ?? 'スケジュール'
  const showFilter = pathname !== '/inbox' && pathname !== '/report'

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-gray-400">
        読み込み中…
      </div>
    )
  }

  if (!session) return <Login />

  return (
    <>
      <div className="bg-layer" aria-hidden />
      <div className="relative z-10 mx-auto flex h-full max-w-md flex-col">
      <header className="pt-safe surface-translucent border-b border-white/40">
        <div className="flex items-center justify-between px-4 py-2">
          <h1 className="text-base font-bold text-gray-800">{title}</h1>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setBgOpen(true)}
              className="min-h-tap min-w-tap text-lg text-gray-500"
              aria-label="背景の設定"
              title="背景の設定"
            >
              🎨
            </button>
            <button
              onClick={() => setBulkOpen(true)}
              className="min-h-tap min-w-tap text-lg text-gray-500"
              aria-label="表から一括追加"
              title="表から一括追加"
            >
              📋
            </button>
            <button
              onClick={() => setCatOpen(true)}
              className="min-h-tap min-w-tap text-lg text-gray-500"
              aria-label="カテゴリ管理"
            >
              ⚙
            </button>
          </div>
        </div>
        {showFilter && <GroupFilterBar />}
      </header>

      <main className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
        <Routes>
          <Route path="/" element={<Navigate to="/day" replace />} />
          <Route path="/day" element={<DayView />} />
          <Route path="/week" element={<WeekView />} />
          <Route path="/month" element={<MonthView />} />
          <Route path="/inbox" element={<InboxView />} />
          <Route path="/report" element={<ReportView />} />
          <Route path="*" element={<Navigate to="/day" replace />} />
        </Routes>
      </main>

      <TimerBar />
      <BottomTabBar />

      <CategorySheet open={catOpen} onClose={() => setCatOpen(false)} />
      <BulkAddSheet open={bulkOpen} onClose={() => setBulkOpen(false)} />
      <BackgroundSheet open={bgOpen} onClose={() => setBgOpen(false)} />
      </div>
    </>
  )
}
