import { NavLink } from 'react-router-dom'
import Icon from './Icon'

// 設計原則 2-4: 片手操作前提。主要操作（画面切替）は画面下部に配置。
// icon が 'mic' などのときはオリジナルSVGアイコン、文字列は絵文字表示。
const TABS = [
  { to: '/day', label: '日', icon: '☀' },
  { to: '/week', label: '週', icon: '▤' },
  { to: '/month', label: '月', icon: '▦' },
  { to: '/report', label: '稼働', icon: '⏱' },
  { to: '/inbox', label: '音声入力', icon: 'mic' as const },
] as const

export default function BottomTabBar() {
  return (
    <nav className="pb-safe surface-translucent border-t border-white/40">
      <ul className="flex">
        {TABS.map((t) => (
          <li key={t.to} className="flex-1">
            <NavLink
              to={t.to}
              className={({ isActive }) =>
                [
                  'flex min-h-tap flex-col items-center justify-center gap-0.5 py-2 text-xs',
                  isActive ? 'text-group-work' : 'text-gray-500',
                ].join(' ')
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    className="flex h-[22px] items-center text-lg leading-none"
                    aria-hidden
                    style={{ opacity: isActive ? 1 : 0.6 }}
                  >
                    {t.icon === 'mic' ? (
                      <Icon name="mic" size={20} />
                    ) : (
                      t.icon
                    )}
                  </span>
                  <span>{t.label}</span>
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
