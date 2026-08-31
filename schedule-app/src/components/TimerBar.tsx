import { useEffect, useState } from 'react'
import { useRunningTimer, useStopTimer } from '@/hooks/useTimeTracking'
import { fmtElapsed } from '@/lib/duration'
import TimerStartSheet from './TimerStartSheet'

export default function TimerBar() {
  const { data: running } = useRunningTimer()
  const stop = useStopTimer()
  const [startOpen, setStartOpen] = useState(false)
  const [now, setNow] = useState(() => Date.now())

  // 計測中は1秒ごとに経過時間を更新
  useEffect(() => {
    if (!running) return
    setNow(Date.now())
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [running])

  if (running) {
    const ms = now - new Date(running.started_at).getTime()
    return (
      <div className="surface-translucent border-t border-white/40 px-3 py-2">
        <div className="flex items-center gap-2 rounded-lg bg-group-work/10 px-3 py-2">
          <span className="h-2.5 w-2.5 shrink-0 animate-pulse rounded-full bg-red-500" />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium text-gray-800">
              {running.label}
            </div>
            <div className="font-mono text-xs tabular-nums text-group-work">
              {fmtElapsed(ms)}
            </div>
          </div>
          <button
            onClick={() => stop.mutate()}
            disabled={stop.isPending}
            className="min-h-tap shrink-0 rounded-lg bg-group-work px-4 font-medium text-white disabled:opacity-40"
          >
            ■ 停止
          </button>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="surface-translucent border-t border-white/40 px-3 py-1.5">
        <button
          onClick={() => setStartOpen(true)}
          className="min-h-tap flex w-full items-center justify-center gap-2 rounded-lg border border-group-work/40 bg-group-work/5 text-sm font-medium text-group-work"
        >
          ▶ 作業を計測する
        </button>
      </div>
      <TimerStartSheet open={startOpen} onClose={() => setStartOpen(false)} />
    </>
  )
}
