import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import BottomTabBar from '@/components/BottomTabBar'
import GroupFilterBar from '@/components/GroupFilterBar'
import Placeholder from '@/pages/Placeholder'
import { GroupFilterProvider } from '@/hooks/useGroupFilter'

const TITLES: Record<string, string> = {
  '/day': 'デイリー',
  '/week': 'ウィークリー',
  '/month': 'マンスリー',
  '/inbox': '受信箱',
}

export default function App() {
  const { pathname } = useLocation()
  const title = TITLES[pathname] ?? 'スケジュール'
  // 受信箱にはカテゴリ（group_key）フィルタは出さない（要件 5-5 は3ビュー対象）
  const showFilter = pathname !== '/inbox'

  return (
    <GroupFilterProvider>
      <div className="mx-auto flex h-full max-w-md flex-col bg-white">
        <header className="pt-safe border-b border-gray-200 bg-white">
          <h1 className="px-4 py-3 text-base font-bold text-gray-800">
            {title}
          </h1>
          {showFilter && <GroupFilterBar />}
        </header>

        <main className="flex flex-1 flex-col overflow-y-auto">
          <Routes>
            <Route path="/" element={<Navigate to="/day" replace />} />
            <Route
              path="/day"
              element={<Placeholder title="デイリー" phase="Phase 1" />}
            />
            <Route
              path="/week"
              element={<Placeholder title="ウィークリー（ガント）" phase="Phase 5" />}
            />
            <Route
              path="/month"
              element={<Placeholder title="マンスリー" phase="Phase 2" />}
            />
            <Route
              path="/inbox"
              element={<Placeholder title="受信箱" phase="Phase 3" />}
            />
            <Route path="*" element={<Navigate to="/day" replace />} />
          </Routes>
        </main>

        <BottomTabBar />
      </div>
    </GroupFilterProvider>
  )
}
