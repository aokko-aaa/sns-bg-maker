import { useEffect, useMemo, useRef, useState } from 'react'
import { formatInTimeZone } from 'date-fns-tz'
import { useEntriesForRange, useUpdateChecklist } from '@/hooks/useEntries'
import { useMonthlyGoal, useSaveMonthlyGoal } from '@/hooks/useMonthlyGoal'
import { TZ } from '@/lib/time'
import {
  parseChecklist,
  serializeChecklist,
  checklistProgress,
} from '@/lib/checklist'
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
import { GROUP_COLORS } from '@/lib/palette'
import type { Category, Entry } from '@/types/database'

const WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

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
  const updateChecklist = useUpdateChecklist()

  // 今月の目標（YYYY-MM で保存・同期）
  const monthKey = formatInTimeZone(anchor, TZ, 'yyyy-MM')
  const { data: goalRow } = useMonthlyGoal(monthKey)
  const saveGoal = useSaveMonthlyGoal()
  const [goalEditing, setGoalEditing] = useState(false)
  const [goalDraft, setGoalDraft] = useState('')
  useEffect(() => {
    setGoalEditing(false)
  }, [monthKey])
  function startEditGoal() {
    setGoalDraft(goalRow?.goal ?? '')
    setGoalEditing(true)
  }
  async function commitGoal() {
    await saveGoal.mutateAsync({
      id: goalRow?.id,
      month: monthKey,
      goal: goalDraft.trim(),
    })
    setGoalEditing(false)
  }

  const catMap = useMemo(() => {
    const m = new Map<string, Category>()
    categories.forEach((c) => m.set(c.id, c))
    return m
  }, [categories])

  const groupOf = (e: Entry) =>
    (e.category_id ? catMap.get(e.category_id)?.group_key : null) ?? 'other'
  // 予定の色は大分類の色に統一
  const colorOf = (e: Entry) => GROUP_COLORS[groupOf(e)]

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
      className="flex min-h-0 flex-1 flex-col"
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
          className="text-2xl font-bold text-gray-800"
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

      {/* 今月の目標 */}
      <div className="border-b border-gray-100 bg-group-work/5 px-3 py-2">
        {goalEditing ? (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-1.5 text-xs font-bold tracking-wide text-group-work">
              <span className="h-3 w-1 rounded-full bg-group-work" />
              今月の目標
            </div>
            <textarea
              value={goalDraft}
              onChange={(e) => setGoalDraft(e.target.value)}
              placeholder="例: 早寝早起き／読書2冊／週3ジム"
              rows={2}
              autoFocus
              className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
            <div className="flex gap-2">
              <button
                onClick={() => setGoalEditing(false)}
                className="min-h-tap flex-1 rounded-lg border border-gray-300 text-sm text-gray-600"
              >
                キャンセル
              </button>
              <button
                onClick={commitGoal}
                disabled={saveGoal.isPending}
                className="min-h-tap flex-1 rounded-lg bg-group-work text-sm font-medium text-white disabled:opacity-50"
              >
                {saveGoal.isPending ? '保存中…' : '保存'}
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={startEditGoal}
            className="flex w-full items-start gap-2 text-left"
          >
            <span className="flex shrink-0 items-center gap-1.5 text-xs font-bold tracking-wide text-group-work">
              <span className="h-3 w-1 rounded-full bg-group-work" />
              今月の目標
            </span>
            <span
              className={
                'flex-1 whitespace-pre-wrap text-sm ' +
                (goalRow?.goal ? 'text-gray-800' : 'text-gray-400')
              }
            >
              {goalRow?.goal || 'タップして目標を入力'}
            </span>
            <span className="shrink-0 text-xs text-gray-400">✎</span>
          </button>
        )}
      </div>

      {/* 曜日 */}
      <div className="grid grid-cols-7 border-b border-gray-100 text-center text-[13px] text-gray-400">
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
            {entriesForDay(selected).map((e) => {
              const isTask = e.kind === 'task'
              const items = isTask ? parseChecklist(e.notes) : []
              const toggle = (idx: number) => {
                const next = items.map((x, i) =>
                  i === idx ? { ...x, done: !x.done } : x
                )
                updateChecklist.mutate({
                  id: e.id,
                  notes: serializeChecklist(next),
                  progress: checklistProgress(next),
                })
              }
              return (
                <div
                  key={e.id}
                  className="rounded-lg border border-gray-100 px-3 py-2"
                >
                  <button
                    onClick={() => {
                      setEditing(e)
                      setDefaultStart(undefined)
                      setSheetOpen(true)
                    }}
                    className="flex w-full items-center gap-2 overflow-hidden text-left"
                  >
                    <span
                      className="h-3 w-3 shrink-0 rounded-full"
                      style={{ backgroundColor: colorOf(e) }}
                    />
                    <span className="flex-1 truncate text-sm font-medium text-gray-800">
                      {e.title}
                    </span>
                    <span className="text-xs text-gray-400">
                      {isTask
                        ? `${items.filter((i) => i.done).length}/${items.length}`
                        : e.all_day
                          ? '終日'
                          : fmtHm(e.starts_at)}
                    </span>
                  </button>
                  {/* TODO のチェックリスト */}
                  {isTask && items.length > 0 && (
                    <div className="mt-1 flex flex-col gap-1 pl-5">
                      {items.map((it, i) => (
                        <button
                          key={i}
                          onClick={() => toggle(i)}
                          className="flex items-start gap-2 text-left text-sm"
                        >
                          <span className="shrink-0 text-group-work">
                            {it.done ? '☑' : '☐'}
                          </span>
                          <span
                            className={
                              it.done ? 'text-gray-400 line-through' : 'text-gray-700'
                            }
                          >
                            {it.text}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
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
