import { useMemo, useState } from 'react'
import { formatInTimeZone } from 'date-fns-tz'
import { useTimeLogsInRange, useDeleteTimeLog } from '@/hooks/useTimeTracking'
import { useCategories } from '@/hooks/useCategories'
import { fmtHours, logDurationMs } from '@/lib/duration'
import {
  addDays,
  addMonths,
  startOfDayJst,
  startOfWeekJst,
  fmtDateLabel,
  fmtHm,
  fmtMd,
  fmtMonthLabel,
  jstLocalToIso,
} from '@/lib/dates'
import { TZ } from '@/lib/time'
import type { Category } from '@/types/database'

type Range = 'day' | 'week' | 'month'
const RANGE_LABEL: Record<Range, string> = { day: '日', week: '週', month: '月' }

export default function ReportView() {
  const [range, setRange] = useState<Range>('day')
  const [anchor, setAnchor] = useState(() => new Date())
  const { data: categories = [] } = useCategories()
  const del = useDeleteTimeLog()

  const catMap = useMemo(() => {
    const m = new Map<string, Category>()
    categories.forEach((c) => m.set(c.id, c))
    return m
  }, [categories])

  const { start, end, label } = useMemo(() => {
    if (range === 'day') {
      const s = startOfDayJst(anchor)
      return { start: s, end: addDays(s, 1), label: fmtDateLabel(anchor) }
    }
    if (range === 'week') {
      const s = startOfWeekJst(anchor)
      const e = addDays(s, 7)
      return {
        start: s,
        end: e,
        label: `${fmtMd(s)} – ${fmtMd(addDays(s, 6))}`,
      }
    }
    // month
    const ym = formatInTimeZone(anchor, TZ, 'yyyy-MM')
    const s = new Date(jstLocalToIso(`${ym}-01T00:00`))
    return { start: s, end: addMonths(s, 1), label: fmtMonthLabel(anchor) }
  }, [range, anchor])

  const { data: logs = [], isLoading } = useTimeLogsInRange(start, end)
  const now = Date.now()

  const totalMs = useMemo(
    () => logs.reduce((s, l) => s + logDurationMs(l, now), 0),
    [logs, now]
  )

  // 分類ごとの合計
  const byCat = useMemo(() => {
    const m = new Map<string | null, number>()
    logs.forEach((l) =>
      m.set(l.category_id, (m.get(l.category_id) ?? 0) + logDurationMs(l, now))
    )
    return [...m.entries()].sort((a, b) => b[1] - a[1])
  }, [logs, now])

  function move(dir: -1 | 1) {
    setAnchor((d) =>
      range === 'day'
        ? addDays(d, dir)
        : range === 'week'
          ? addDays(d, dir * 7)
          : addMonths(d, dir)
    )
  }

  const catInfo = (id: string | null) => {
    if (id && catMap.has(id)) {
      const c = catMap.get(id)!
      return { name: c.name, color: c.color }
    }
    return { name: '未分類', color: '#c4c9d2' }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* 期間の種類切替 */}
      <div className="flex justify-center gap-1 px-2 pt-2">
        <div className="flex overflow-hidden rounded-lg border border-gray-200 text-sm">
          {(['day', 'week', 'month'] as Range[]).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={
                'px-4 py-1 ' +
                (range === r ? 'bg-group-work text-white' : 'text-gray-500')
              }
            >
              {RANGE_LABEL[r]}
            </button>
          ))}
        </div>
      </div>

      {/* 期間ナビ */}
      <div className="flex items-center justify-between px-2 py-2">
        <button
          onClick={() => move(-1)}
          className="min-h-tap min-w-tap text-2xl text-gray-400"
          aria-label="前へ"
        >
          ‹
        </button>
        <button
          onClick={() => setAnchor(new Date())}
          className="text-lg font-bold text-gray-800"
        >
          {label}
        </button>
        <button
          onClick={() => move(1)}
          className="min-h-tap min-w-tap text-2xl text-gray-400"
          aria-label="次へ"
        >
          ›
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-4">
        {/* 合計 */}
        <div className="mb-3 rounded-xl border border-gray-100 bg-white p-4 text-center shadow-sm">
          <p className="text-xs text-gray-500">合計 稼働時間</p>
          <p className="mt-1 text-3xl font-bold text-gray-800">
            {fmtHours(totalMs)}
          </p>
          <p className="mt-1 text-[11px] text-gray-400">{logs.length}件の記録</p>
        </div>

        {/* 分類別の内訳 */}
        {byCat.length > 0 && (
          <div className="mb-3">
            <p className="mb-1 text-xs font-medium text-gray-600">分類別</p>
            <div className="flex flex-col gap-2">
              {byCat.map(([id, ms]) => {
                const info = catInfo(id)
                const pct = totalMs > 0 ? (ms / totalMs) * 100 : 0
                return (
                  <div key={id ?? 'none'}>
                    <div className="mb-0.5 flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1.5 text-gray-700">
                        <span
                          className="h-3 w-3 rounded-full"
                          style={{ backgroundColor: info.color }}
                        />
                        {info.name}
                      </span>
                      <span className="text-gray-500">{fmtHours(ms)}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${pct}%`, backgroundColor: info.color }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* 記録の一覧 */}
        <p className="mb-1 text-xs font-medium text-gray-600">記録</p>
        {isLoading ? (
          <p className="py-6 text-center text-sm text-gray-400">読み込み中…</p>
        ) : logs.length === 0 ? (
          <p className="py-6 text-center text-sm text-gray-400">
            この期間の記録はありません
          </p>
        ) : (
          <ul className="flex flex-col gap-1">
            {logs.map((l) => {
              const info = catInfo(l.category_id)
              const running = !l.ended_at
              return (
                <li
                  key={l.id}
                  className="flex items-center gap-2 rounded-lg border border-gray-100 bg-white px-2 py-1.5 text-sm"
                >
                  <span
                    className="h-3 w-3 shrink-0 rounded-full"
                    style={{ backgroundColor: info.color }}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-gray-800">{l.label}</div>
                    <div className="text-[11px] text-gray-400">
                      {fmtMd(new Date(l.started_at))} {fmtHm(l.started_at)}–
                      {running ? '計測中' : fmtHm(l.ended_at!)}
                    </div>
                  </div>
                  <span className="shrink-0 font-medium text-gray-700">
                    {fmtHours(logDurationMs(l, now))}
                  </span>
                  <button
                    onClick={() => {
                      if (confirm('この記録を削除しますか？')) del.mutate(l.id)
                    }}
                    className="shrink-0 px-1 text-gray-300"
                    aria-label="削除"
                  >
                    ×
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
