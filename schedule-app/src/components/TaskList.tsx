import { useMemo, useState } from 'react'
import {
  parseChecklist,
  serializeChecklist,
  checklistProgress,
} from '@/lib/checklist'
import { useSetProgress, useUpdateChecklist } from '@/hooks/useEntries'
import { useStartTimer, useRunningTimer } from '@/hooks/useTimeTracking'
import { fmtHm, fmtMd } from '@/lib/dates'
import type { Entry } from '@/types/database'

/** TODO（タスク）を大きなチェックで確認・完了できる共通リスト。 */
export default function TaskList({
  title,
  tasks,
  colorOf,
  onEdit,
  showDate = false,
  defaultOpen = true,
}: {
  title: string
  tasks: Entry[]
  colorOf: (e: Entry) => string
  onEdit: (e: Entry) => void
  showDate?: boolean
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  const setProgress = useSetProgress()
  const updateChecklist = useUpdateChecklist()
  const startTimer = useStartTimer()
  const { data: runningTimer } = useRunningTimer()

  const sorted = useMemo(() => {
    return [...tasks].sort((a, b) => {
      const da = (a.progress ?? 0) >= 100 ? 1 : 0
      const db = (b.progress ?? 0) >= 100 ? 1 : 0
      if (da !== db) return da - db
      return a.starts_at.localeCompare(b.starts_at)
    })
  }, [tasks])
  const remaining = sorted.filter((e) => (e.progress ?? 0) < 100).length

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
  const toggleItem = (e: Entry, idx: number) => {
    const items = parseChecklist(e.notes)
    const next = items.map((x, i) => (i === idx ? { ...x, done: !x.done } : x))
    updateChecklist.mutate({
      id: e.id,
      notes: serializeChecklist(next),
      progress: checklistProgress(next),
    })
  }

  if (sorted.length === 0) return null

  return (
    <div className="border-b border-gray-100 bg-white">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left"
      >
        <span className="text-sm font-bold text-gray-700">{title}</span>
        <span className="rounded-full bg-group-work/10 px-2 py-0.5 text-[11px] font-medium text-group-work">
          未完了 {remaining} / {sorted.length}
        </span>
        <span className="ml-auto text-gray-400">{open ? '▾' : '▸'}</span>
      </button>
      {open && (
        <ul className="max-h-56 space-y-1 overflow-y-auto px-2 pb-2">
          {sorted.map((e) => {
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
                    onClick={() => onEdit(e)}
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
                  {!done &&
                    (runningTimer?.entry_id === e.id ? (
                      <span className="shrink-0 animate-pulse text-[11px] font-medium text-red-500">
                        計測中
                      </span>
                    ) : (
                      <button
                        onClick={() =>
                          startTimer.mutate({
                            label: e.title,
                            entry_id: e.id,
                            category_id: e.category_id,
                          })
                        }
                        className="min-h-tap shrink-0 rounded-md bg-group-work/10 px-2 text-sm font-medium text-group-work"
                        aria-label="このタスクの計測を開始"
                      >
                        ▶
                      </button>
                    ))}
                  <span className="shrink-0 text-[11px] text-gray-400">
                    {showDate ? `${fmtMd(new Date(e.starts_at))} ` : ''}
                    {e.all_day ? '終日' : fmtHm(e.starts_at)}
                  </span>
                </div>
                {items.length > 0 && (
                  <ul className="mt-1 space-y-0.5 pl-8">
                    {items.map((it, i) => (
                      <li key={i}>
                        <button
                          onClick={() => toggleItem(e, i)}
                          className="flex w-full items-start gap-2 text-left text-[14px] leading-snug text-gray-700"
                        >
                          <span className="shrink-0 text-lg leading-none text-gray-500">
                            {it.done ? '☑' : '☐'}
                          </span>
                          <span className={it.done ? 'text-gray-400 line-through' : ''}>
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
  )
}
