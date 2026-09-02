import { useEffect, useMemo, useRef, useState } from 'react'
import { useEntriesForRange, useSaveEntry } from '@/hooks/useEntries'
import { useCategories } from '@/hooks/useCategories'
import { useGroupFilter, GROUP_LABELS } from '@/hooks/useGroupFilter'
import {
  addDays,
  entryOverlapsDay,
  fmtMd,
  dayKey,
  weekDays,
} from '@/lib/dates'
import EntrySheet from '@/components/EntrySheet'
import TaskList from '@/components/TaskList'
import { GROUP_COLORS, contrastText } from '@/lib/palette'
import type { Category, Entry, GroupKey } from '@/types/database'

const WEEK_JA = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export default function WeekView() {
  const [anchor, setAnchor] = useState(() => new Date())
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editing, setEditing] = useState<Entry | null>(null)
  const [defaultStart, setDefaultStart] = useState<string | undefined>()
  const gridRef = useRef<HTMLDivElement>(null)
  const touchX = useRef<number | null>(null)
  // ドラッグ中のプレビュー: entryId -> {startShift, endShift}(日数)
  const [drag, setDrag] = useState<{
    id: string
    side: 'left' | 'right'
    shift: number
  } | null>(null)

  const days = useMemo(() => weekDays(anchor), [anchor])
  const rangeStart = days[0]
  const rangeEnd = addDays(days[6], 1)

  const { data: entries = [] } = useEntriesForRange(rangeStart, rangeEnd)
  const { data: categories = [] } = useCategories()
  const { active } = useGroupFilter()
  const save = useSaveEntry()

  const catMap = useMemo(() => {
    const m = new Map<string, Category>()
    categories.forEach((c) => m.set(c.id, c))
    return m
  }, [categories])

  const groupOf = (e: Entry) =>
    (e.category_id ? catMap.get(e.category_id)?.group_key : null) ?? 'other'
  // 予定の色は中分類の色。未設定なら大分類の基調色にフォールバック。
  const colorOf = (e: Entry) => {
    const c = e.category_id ? catMap.get(e.category_id) : null
    return c?.color ?? GROUP_COLORS[groupOf(e)]
  }

  const visible = useMemo(
    () =>
      entries.filter((e) => {
        const g = groupOf(e)
        return g === 'other' || active.includes(g)
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [entries, catMap, active]
  )

  // ガントに載せるのは予定（イベント）だけ。TODOは上の専用リストで扱う。
  const eventVisible = useMemo(
    () => visible.filter((e) => e.kind !== 'task'),
    [visible]
  )
  const weekTasks = useMemo(
    () => visible.filter((e) => e.kind === 'task'),
    [visible]
  )

  function openEdit(e: Entry) {
    setEditing(e)
    setDefaultStart(undefined)
    setSheetOpen(true)
  }

  function openNew() {
    const todayK = dayKey(new Date())
    const inWeek = days.some((d) => dayKey(d) === todayK)
    const base = inWeek ? todayK : dayKey(days[0])
    setDefaultStart(`${base}T09:00`)
    setEditing(null)
    setSheetOpen(true)
  }

  // ヘッダーの「＋追加」から。表示中の週に対して新規追加。
  useEffect(() => {
    const h = () => openNew()
    window.addEventListener('app:add-entry', h)
    return () => window.removeEventListener('app:add-entry', h)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days])

  // 大分類（Work / Family / Personal）ごとに区切る。中分類ラベルは出さず、色と内容で判別。
  const groups = useMemo(() => {
    const byGroup = new Map<string, Entry[]>()
    for (const e of eventVisible) {
      const g = groupOf(e) // 'work' | 'family' | 'personal' | 'other'
      if (!byGroup.has(g)) byGroup.set(g, [])
      byGroup.get(g)!.push(e)
    }
    const order: Array<GroupKey | 'other'> = [
      'work',
      'family',
      'personal',
      'other',
    ]
    const ordered: Array<{ key: string; name: string; color: string; items: Entry[] }> =
      []
    for (const g of order) {
      if (byGroup.has(g))
        ordered.push({
          key: g,
          name: g === 'other' ? '未分類' : GROUP_LABELS[g],
          color: GROUP_COLORS[g],
          items: byGroup.get(g)!,
        })
    }
    return ordered
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventVisible, catMap])

  const todayKey = dayKey(new Date())

  // entry が週内で最初/最後に触れる日インデックス(0..6)
  function span(e: Entry): { start: number; end: number } | null {
    let start = -1
    let end = -1
    for (let i = 0; i < 7; i++) {
      if (entryOverlapsDay(e.starts_at, e.ends_at, days[i])) {
        if (start === -1) start = i
        end = i
      }
    }
    if (start === -1) return null
    return { start, end }
  }

  // 予定を「重ならない同士は同じ行」にまとめる（レーン詰め）。
  // ただし中分類（カテゴリ）が違うものは同じ行にせず、必ず行を分ける。
  // 同一中分類の中でだけ、日付が重ならなければ1行に並ぶので行増えしない。
  function packRows(items: Entry[]): Array<Array<{ e: Entry; start: number; end: number }>> {
    const withSpan = items
      .map((e) => ({ e, sp: span(e) }))
      .filter(
        (x): x is { e: Entry; sp: { start: number; end: number } } =>
          x.sp !== null
      )

    // 中分類ごとにバケツ分け（出現順を保つ）。未分類は 'none' 扱い。
    const buckets = new Map<
      string,
      Array<{ e: Entry; sp: { start: number; end: number } }>
    >()
    for (const x of withSpan) {
      const key = x.e.category_id ?? 'none'
      if (!buckets.has(key)) buckets.set(key, [])
      buckets.get(key)!.push(x)
    }

    const result: Array<Array<{ e: Entry; start: number; end: number }>> = []
    for (const bucket of buckets.values()) {
      const sorted = [...bucket].sort(
        (a, b) => a.sp.start - b.sp.start || a.sp.end - b.sp.end
      )
      const rows: Array<{
        lastEnd: number
        items: Array<{ e: Entry; start: number; end: number }>
      }> = []
      for (const { e, sp } of sorted) {
        // 同じ中分類の行のうち、最後の予定がこの予定の開始より前に終わる行へ入れる
        const row = rows.find((r) => r.lastEnd < sp.start)
        if (row) {
          row.items.push({ e, start: sp.start, end: sp.end })
          row.lastEnd = sp.end
        } else {
          rows.push({
            lastEnd: sp.end,
            items: [{ e, start: sp.start, end: sp.end }],
          })
        }
      }
      for (const r of rows) result.push(r.items)
    }
    return result
  }

  function beginDrag(
    e: Entry,
    side: 'left' | 'right',
    ev: React.PointerEvent
  ) {
    ev.stopPropagation()
    ;(ev.target as HTMLElement).setPointerCapture(ev.pointerId)
    const startX = ev.clientX
    const dayPx = (gridRef.current?.clientWidth ?? 350) / 7

    const move = (mx: number) => {
      const shift = Math.round((mx - startX) / dayPx)
      setDrag({ id: e.id, side, shift })
    }
    const onMove = (m: PointerEvent) => move(m.clientX)
    const onUp = async (m: PointerEvent) => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      const shift = Math.round((m.clientX - startX) / dayPx)
      setDrag(null)
      if (shift === 0) return
      // 期間を日数ぶん動かす
      let s = new Date(e.starts_at)
      let en = new Date(e.ends_at)
      if (side === 'left') s = addDays(s, shift)
      else en = addDays(en, shift)
      if (en.getTime() <= s.getTime()) return // 逆転は無視
      await save.mutateAsync({
        id: e.id,
        title: e.title,
        category_id: e.category_id,
        kind: e.kind,
        starts_at: s.toISOString(),
        ends_at: en.toISOString(),
        all_day: e.all_day,
        progress: e.progress,
        notes: e.notes,
        source: e.source,
        inbox_id: e.inbox_id,
      })
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  return (
    <div
      className="flex min-h-0 flex-1 flex-col"
      onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
      onTouchEnd={(e) => {
        if (touchX.current == null || drag) return
        const dx = e.changedTouches[0].clientX - touchX.current
        if (dx > 60) setAnchor((d) => addDays(d, -7))
        else if (dx < -60) setAnchor((d) => addDays(d, 7))
        touchX.current = null
      }}
    >
      {/* 今週のTODO（一番上） */}
      <TaskList
        title="今週のTODO"
        tasks={weekTasks}
        colorOf={colorOf}
        onEdit={openEdit}
        showDate
        defaultOpen={false}
      />

      {/* 週ナビ */}
      <div className="flex items-center justify-between border-b border-gray-100 px-2 py-2">
        <button
          onClick={() => setAnchor((d) => addDays(d, -7))}
          className="min-h-tap min-w-tap text-gray-500"
          aria-label="前週"
        >
          ‹
        </button>
        <button
          onClick={() => setAnchor(new Date())}
          className="text-xl font-bold text-gray-800"
        >
          {fmtMd(days[0])} – {fmtMd(days[6])}
        </button>
        <button
          onClick={() => setAnchor((d) => addDays(d, 7))}
          className="min-h-tap min-w-tap text-gray-500"
          aria-label="翌週"
        >
          ›
        </button>
      </div>

      {/* 曜日ヘッダ */}
      <div className="grid grid-cols-7 border-b border-gray-100 text-center text-[13px]">
        {days.map((d, i) => {
          const isToday = dayKey(d) === todayKey
          return (
            <div key={i} className="py-1">
              <div
                className={
                  i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-gray-400'
                }
              >
                {WEEK_JA[i]}
              </div>
              <div
                className={
                  'mx-auto flex h-5 w-5 items-center justify-center rounded-full ' +
                  (isToday ? 'bg-group-work font-bold text-white' : 'text-gray-700')
                }
              >
                {fmtMd(d).split('/')[1]}
              </div>
            </div>
          )
        })}
      </div>

      {/* ガント本体 */}
      <div ref={gridRef} className="relative min-h-0 flex-1 overflow-y-auto">
        {/* 縦の日区切り線 */}
        <div className="pointer-events-none absolute inset-0 grid grid-cols-7">
          {days.map((_, i) => (
            <div key={i} className="border-r border-gray-50" />
          ))}
        </div>

        {groups.length === 0 && (
          <p className="p-6 text-center text-sm text-gray-400">
            この週に予定はありません。
          </p>
        )}

        {groups.map((g) => (
          <div key={g.key} className="relative">
            {/* カテゴリ見出し */}
            <div className="flex items-center gap-1 bg-gray-50 px-2 py-1 text-xs font-medium text-gray-600">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: g.color }}
              />
              {g.name}
            </div>
            {/* 重ならない予定は同じ行に詰める（同一中分類が予定の数だけ行増えしない） */}
            {packRows(g.items).map((row, ri) => (
              <div key={ri} className="relative h-9 border-b border-gray-50">
                {row.map(({ e, start: s0, end: e0 }) => {
                  let start = s0
                  let end = e0
                  // ドラッグ中のプレビュー反映
                  if (drag && drag.id === e.id) {
                    if (drag.side === 'left')
                      start = Math.max(0, Math.min(end, start + drag.shift))
                    else end = Math.min(6, Math.max(start, end + drag.shift))
                  }
                  const count = end - start + 1
                  const pct = 100 / 7
                  return (
                    <div
                      key={e.id}
                      onClick={() => openEdit(e)}
                      className="absolute top-1 flex h-7 items-center overflow-hidden rounded-md text-[13px] shadow-sm"
                      style={{
                        left: `${start * pct}%`,
                        width: `${count * pct}%`,
                        backgroundColor: colorOf(e),
                        color: contrastText(colorOf(e)),
                      }}
                    >
                      {/* progress 塗り分け */}
                      {e.kind === 'task' && (e.progress ?? 0) > 0 && (
                        <div
                          className="absolute inset-y-0 left-0 bg-black/20"
                          style={{ width: `${e.progress}%` }}
                        />
                      )}
                      {/* 左ハンドル */}
                      <span
                        onPointerDown={(ev) => beginDrag(e, 'left', ev)}
                        className="z-10 h-full w-3 cursor-ew-resize bg-black/10"
                        title="開始をドラッグ"
                      />
                      <span className="pointer-events-none z-0 flex-1 truncate px-1">
                        {e.title}
                        {e.kind === 'task' && (e.progress ?? 0) > 0
                          ? ` ${e.progress}%`
                          : ''}
                      </span>
                      {/* 右ハンドル */}
                      <span
                        onPointerDown={(ev) => beginDrag(e, 'right', ev)}
                        className="z-10 h-full w-3 cursor-ew-resize bg-black/10"
                        title="終了をドラッグ"
                      />
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        ))}
      </div>

      <EntrySheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        entry={editing}
        defaultStartLocal={defaultStart}
      />
    </div>
  )
}
