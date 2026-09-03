import { useEffect, useState } from 'react'
import { useRunningTimers, useStopTimer } from '@/hooks/useTimeTracking'
import { fmtElapsed } from '@/lib/duration'
import TimerStartSheet from './TimerStartSheet'

export default function TimerBar() {
  const { data: running = [] } = useRunningTimers()
  const stop = useStopTimer()
  const [startOpen, setStartOpen] = useState(false)
  const [now, setNow] = useState(() => Date.now())

  // 計測中は1秒ごとに経過時間を更新
  useEffect(() => {
    if (running.length === 0) return
    setNow(Date.now())
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [running.length])

  return (
    <>
      <div className="surface-translucent border-t border-white/40 px-3 py-2">
        {running.length > 0 ? (
          <div className="flex flex-col gap-1.5">
            {/* 走っている計測をすべて表示（同時計測OK）。各レーンごとに停止できる */}
            <div className="flex max-h-36 flex-col gap-1.5 overflow-y-auto">
              {running.map((r) => {
                const ms = now - new Date(r.started_at).getTime()
                return (
                  <div
                    key={r.id}
                    className="flex items-center gap-2 rounded-lg bg-group-work/10 px-3 py-2"
                  >
                    <span className="h-2.5 w-2.5 shrink-0 animate-pulse rounded-full bg-red-500" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-gray-800">
                        {r.label}
                      </div>
                      <div className="font-mono text-xs tabular-nums text-group-work">
                        {fmtElapsed(ms)}
                      </div>
                    </div>
                    <button
                      onClick={() => stop.mutate(r.id)}
                      disabled={stop.isPending}
                      className="min-h-tap shrink-0 rounded-lg bg-group-work px-4 font-medium text-white disabled:opacity-40"
                    >
                      ■ 停止
                    </button>
                  </div>
                )
              })}
            </div>
            {/* もう1つ並行して計測を追加 */}
            <button
              onClick={() => setStartOpen(true)}
              className="min-h-tap flex items-center justify-center gap-1 rounded-lg border border-dashed border-group-work/50 text-sm font-medium text-group-work"
            >
              ＋ 計測を追加（同時計測）
            </button>
          </div>
        ) : (
          <button
            onClick={() => setStartOpen(true)}
            className="min-h-tap flex w-full items-center justify-center gap-2 rounded-lg border border-group-work/40 bg-group-work/5 text-sm font-medium text-group-work"
          >
            ▶ 作業を計測する
          </button>
        )}
      </div>
      <TimerStartSheet open={startOpen} onClose={() => setStartOpen(false)} />
    </>
  )
}
