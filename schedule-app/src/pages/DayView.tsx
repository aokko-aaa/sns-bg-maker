import { useEffect, useMemo, useRef, useState } from 'react'
import {
  useEntriesForDay,
  useSetProgress,
  useOverdueTasks,
  useCarryOverToday,
  useUpdateChecklist,
} from '@/hooks/useEntries'
import {
  parseChecklist,
  serializeChecklist,
  checklistProgress,
} from '@/lib/checklist'
import { useCategories } from '@/hooks/useCategories'
import { useGroupFilter } from '@/hooks/useGroupFilter'
import {
  addDays,
  fmtDateLabel,
  fmtHm,
  fmtMd,
  isoToJstLocal,
  minutesFromDayStart,
} from '@/lib/dates'
import { isBandEntry, layoutDay, type TimedBlock } from '@/lib/dayLayout'
import EntrySheet from '@/components/EntrySheet'
import { GROUP_COLORS, contrastText } from '@/lib/palette'
import type { Category, Entry, GroupKey } from '@/types/database'

const HOUR_H = 60 // 1時間の高さ(px)
const START_HOUR = 6 // 初期スクロール位置
const GUT = '2.5rem' // 左の時刻ラベル幅

type LaneKey = GroupKey | 'other'
const GROUP_ORDER: GroupKey[] = ['work', 'family', 'personal']
const LANE_LABEL: Record<LaneKey, string> = {
  work: 'Work',
  family: 'Family',
  personal: 'Personal',
  other: 'Other',
}
const LANE_COLOR = GROUP_COLORS

type ViewMode = 'lanes' | 'single'

export default function DayView() {
  const [day, setDay] = useState(() => new Date())
  const [mode, setMode] = useState<ViewMode>('lanes')
  const [nowMin, setNowMin] = useState(() =>
    minutesFromDayStart(new Date().toISOString(), new Date())
  )
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editing, setEditing] = useState<Entry | null>(null)
  const [defaultStart, setDefaultStart] = useState<string | undefined>()
  const [defaultCat, setDefaultCat] = useState<string | null>(null)
  const [todoOpen, setTodoOpen] = useState(true)

  const scrollRef = useRef<HTMLDivElement>(null)
  const touchX = useRef<number | null>(null)

  const { data: entries = [], isLoading } = useEntriesForDay(day)
  const { data: categories = [] } = useCategories()
  const { active } = useGroupFilter()
  const setProgress = useSetProgress()
  const updateChecklist = useUpdateChecklist()
  const { data: overdue = [] } = useOverdueTasks()
  const carryOver = useCarryOverToday()

  const catMap = useMemo(() => {
    const m = new Map<string, Category>()
    categories.forEach((c) => m.set(c.id, c))
    return m
  }, [categories])

  const groupOf = (e: Entry): LaneKey => {
    const g = e.category_id ? catMap.get(e.category_id)?.group_key : null
    return g ?? 'other'
  }
  // 予定の色は大分類(Work/Family/Personal)の色に統一
  const colorOf = (e: Entry) => LANE_COLOR[groupOf(e)]

  // group_key フィルタ（未分類は常に表示）
  const visible = useMemo(
    () =>
      entries.filter((e) => {
        const g = groupOf(e)
        return g === 'other' || active.includes(g)
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [entries, catMap, active]
  )

  // レーン一覧: 有効なグループ + 未分類（該当があれば）
  const lanes: LaneKey[] = useMemo(() => {
    const ks: LaneKey[] = GROUP_ORDER.filter((g) => active.includes(g))
    if (visible.some((e) => groupOf(e) === 'other')) ks.push('other')
    return ks
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, visible])

  // その日のTODO（タスク）一覧: 未完了→完了、時刻順。専用リストで確認しやすく。
  const dayTasks = useMemo(() => {
    const tasks = visible.filter((e) => e.kind === 'task')
    return [...tasks].sort((a, b) => {
      const da = (a.progress ?? 0) >= 100 ? 1 : 0
      const db = (b.progress ?? 0) >= 100 ? 1 : 0
      if (da !== db) return da - db
      return a.starts_at.localeCompare(b.starts_at)
    })
  }, [visible])
  const todoRemaining = dayTasks.filter((e) => (e.progress ?? 0) < 100).length

  // タスク全体の完了/未完を切り替え（チェックリストがあれば全項目に反映）
  const toggleTask = (e: Entry) => {
    const items = parseChecklist(e.notes)
    if (items.length > 0) {
      const allDone = items.every((i) => i.done)
      const next = items.map((i) => ({ ...i, done: !allDone }))
      updateChecklist.mutate({
        id: e.id,
        notes: serializeChecklist(next),
        progress: checklistProgress(next),
      })
    } else {
      setProgress.mutate({ id: e.id, progress: (e.progress ?? 0) >= 100 ? 0 : 100 })
    }
  }
  const toggleTaskItem = (e: Entry, idx: number) => {
    const items = parseChecklist(e.notes)
    const next = items.map((x, i) => (i === idx ? { ...x, done: !x.done } : x))
    updateChecklist.mutate({
      id: e.id,
      notes: serializeChecklist(next),
      progress: checklistProgress(next),
    })
  }

  // その日の最初の予定が見える位置へスクロール（無ければ 6:00）
  useEffect(() => {
    if (!scrollRef.current) return
    const timed = visible.filter((e) => !isBandEntry(e, day))
    let targetMin = START_HOUR * 60
    if (timed.length > 0) {
      const earliest = Math.min(
        ...timed.map((e) => minutesFromDayStart(e.starts_at, day))
      )
      targetMin = Math.max(0, earliest - 60) // 1時間前を上端に
    }
    scrollRef.current.scrollTop = (targetMin / 60) * HOUR_H
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [day, entries])

  // 現在時刻の線を更新
  useEffect(() => {
    const t = setInterval(
      () =>
        setNowMin(minutesFromDayStart(new Date().toISOString(), new Date())),
      60_000
    )
    return () => clearInterval(t)
  }, [])

  const isToday = fmtDateLabel(day) === fmtDateLabel(new Date())

  function openNew(atMin?: number, lane?: LaneKey) {
    if (atMin != null) {
      const h = Math.floor(atMin / 60)
      const m = Math.floor((atMin % 60) / 15) * 15
      const dayPart = isoToJstLocal(day.toISOString()).slice(0, 11)
      setDefaultStart(
        `${dayPart}${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
      )
    } else {
      setDefaultStart(isoToJstLocal(day.toISOString()))
    }
    // レーンから追加された場合はそのグループの先頭カテゴリを初期選択
    const cat =
      lane && lane !== 'other'
        ? categories.find((c) => c.group_key === lane)?.id ?? null
        : null
    setDefaultCat(cat)
    setEditing(null)
    setSheetOpen(true)
  }

  function openEdit(e: Entry) {
    setEditing(e)
    setDefaultStart(undefined)
    setDefaultCat(null)
    setSheetOpen(true)
  }

  // 時刻軸の目盛り + 現在時刻線（共通パーツ）
  const HourGrid = (
    <>
      {Array.from({ length: 24 }, (_, h) => (
        <div
          key={h}
          className="absolute left-0 right-0 border-t border-gray-100"
          style={{ top: h * HOUR_H }}
        >
          <span className="absolute -top-2 left-1 text-[12px] text-gray-400">
            {String(h).padStart(2, '0')}
          </span>
        </div>
      ))}
      {isToday && (
        <div
          className="pointer-events-none absolute left-0 right-0 z-10"
          style={{ top: (nowMin / 60) * HOUR_H }}
        >
          <div
            className="h-2 w-2 rounded-full bg-red-500"
            style={{ position: 'absolute', left: `calc(${GUT} - 4px)`, top: -4 }}
          />
          <div className="border-t border-red-500" style={{ marginLeft: GUT }} />
        </div>
      )}
    </>
  )

  function Block({ b, left, width }: { b: TimedBlock; left: string; width: string }) {
    const e = b.entry
    const top = (b.topMin / 60) * HOUR_H
    const height = (b.heightMin / 60) * HOUR_H - 2
    const bg = colorOf(e)
    const ink = contrastText(bg)
    const isTask = e.kind === 'task'
    const items = isTask ? parseChecklist(e.notes) : []
    // TODOでタイトルが先頭項目と同じ（自動流用）なら見出しは省く
    const showTitle = !isTask || items.length === 0 || e.title !== items[0]?.text

    const toggleItem = (idx: number) => {
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
        className="absolute flex flex-col overflow-hidden rounded-md px-1 py-0.5 shadow-sm"
        style={{ top, height, left, width, backgroundColor: bg }}
        onClick={(ev) => {
          ev.stopPropagation()
          openEdit(e)
        }}
      >
        {(showTitle || !isTask) && (
          <button
            onClick={(ev) => {
              ev.stopPropagation()
              openEdit(e)
            }}
            className="text-left leading-tight"
            style={{ color: ink }}
          >
            {showTitle && (
              <div className="truncate text-[13px] font-medium">{e.title}</div>
            )}
            {!isTask && (
              <div className="truncate text-[11px] opacity-90">
                {b.band ? '終日' : fmtHm(e.starts_at)}
              </div>
            )}
          </button>
        )}
        {isTask && items.length > 0 && (
          <div className="mt-0.5 flex flex-col gap-0.5 overflow-hidden">
            {items.map((it, i) => (
              <button
                key={i}
                onClick={(ev) => {
                  ev.stopPropagation()
                  toggleItem(i)
                }}
                className="flex w-full items-start gap-1 text-left text-[12px] leading-tight"
                style={{ color: ink }}
              >
                <span className="shrink-0">{it.done ? '☑' : '☐'}</span>
                <span className={'truncate ' + (it.done ? 'line-through opacity-70' : '')}>
                  {it.text}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div
      className="flex min-h-0 flex-1 flex-col"
      onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
      onTouchEnd={(e) => {
        if (touchX.current == null) return
        const dx = e.changedTouches[0].clientX - touchX.current
        if (dx > 60) setDay((d) => addDays(d, -1))
        else if (dx < -60) setDay((d) => addDays(d, 1))
        touchX.current = null
      }}
    >
      {/* 日付ナビ（大きく表示） */}
      <div className="flex items-center justify-between px-2 pt-2">
        <button
          onClick={() => setDay((d) => addDays(d, -1))}
          className="min-h-tap min-w-tap text-2xl text-gray-400"
          aria-label="前日"
        >
          ‹
        </button>
        <button
          onClick={() => setDay(new Date())}
          className="flex flex-col items-center leading-tight"
        >
          <span className="text-2xl font-bold text-gray-800">
            {fmtDateLabel(day)}
          </span>
          {isToday && (
            <span className="text-sm font-medium text-group-work">Today</span>
          )}
        </button>
        <button
          onClick={() => setDay((d) => addDays(d, 1))}
          className="min-h-tap min-w-tap text-2xl text-gray-400"
          aria-label="翌日"
        >
          ›
        </button>
      </div>
      {/* 表示切替 */}
      <div className="flex justify-end border-b border-gray-100 px-2 py-1">
        <div className="flex overflow-hidden rounded-lg border border-gray-200 text-xs">
          <button
            onClick={() => setMode('lanes')}
            className={
              'px-3 py-1 ' +
              (mode === 'lanes' ? 'bg-group-work text-white' : 'text-gray-500')
            }
          >
            レーン
          </button>
          <button
            onClick={() => setMode('single')}
            className={
              'px-3 py-1 ' +
              (mode === 'single' ? 'bg-group-work text-white' : 'text-gray-500')
            }
          >
            1本
          </button>
        </div>
      </div>

      {/* 持ち越し（期限切れ未完了タスク） — 今日のみ */}
      {isToday && overdue.length > 0 && (
        <div className="border-b border-amber-100 bg-amber-50 px-2 py-1.5">
          <p className="mb-1 text-[11px] font-medium text-amber-700">
            持ち越し（未完了 {overdue.length}）
          </p>
          <div className="flex max-h-28 flex-col gap-1 overflow-y-auto">
            {overdue.map((e) => (
              <div
                key={e.id}
                className="flex items-center gap-2 rounded bg-white px-2 py-1 text-xs"
              >
                <button
                  onClick={() => setProgress.mutate({ id: e.id, progress: 100 })}
                  className="shrink-0 text-base leading-none text-gray-500"
                  aria-label="完了にする"
                >
                  ☐
                </button>
                <span className="flex-1 truncate text-gray-800">{e.title}</span>
                <span className="shrink-0 text-gray-400">
                  {fmtMd(new Date(e.starts_at))}
                </span>
                <button
                  onClick={() => carryOver.mutate(e)}
                  className="shrink-0 rounded bg-group-work px-2 py-0.5 font-medium text-white"
                >
                  →今日
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* やること（TODO）専用リスト — その日のタスクを大きなチェックで確認 */}
      {dayTasks.length > 0 && (
        <div className="border-b border-gray-100 bg-white">
          <button
            onClick={() => setTodoOpen((v) => !v)}
            className="flex w-full items-center gap-2 px-3 py-2 text-left"
          >
            <span className="text-sm font-bold text-gray-700">やること</span>
            <span className="rounded-full bg-group-work/10 px-2 py-0.5 text-[11px] font-medium text-group-work">
              未完了 {todoRemaining} / {dayTasks.length}
            </span>
            <span className="ml-auto text-gray-400">{todoOpen ? '▾' : '▸'}</span>
          </button>
          {todoOpen && (
            <ul className="max-h-56 space-y-1 overflow-y-auto px-2 pb-2">
              {dayTasks.map((e) => {
                const items = parseChecklist(e.notes)
                const done = (e.progress ?? 0) >= 100
                const dot = colorOf(e)
                return (
                  <li
                    key={e.id}
                    className="rounded-lg border border-gray-100 bg-gray-50 px-2 py-1.5"
                  >
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => toggleTask(e)}
                        className="shrink-0 text-2xl leading-none"
                        style={{ color: done ? dot : '#c4c9d2' }}
                        aria-label={done ? '未完了に戻す' : '完了にする'}
                      >
                        {done ? '☑' : '☐'}
                      </button>
                      <span
                        className="h-3 w-3 shrink-0 rounded-full"
                        style={{ backgroundColor: dot }}
                      />
                      <button
                        onClick={() => openEdit(e)}
                        className="flex-1 truncate text-left text-[15px] text-gray-800"
                      >
                        <span className={done ? 'text-gray-400 line-through' : ''}>
                          {e.title}
                        </span>
                      </button>
                      {items.length > 0 && (
                        <span className="shrink-0 text-[11px] text-gray-400">
                          {items.filter((i) => i.done).length}/{items.length}
                        </span>
                      )}
                      <span className="shrink-0 text-[11px] text-gray-400">
                        {e.all_day ? '終日' : fmtHm(e.starts_at)}
                      </span>
                    </div>
                    {items.length > 0 && (
                      <ul className="mt-1 space-y-0.5 pl-8">
                        {items.map((it, i) => (
                          <li key={i}>
                            <button
                              onClick={() => toggleTaskItem(e, i)}
                              className="flex w-full items-start gap-2 text-left text-[14px] leading-snug text-gray-700"
                            >
                              <span className="shrink-0 text-lg leading-none text-gray-500">
                                {it.done ? '☑' : '☐'}
                              </span>
                              <span
                                className={it.done ? 'text-gray-400 line-through' : ''}
                              >
                                {it.text}
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}

      {/* レーンモードのヘッダ（種類ラベル） */}
      {mode === 'lanes' && (
        <div className="flex border-b border-gray-100 text-center text-xs font-medium">
          <div style={{ width: GUT }} />
          {lanes.map((k) => (
            <div
              key={k}
              className="flex-1 border-l border-gray-100 py-1"
              style={{ color: LANE_COLOR[k] }}
            >
              {LANE_LABEL[k]}
            </div>
          ))}
        </div>
      )}

      {/* タイムライン本体 */}
      <div ref={scrollRef} className="relative min-h-0 flex-1 overflow-y-auto">
        <div className="relative" style={{ height: 24 * HOUR_H }}>
          {HourGrid}

          {mode === 'lanes' ? (
            lanes.map((k, li) => {
              const laneEntries = visible.filter((e) => groupOf(e) === k)
              const blocks = layoutDay(laneEntries, day)
              const n = lanes.length
              return (
                <div key={k}>
                  {/* レーンの背景（タップで追加） */}
                  <div
                    className="absolute top-0 bottom-0 border-l border-gray-50"
                    style={{
                      left: `calc(${GUT} + ${li} * (100% - ${GUT}) / ${n})`,
                      width: `calc((100% - ${GUT}) / ${n})`,
                    }}
                    onClick={(ev) => {
                      const rect = (
                        ev.currentTarget as HTMLElement
                      ).getBoundingClientRect()
                      const y = ev.clientY - rect.top
                      openNew((y / HOUR_H) * 60, k)
                    }}
                  />
                  {blocks.map((b) => (
                    <Block
                      key={b.entry.id}
                      b={b}
                      left={`calc(${GUT} + (${li} + ${b.left}) * (100% - ${GUT}) / ${n} + 1px)`}
                      width={`calc(${b.width} * (100% - ${GUT}) / ${n} - 2px)`}
                    />
                  ))}
                </div>
              )
            })
          ) : (
            <>
              <div
                className="absolute inset-0"
                style={{ marginLeft: GUT }}
                onClick={(ev) => {
                  const rect = (
                    ev.currentTarget as HTMLElement
                  ).getBoundingClientRect()
                  const y =
                    ev.clientY - rect.top + (scrollRef.current?.scrollTop ?? 0)
                  openNew((y / HOUR_H) * 60)
                }}
              />
              {layoutDay(visible, day).map((b) => (
                <Block
                  key={b.entry.id}
                  b={b}
                  left={`calc(${GUT} + ${b.left} * (100% - ${GUT}) + 1px)`}
                  width={`calc(${b.width} * (100% - ${GUT}) - 2px)`}
                />
              ))}
            </>
          )}
        </div>
      </div>

      {isLoading && (
        <div className="p-4 text-center text-sm text-gray-400">読み込み中…</div>
      )}

      {/* 追加ボタン */}
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
        defaultCategoryId={defaultCat}
      />
    </div>
  )
}
