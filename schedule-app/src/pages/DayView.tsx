import { useEffect, useMemo, useRef, useState } from 'react'
import {
  useEntriesForDay,
  useOverdueTasks,
  useUpdateChecklist,
} from '@/hooks/useEntries'
import {
  parseChecklist,
  serializeChecklist,
  checklistProgress,
} from '@/lib/checklist'
import { useCategories } from '@/hooks/useCategories'
import { useGroupFilter } from '@/hooks/useGroupFilter'
import { useStartTimer, useRunningTimers } from '@/hooks/useTimeTracking'
import TaskList from '@/components/TaskList'
import {
  addDays,
  fmtDateLabel,
  fmtHm,
  isoToJstLocal,
  minutesFromDayStart,
} from '@/lib/dates'
import { isBandEntry, layoutDay, type TimedBlock } from '@/lib/dayLayout'
import { useStickerMap, setSticker } from '@/lib/stickers'
import EntrySheet from '@/components/EntrySheet'
import { GROUP_COLORS, contrastText } from '@/lib/palette'
import type { Category, Entry, GroupKey } from '@/types/database'

const HOUR_H = 40 // 1時間の高さ(px)。半日(約12h)が1画面に入る目安
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
  // 予定ブロックから直接つける付箋エディタ
  const [stickerEdit, setStickerEdit] = useState<{
    id: string
    value: string
    top: number
    left: number
  } | null>(null)

  const scrollRef = useRef<HTMLDivElement>(null)
  const touchX = useRef<number | null>(null)

  const { data: entries = [], isLoading } = useEntriesForDay(day)
  const { data: categories = [] } = useCategories()
  const { active } = useGroupFilter()
  const updateChecklist = useUpdateChecklist()
  const { data: overdue = [] } = useOverdueTasks()
  const startTimer = useStartTimer()
  const { data: runningTimers = [] } = useRunningTimers()
  const stickerMap = useStickerMap()

  const catMap = useMemo(() => {
    const m = new Map<string, Category>()
    categories.forEach((c) => m.set(c.id, c))
    return m
  }, [categories])

  const groupOf = (e: Entry): LaneKey => {
    const g = e.category_id ? catMap.get(e.category_id)?.group_key : null
    return g ?? 'other'
  }
  // 予定の色は中分類の色。未設定なら大分類の基調色にフォールバック。
  const colorOf = (e: Entry) => {
    const c = e.category_id ? catMap.get(e.category_id) : null
    return c?.color ?? LANE_COLOR[groupOf(e)]
  }

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

  // タイムラインに載せるのは「予定（イベント）」だけ。TODOは下の専用リストで扱う。
  const timelineVisible = useMemo(
    () => visible.filter((e) => e.kind !== 'task'),
    [visible]
  )

  // レーン一覧: 有効なグループ + 未分類（該当があれば）
  const lanes: LaneKey[] = useMemo(() => {
    const ks: LaneKey[] = GROUP_ORDER.filter((g) => active.includes(g))
    if (timelineVisible.some((e) => groupOf(e) === 'other')) ks.push('other')
    return ks
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, timelineVisible])

  const isToday = fmtDateLabel(day) === fmtDateLabel(new Date())
  const dayKey = isoToJstLocal(day.toISOString()).slice(0, 10)

  // その日のTODO（タスク）一覧: 未完了→完了、時刻順。専用リストで確認しやすく。
  // 今日を見ているときは、期限切れ・未完了のTODOも自動で持ち越して表示する
  //（＝チェックを入れるまで毎日ここに出続ける。日付なしTODOも今日付で出続ける）
  const dayTasks = useMemo(() => {
    const tasks = visible.filter((e) => e.kind === 'task')
    let all = tasks
    if (isToday && overdue.length > 0) {
      const seen = new Set(tasks.map((t) => t.id))
      const carried = overdue.filter((e) => {
        if (seen.has(e.id) || (e.progress ?? 0) >= 100) return false
        const g = groupOf(e)
        return g === 'other' || active.includes(g)
      })
      all = [...tasks, ...carried]
    }
    return [...all].sort((a, b) => {
      const da = (a.progress ?? 0) >= 100 ? 1 : 0
      const db = (b.progress ?? 0) >= 100 ? 1 : 0
      if (da !== db) return da - db
      return a.starts_at.localeCompare(b.starts_at)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, isToday, overdue, active, catMap])

  // その日の最初の予定が見える位置へスクロール（無ければ 6:00）
  useEffect(() => {
    if (!scrollRef.current) return
    const timed = timelineVisible.filter((e) => !isBandEntry(e, day))
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

  // ヘッダーの「＋追加」から。表示中の日に対して新規追加。
  useEffect(() => {
    const h = () => openNew()
    window.addEventListener('app:add-entry', h)
    return () => window.removeEventListener('app:add-entry', h)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [day, categories])

  function openNew(atMin?: number, lane?: LaneKey) {
    if (atMin != null) {
      const h = Math.floor(atMin / 60)
      const m = Math.floor((atMin % 60) / 15) * 15
      const dayPart = isoToJstLocal(day.toISOString()).slice(0, 11)
      setDefaultStart(
        `${dayPart}${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
      )
    } else {
      // 日付だけ渡す（時刻は入力画面で空・現在時刻を引っ張らない）
      setDefaultStart(isoToJstLocal(day.toISOString()).slice(0, 10))
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
    const sticker = stickerMap[e.id]
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
        {/* 付箋（ひとことメモ）: 予定の上にペタッと。タップで編集 */}
        {sticker && (
          <button
            onClick={(ev) => {
              ev.stopPropagation()
              const r = (ev.currentTarget as HTMLElement).getBoundingClientRect()
              setStickerEdit({ id: e.id, value: sticker, top: r.bottom + 4, left: r.left })
            }}
            className="mb-0.5 shrink-0 truncate rounded bg-amber-200 px-1 text-left text-[10px] font-bold leading-tight text-amber-900"
          >
            📌 {sticker}
          </button>
        )}
        {/* 付箋がまだ無い予定に、直接貼れる📌ボタン */}
        {!sticker && !isTask && height >= 28 && (
          <button
            onClick={(ev) => {
              ev.stopPropagation()
              const r = (ev.currentTarget as HTMLElement).getBoundingClientRect()
              setStickerEdit({ id: e.id, value: '', top: r.bottom + 4, left: r.left })
            }}
            className="absolute bottom-0.5 right-0.5 z-10 rounded bg-black/15 px-1 text-[10px] leading-none"
            style={{ color: ink }}
            aria-label="付箋を貼る"
          >
            📌
          </button>
        )}

        {/* 予定の計測ボタン（十分な高さのときだけ表示） */}
        {!isTask &&
          height >= 34 &&
          (runningTimers.some((t) => t.entry_id === e.id) ? (
            <span className="absolute right-1 top-1 h-2.5 w-2.5 animate-pulse rounded-full bg-red-500" />
          ) : (
            <button
              onClick={(ev) => {
                ev.stopPropagation()
                startTimer.mutate({
                  label: e.title,
                  entry_id: e.id,
                  category_id: e.category_id,
                })
              }}
              className="absolute right-0.5 top-0.5 rounded bg-black/15 px-1 text-[11px] leading-none"
              style={{ color: ink }}
              aria-label="この予定を計測"
            >
              ▶
            </button>
          ))}
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
      <div className="flex items-center justify-between px-2 pt-1">
        <button
          onClick={() => setDay((d) => addDays(d, -1))}
          className="h-9 min-w-tap text-2xl text-gray-400"
          aria-label="前日"
        >
          ‹
        </button>
        <button
          onClick={() => setDay(new Date())}
          className="flex flex-col items-center leading-tight"
        >
          <span className="text-xl font-bold text-gray-800">
            {fmtDateLabel(day)}
          </span>
          {isToday && (
            <span className="text-xs font-medium text-group-work">Today</span>
          )}
        </button>
        <button
          onClick={() => setDay((d) => addDays(d, 1))}
          className="h-9 min-w-tap text-2xl text-gray-400"
          aria-label="翌日"
        >
          ›
        </button>
      </div>
      {/* 表示切替 */}
      <div className="flex justify-end border-b border-gray-100 px-2 py-0.5">
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

      {/* TODO 専用リスト — その日のタスクを大きなチェックで確認。
          今日は期限切れの未完了TODOも自動で持ち越して表示する。 */}
      <TaskList
        title="TODO"
        tasks={dayTasks}
        colorOf={colorOf}
        onEdit={openEdit}
        nowKey={dayKey}
      />

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
              const laneEntries = timelineVisible.filter((e) => groupOf(e) === k)
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
              {layoutDay(timelineVisible, day).map((b) => (
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

      {/* 付箋クイック編集ポップアップ（予定ブロックから直接） */}
      {stickerEdit && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setStickerEdit(null)}
          />
          <div
            className="fixed z-50 w-64 max-w-[85vw] rounded-xl border border-gray-200 bg-white p-3 shadow-xl"
            style={{
              top: Math.max(8, Math.min(stickerEdit.top, window.innerHeight - 170)),
              left: Math.max(8, Math.min(stickerEdit.left, window.innerWidth - 268)),
            }}
          >
            <div className="mb-1.5 text-xs font-bold text-amber-700">
              📌 付箋（ひとこと）
            </div>
            <input
              autoFocus
              value={stickerEdit.value}
              maxLength={30}
              onChange={(e) =>
                setStickerEdit({ ...stickerEdit, value: e.target.value })
              }
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  setSticker(stickerEdit.id, stickerEdit.value)
                  setStickerEdit(null)
                }
              }}
              placeholder="例: 体操服を持たせる"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
            <div className="mt-2 flex gap-2">
              <button
                onClick={() => {
                  setSticker(stickerEdit.id, '')
                  setStickerEdit(null)
                }}
                className="min-h-tap rounded-lg border border-gray-300 px-3 text-xs text-gray-500"
              >
                消す
              </button>
              <button
                onClick={() => {
                  setSticker(stickerEdit.id, stickerEdit.value)
                  setStickerEdit(null)
                }}
                className="min-h-tap flex-1 rounded-lg bg-amber-400 text-sm font-bold text-white"
              >
                貼る
              </button>
            </div>
          </div>
        </>
      )}

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
