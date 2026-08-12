import { useEffect, useMemo, useRef, useState } from 'react'
import { useEntriesForDay } from '@/hooks/useEntries'
import { useCategories } from '@/hooks/useCategories'
import { useGroupFilter } from '@/hooks/useGroupFilter'
import {
  addDays,
  fmtDateLabel,
  fmtHm,
  isoToJstLocal,
  minutesFromDayStart,
} from '@/lib/dates'
import { isBandEntry, layoutTimed } from '@/lib/dayLayout'
import EntrySheet from '@/components/EntrySheet'
import type { Category, Entry } from '@/types/database'

const HOUR_H = 60 // 1時間の高さ(px)
const START_HOUR = 6 // 初期スクロール位置

export default function DayView() {
  const [day, setDay] = useState(() => new Date())
  const [nowMin, setNowMin] = useState(() => minutesFromDayStart(new Date().toISOString(), new Date()))
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editing, setEditing] = useState<Entry | null>(null)
  const [defaultStart, setDefaultStart] = useState<string | undefined>()

  const scrollRef = useRef<HTMLDivElement>(null)
  const touchX = useRef<number | null>(null)

  const { data: entries = [], isLoading } = useEntriesForDay(day)
  const { data: categories = [] } = useCategories()
  const { active } = useGroupFilter()

  const catMap = useMemo(() => {
    const m = new Map<string, Category>()
    categories.forEach((c) => m.set(c.id, c))
    return m
  }, [categories])

  // group_key フィルタ（未分類は常に表示）
  const visible = useMemo(
    () =>
      entries.filter((e) => {
        if (!e.category_id) return true
        const g = catMap.get(e.category_id)?.group_key
        return !g || active.includes(g)
      }),
    [entries, catMap, active]
  )

  const bandEntries = visible.filter((e) => isBandEntry(e, day))
  const blocks = useMemo(() => layoutTimed(visible, day), [visible, day])

  // 初期スクロールを 6:00 に
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = START_HOUR * HOUR_H
  }, [])

  // 現在時刻の線を更新（1分ごと）
  useEffect(() => {
    const t = setInterval(
      () => setNowMin(minutesFromDayStart(new Date().toISOString(), new Date())),
      60_000
    )
    return () => clearInterval(t)
  }, [])

  const isToday = fmtDateLabel(day) === fmtDateLabel(new Date())

  const colorOf = (e: Entry) =>
    (e.category_id && catMap.get(e.category_id)?.color) || '#9AA5B1'

  function openNew(atMin?: number) {
    let d = new Date(day)
    if (atMin != null) {
      const h = Math.floor(atMin / 60)
      const m = Math.floor((atMin % 60) / 15) * 15
      const iso = isoToJstLocal(day.toISOString()).slice(0, 11)
      setDefaultStart(`${iso}${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`)
    } else {
      setDefaultStart(isoToJstLocal(d.toISOString()))
    }
    setEditing(null)
    setSheetOpen(true)
  }

  function openEdit(e: Entry) {
    setEditing(e)
    setDefaultStart(undefined)
    setSheetOpen(true)
  }

  return (
    <div
      className="flex flex-1 flex-col"
      onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
      onTouchEnd={(e) => {
        if (touchX.current == null) return
        const dx = e.changedTouches[0].clientX - touchX.current
        if (dx > 60) setDay((d) => addDays(d, -1))
        else if (dx < -60) setDay((d) => addDays(d, 1))
        touchX.current = null
      }}
    >
      {/* 日付ナビ */}
      <div className="flex items-center justify-between border-b border-gray-100 px-3 py-2">
        <button
          onClick={() => setDay((d) => addDays(d, -1))}
          className="min-h-tap min-w-tap text-gray-500"
          aria-label="前日"
        >
          ‹
        </button>
        <button
          onClick={() => setDay(new Date())}
          className="text-sm font-bold text-gray-800"
        >
          {fmtDateLabel(day)}
          {isToday && <span className="ml-1 text-xs text-group-work">今日</span>}
        </button>
        <button
          onClick={() => setDay((d) => addDays(d, 1))}
          className="min-h-tap min-w-tap text-gray-500"
          aria-label="翌日"
        >
          ›
        </button>
      </div>

      {/* 終日・日またぎの帯 */}
      {bandEntries.length > 0 && (
        <div className="flex flex-col gap-1 border-b border-gray-100 bg-gray-50 px-2 py-1">
          {bandEntries.map((e) => (
            <button
              key={e.id}
              onClick={() => openEdit(e)}
              className="truncate rounded px-2 py-1 text-left text-xs text-white"
              style={{ backgroundColor: colorOf(e) }}
            >
              {e.all_day ? '終日' : '期間'}・{e.title}
            </button>
          ))}
        </div>
      )}

      {/* 時刻軸 */}
      <div ref={scrollRef} className="relative flex-1 overflow-y-auto">
        <div className="relative" style={{ height: 24 * HOUR_H }}>
          {/* 時間目盛り */}
          {Array.from({ length: 24 }, (_, h) => (
            <div
              key={h}
              className="absolute left-0 right-0 border-t border-gray-100"
              style={{ top: h * HOUR_H }}
            >
              <span className="absolute -top-2 left-1 text-[10px] text-gray-400">
                {String(h).padStart(2, '0')}:00
              </span>
            </div>
          ))}

          {/* タップで新規追加できる透明レイヤ */}
          <div
            className="absolute inset-0 ml-12"
            onClick={(ev) => {
              const rect = (ev.currentTarget as HTMLElement).getBoundingClientRect()
              const y = ev.clientY - rect.top + (scrollRef.current?.scrollTop ?? 0)
              openNew((y / HOUR_H) * 60)
            }}
          />

          {/* 予定ブロック */}
          {blocks.map((b) => (
            <button
              key={b.entry.id}
              onClick={(ev) => {
                ev.stopPropagation()
                openEdit(b.entry)
              }}
              className="absolute overflow-hidden rounded-md px-1.5 py-0.5 text-left text-xs text-white shadow-sm"
              style={{
                top: (b.topMin / 60) * HOUR_H,
                height: (b.heightMin / 60) * HOUR_H - 2,
                left: `calc(3rem + ${b.left} * (100% - 3rem))`,
                width: `calc(${b.width} * (100% - 3rem) - 2px)`,
                backgroundColor: colorOf(b.entry),
              }}
            >
              <div className="truncate font-medium">{b.entry.title}</div>
              <div className="truncate opacity-90">{fmtHm(b.entry.starts_at)}</div>
            </button>
          ))}

          {/* 現在時刻の線 */}
          {isToday && (
            <div
              className="pointer-events-none absolute left-0 right-0 z-10"
              style={{ top: (nowMin / 60) * HOUR_H }}
            >
              <div className="relative">
                <div className="absolute -top-1 left-11 h-2 w-2 rounded-full bg-red-500" />
                <div className="ml-12 border-t border-red-500" />
              </div>
            </div>
          )}
        </div>
      </div>

      {isLoading && (
        <div className="p-4 text-center text-sm text-gray-400">読み込み中…</div>
      )}

      {/* 追加ボタン（下部・片手操作） */}
      <button
        onClick={() => openNew()}
        className="absolute bottom-20 right-4 z-20 flex h-14 w-14 items-center justify-center rounded-full bg-group-work text-3xl text-white shadow-lg"
        aria-label="予定を追加"
      >
        ＋
      </button>

      <EntrySheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        entry={editing}
        defaultStartLocal={defaultStart}
      />
    </div>
  )
}
