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
import { GROUP_COLORS, contrastText } from '@/lib/palette'
import type { Category, Entry, GroupKey } from '@/types/database'

const HOUR_H = 60 // 1時間の高さ(px)
const START_HOUR = 6 // 初期スクロール位置
const GUT = '2.5rem' // 左の時刻ラベル幅

type LaneKey = GroupKey | 'other'
const GROUP_ORDER: GroupKey[] = ['work', 'family', 'personal']
const LANE_LABEL: Record<LaneKey, string> = {
  work: '仕事',
  family: '家族',
  personal: '個人',
  other: '未分類',
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

  const groupOf = (e: Entry): LaneKey => {
    const g = e.category_id ? catMap.get(e.category_id)?.group_key : null
    return g ?? 'other'
  }
  const colorOf = (e: Entry) =>
    (e.category_id && catMap.get(e.category_id)?.color) || LANE_COLOR.other

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

  const bandEntries = visible.filter((e) => isBandEntry(e, day))

  // レーン一覧: 有効なグループ + 未分類（該当があれば）
  const lanes: LaneKey[] = useMemo(() => {
    const ks: LaneKey[] = GROUP_ORDER.filter((g) => active.includes(g))
    if (visible.some((e) => groupOf(e) === 'other' && !isBandEntry(e, day)))
      ks.push('other')
    return ks
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, visible, day])

  // 初期スクロールを 6:00 に
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = START_HOUR * HOUR_H
  }, [])

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

  function Block({
    e,
    left,
    width,
  }: {
    e: Entry
    left: string
    width: string
  }) {
    const top = (minutesFromDayStart(e.starts_at, day) / 60) * HOUR_H
    const endMin = minutesFromDayStart(e.ends_at, day)
    const h = Math.max(
      15,
      endMin - minutesFromDayStart(e.starts_at, day)
    )
    return (
      <button
        onClick={(ev) => {
          ev.stopPropagation()
          openEdit(e)
        }}
        className="absolute overflow-hidden rounded-md px-1 py-0.5 text-left text-[13px] leading-tight shadow-sm"
        style={{
          top,
          height: (h / 60) * HOUR_H - 2,
          left,
          width,
          backgroundColor: colorOf(e),
          color: contrastText(colorOf(e)),
        }}
      >
        <div className="truncate font-medium">{e.title}</div>
        <div className="truncate opacity-90">{fmtHm(e.starts_at)}</div>
      </button>
    )
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
      {/* 日付ナビ + 表示切替 */}
      <div className="flex items-center justify-between border-b border-gray-100 px-2 py-2">
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
        <div className="flex items-center gap-1">
          <div className="flex overflow-hidden rounded-lg border border-gray-200 text-xs">
            <button
              onClick={() => setMode('lanes')}
              className={
                'px-2 py-1 ' +
                (mode === 'lanes'
                  ? 'bg-group-work text-white'
                  : 'text-gray-500')
              }
            >
              レーン
            </button>
            <button
              onClick={() => setMode('single')}
              className={
                'px-2 py-1 ' +
                (mode === 'single'
                  ? 'bg-group-work text-white'
                  : 'text-gray-500')
              }
            >
              1本
            </button>
          </div>
          <button
            onClick={() => setDay((d) => addDays(d, 1))}
            className="min-h-tap min-w-tap text-gray-500"
            aria-label="翌日"
          >
            ›
          </button>
        </div>
      </div>

      {/* 終日・日またぎの帯 */}
      {bandEntries.length > 0 && (
        <div className="flex flex-col gap-1 border-b border-gray-100 bg-gray-50 px-2 py-1">
          {bandEntries.map((e) => (
            <button
              key={e.id}
              onClick={() => openEdit(e)}
              className="truncate rounded px-2 py-1 text-left text-xs"
              style={{
                backgroundColor: colorOf(e),
                color: contrastText(colorOf(e)),
              }}
            >
              {e.all_day ? '終日' : '期間'}・{e.title}
            </button>
          ))}
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
      <div ref={scrollRef} className="relative flex-1 overflow-y-auto">
        <div className="relative" style={{ height: 24 * HOUR_H }}>
          {HourGrid}

          {mode === 'lanes' ? (
            lanes.map((k, li) => {
              const laneEntries = visible.filter(
                (e) => groupOf(e) === k && !isBandEntry(e, day)
              )
              const blocks = layoutTimed(laneEntries, day)
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
                      e={b.entry}
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
              {layoutTimed(visible, day).map((b) => (
                <Block
                  key={b.entry.id}
                  e={b.entry}
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
