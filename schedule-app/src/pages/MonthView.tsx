import { useMemo, useRef, useState } from 'react'
import { useEntriesForRange } from '@/hooks/useEntries'
import { useCategories } from '@/hooks/useCategories'
import { useGroupFilter } from '@/hooks/useGroupFilter'
import {
  addDays,
  addMonths,
  dayKey,
  entryOverlapsDay,
  fmtDateLabel,
  fmtHm,
  fmtMonthLabel,
  monthGrid,
} from '@/lib/dates'
import BottomSheet from '@/components/BottomSheet'
import EntrySheet from '@/components/EntrySheet'
import type { Category, Entry } from '@/types/database'

const WEEK = ['日', '月', '火', '水', '木', '金', '土']

export default function MonthView() {
  const [anchor, setAnchor] = useState(() => new Date())
  const [selected, setSelected] = useState<Date | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editing, setEditing] = useState<Entry | null>(null)
  const [defaultStart, setDefaultStart] = useState<string | undefined>()
  const touchX = useRef<number | null>(null)

  const cells = useMemo(() => monthGrid(anchor), [anchor])
  const rangeStart = cells[0].date
  const rangeEnd = addDays(cells[41].date, 1)

  const { data: entries = [] } = useEntriesForRange(rangeStart, rangeEnd)
  const { data: categories = [] } = useCategories()
  const { active } = useGroupFilter()

  const catMap = useMemo(() => {
    const m = new Map<string, Category>()
    categories.forEach((c) => m.set(c.id, c))
    return m
  }, [categories])

  const groupOf = (e: Entry) =>
    (e.category_id ? catMap.get(e.category_id)?.group_key : null) ?? 'other'
  const colorOf = (e: Entry) =>
    (e.category_id && catMap.get(e.category_id)?.color) || '#9AA5B1'

  const visible = useMemo(
    () =>
      entries.filter((e) => {
        const g = groupOf(e)
        return g === 'other' || active.includes(g)
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [entries, catMap, active]
  )

  const todayKey = dayKey(new Date())

  const entriesForDay = (day: Date) =>
    visible
      .filter((e) => entryOverlapsDay(e.starts_at, e.ends_at, day))
      .sort((a, b) => (a.all_day === b.all_day ? 0 : a.all_day ? -1 : 1))

  function openDay(day: Date) {
    setSelected(day)
  }
  function addOnSelected() {
    if (!selected) return
    setDefaultStart(`${dayKey(selected)}T09:00`)
    setEditing(null)
    setSheetOpen(true)
  }

  return (
    <div
      className="flex flex-1 flex-col"
      onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
      onTouchEnd={(e) => {
        if (touchX.current == null) return
        const dx = e.changedTouches[0].clientX - touchX.current
        if (dx > 60) setAnchor((d) => addMonths(d, -1))
        else if (dx < -60) setAnchor((d) => addMonths(d, 1))
        touchX.current = null
      }}
    >
      {/* 月ナビ */}
      <div className="flex items-center justify-between border-b border-gray-100 px-2 py-2">
        <button
          onClick={() => setAnchor((d) => addMonths(d, -1))}
          className="min-h-tap min-w-tap text-gray-500"
          aria-label="前月"
        >
          ‹
        </button>
        <button
          onClick={() => setAnchor(new Date())}
          className="text-sm font-bold text-gray-800"
        >
          {fmtMonthLabel(anchor)}
        </button>
        <button
          onClick={() => setAnchor((d) => addMonths(d, 1))}
          className="min-h-tap min-w-tap text-gray-500"
          aria-label="翌月"
        >
          ›
        </button>
      </div>

      {/* 曜日 */}
      <div className="grid grid-cols-7 border-b border-gray-100 text-center text-[11px] text-gray-400">
        {WEEK.map((w, i) => (
          <div
            key={w}
            className={
              'py-1 ' +
              (i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : '')
            }
          >
            {w}
          </div>
        ))}
      </div>

      {/* 日セル */}
      <div className="grid flex-1 grid-cols-7 grid-rows-6">
        {cells.map(({ key, date, inMonth }) => {
          const dayEntries = entriesForDay(date)
          // カテゴリ色の重複を除いて最大4ドット（要件 5-3）
          const colors: string[] = []
          for (const e of dayEntries) {
            const c = colorOf(e)
            if (!colors.includes(c)) colors.push(c)
            if (colors.length >= 4) break
          }
          const isToday = key === todayKey
          return (
            <button
              key={key}
              onClick={() => openDay(date)}
              className={
                'flex flex-col items-center gap-0.5 border-b border-r border-gray-100 py-1 ' +
                (inMonth ? '' : 'bg-gray-50 text-gray-300')
              }
            >
              <span
                className={
                  'flex h-6 w-6 items-center justify-center rounded-full text-xs ' +
                  (isToday ? 'bg-group-work font-bold text-white' : '')
                }
              >
                {Number(key.slice(-2))}
              </span>
              <div className="flex flex-wrap justify-center gap-0.5">
                {colors.map((c, i) => (
                  <span
                    key={i}
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </button>
          )
        })}
      </div>

      {/* 日タップの詳細シート */}
      <BottomSheet
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected ? fmtDateLabel(selected) : ''}
      >
        {selected && (
          <div className="flex flex-col gap-2">
            {entriesForDay(selected).length === 0 && (
              <p className="py-4 text-center text-sm text-gray-400">
                予定はありません
              </p>
            )}
            {entriesForDay(selected).map((e) => (
              <button
                key={e.id}
                onClick={() => {
                  setEditing(e)
                  setDefaultStart(undefined)
                  setSheetOpen(true)
                }}
                className="flex items-center gap-2 rounded-lg border border-gray-100 px-3 py-2 text-left"
              >
                <span
                  className="h-3 w-3 shrink-0 rounded-full"
                  style={{ backgroundColor: colorOf(e) }}
                />
                <span className="flex-1 truncate text-sm text-gray-800">
                  {e.title}
                </span>
                <span className="text-xs text-gray-400">
                  {e.all_day ? '終日' : fmtHm(e.starts_at)}
                </span>
              </button>
            ))}
            <button
              onClick={addOnSelected}
              className="min-h-tap mt-2 rounded-lg bg-group-work font-medium text-white"
            >
              ＋ この日に追加
            </button>
          </div>
        )}
      </BottomSheet>

      <EntrySheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        entry={editing}
        defaultStartLocal={defaultStart}
      />
    </div>
  )
}
