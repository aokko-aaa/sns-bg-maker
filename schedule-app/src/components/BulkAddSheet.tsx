import { useMemo, useRef, useState } from 'react'
import BottomSheet from './BottomSheet'
import { useCategories } from '@/hooks/useCategories'
import { useBulkAddEntries } from '@/hooks/useEntries'
import { parseBulk } from '@/lib/parseBulk'
import { parseIcs } from '@/lib/parseIcs'
import {
  fmtHm,
  startOfDayJst,
  monthGrid,
  addMonths,
  fmtMonthLabel,
  dayKey,
  jstLocalToIso,
} from '@/lib/dates'
import { errMessage } from '@/lib/errors'
import { GROUP_LABELS } from '@/hooks/useGroupFilter'
import type { EntryKind, GroupKey } from '@/types/database'

const PLACEHOLDER = `例（1行に1件）:
2026/08/17 08:30-12:00
08/18 13:00-16:00
08/19            ← 時刻なしは終日
08/20 09:00 打合せ`

const WEEK = ['日', '月', '火', '水', '木', '金', '土']
type Mode = 'text' | 'calendar'

export default function BulkAddSheet({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const { data: categories = [] } = useCategories()
  const bulk = useBulkAddEntries()

  const [mode, setMode] = useState<Mode>('text')
  const [text, setText] = useState('')
  const [year, setYear] = useState(new Date().getFullYear())
  const [defaultTitle, setDefaultTitle] = useState('予定')
  const [categoryId, setCategoryId] = useState<string | null>(null)
  const [kind, setKind] = useState<EntryKind>('event')
  const [err, setErr] = useState<string | null>(null)
  const [done, setDone] = useState<number | null>(null)
  const [skipPast, setSkipPast] = useState(true)
  const fileInput = useRef<HTMLInputElement>(null)

  // カレンダー選択モード用
  const [calAnchor, setCalAnchor] = useState(() => new Date())
  const [selectedDays, setSelectedDays] = useState<Set<string>>(new Set())
  const [calTitle, setCalTitle] = useState('予定')
  const [calAllDay, setCalAllDay] = useState(false)
  const [calStart, setCalStart] = useState('09:00')
  const [calEnd, setCalEnd] = useState('10:00')

  // Googleカレンダーの書き出しは .ics(iCalendar)。BEGIN:VEVENT があれば .ics として解析。
  const isIcs = /BEGIN:VEVENT/i.test(text)
  const parsed = useMemo(
    () =>
      isIcs
        ? parseIcs(text, defaultTitle.trim() || '予定')
        : parseBulk(text, year, defaultTitle.trim() || '予定'),
    [text, year, defaultTitle, isIcs]
  )

  const rows = useMemo(() => {
    if (!isIcs || !skipPast) return parsed.rows
    const todayStart = startOfDayJst(new Date()).getTime()
    return parsed.rows.filter((r) => new Date(r.ends_at).getTime() >= todayStart)
  }, [parsed, isIcs, skipPast])
  const skippedPast = isIcs && skipPast ? parsed.rows.length - rows.length : 0

  const cells = useMemo(() => monthGrid(calAnchor), [calAnchor])

  const toggleDay = (date: Date) => {
    const k = dayKey(date)
    setSelectedDays((prev) => {
      const n = new Set(prev)
      if (n.has(k)) n.delete(k)
      else n.add(k)
      return n
    })
    setDone(null)
  }

  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setErr(null)
    setDone(null)
    try {
      setText(await file.text())
    } catch (ex) {
      setErr('ファイルの読み込みに失敗: ' + errMessage(ex))
    }
  }

  async function onRegisterText() {
    setErr(null)
    if (rows.length === 0) {
      setErr('登録できる行がありません')
      return
    }
    try {
      await bulk.mutateAsync(
        rows.map((r) => ({
          title: r.title,
          category_id: categoryId,
          kind: r.all_day ? kind : 'event',
          starts_at: r.starts_at,
          ends_at: r.ends_at,
          all_day: r.all_day,
        }))
      )
      setDone(rows.length)
      setText('')
    } catch (e) {
      setErr('登録に失敗: ' + errMessage(e))
    }
  }

  async function onRegisterCalendar() {
    setErr(null)
    const days = [...selectedDays].sort()
    if (days.length === 0) {
      setErr('カレンダーで日付を選んでください')
      return
    }
    const title = calTitle.trim() || '予定'
    try {
      const payload = days.map((d) => {
        if (calAllDay) {
          const s = jstLocalToIso(`${d}T00:00`)
          const e = new Date(new Date(s).getTime() + 86400000).toISOString()
          return {
            title,
            category_id: categoryId,
            kind,
            starts_at: s,
            ends_at: e,
            all_day: true,
          }
        }
        const s = jstLocalToIso(`${d}T${calStart}`)
        let e = jstLocalToIso(`${d}T${calEnd}`)
        if (new Date(e).getTime() <= new Date(s).getTime()) {
          e = new Date(new Date(s).getTime() + 3600000).toISOString()
        }
        return {
          title,
          category_id: categoryId,
          kind: 'event' as const,
          starts_at: s,
          ends_at: e,
          all_day: false,
        }
      })
      await bulk.mutateAsync(payload)
      setDone(days.length)
      setSelectedDays(new Set())
    } catch (e) {
      setErr('登録に失敗: ' + errMessage(e))
    }
  }

  const field =
    'min-h-tap w-full rounded-lg border border-gray-300 px-3 text-base'

  const CategorySelect = (
    <label className="text-sm text-gray-600">
      カテゴリ
      <select
        value={categoryId ?? ''}
        onChange={(e) => setCategoryId(e.target.value || null)}
        className={field + ' mt-1'}
      >
        <option value="">（未分類）</option>
        {(['work', 'family', 'personal'] as GroupKey[]).map((g) => {
          const cs = categories.filter((c) => c.group_key === g)
          if (cs.length === 0) return null
          return (
            <optgroup key={g} label={GROUP_LABELS[g]}>
              {cs.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </optgroup>
          )
        })}
      </select>
    </label>
  )

  const KindToggle = (
    <div className="flex gap-2">
      {(['event', 'task'] as EntryKind[]).map((k) => (
        <button
          key={k}
          onClick={() => setKind(k)}
          className={
            'min-h-tap flex-1 rounded-lg border text-sm ' +
            (kind === k
              ? 'border-group-work bg-group-work/10 font-medium text-group-work'
              : 'border-gray-300 text-gray-500')
          }
        >
          {k === 'event' ? '予定として' : 'TODOとして'}
        </button>
      ))}
    </div>
  )

  return (
    <BottomSheet open={open} onClose={onClose} title="まとめて追加">
      <div className="flex flex-col gap-3">
        {/* モード切替 */}
        <div className="flex overflow-hidden rounded-xl border border-gray-200">
          {(
            [
              ['text', '表・貼り付け'],
              ['calendar', '🗓️ カレンダーで選ぶ'],
            ] as const
          ).map(([m, label]) => (
            <button
              key={m}
              onClick={() => {
                setMode(m)
                setErr(null)
                setDone(null)
              }}
              className={
                'min-h-tap flex-1 text-sm font-medium ' +
                (mode === m ? 'bg-group-work text-white' : 'bg-white text-gray-500')
              }
            >
              {label}
            </button>
          ))}
        </div>

        {mode === 'text' ? (
          <>
            <p className="text-xs text-gray-500">
              日付と時刻を1行に1件ずつ貼り付け。時刻なしの行は終日になります。
              <br />
              Googleカレンダーの書き出し（.ics）ファイルもそのまま取り込めます。
            </p>

            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              className="min-h-tap rounded-lg border border-group-work/40 bg-group-work/5 text-sm font-medium text-group-work"
            >
              📅 Googleカレンダー(.ics)を読み込む
            </button>
            <input
              ref={fileInput}
              type="file"
              accept=".ics,text/calendar"
              onChange={onPickFile}
              className="hidden"
            />
            {isIcs && (
              <label className="-mt-1 flex items-center gap-2 text-sm text-gray-600">
                <input
                  type="checkbox"
                  checked={skipPast}
                  onChange={(e) => setSkipPast(e.target.checked)}
                  className="h-4 w-4"
                />
                過去の予定は取り込まない（今日以降だけ）
              </label>
            )}

            <textarea
              value={text}
              onChange={(e) => {
                setText(e.target.value)
                setDone(null)
              }}
              placeholder={PLACEHOLDER}
              rows={6}
              className={field + ' resize-none py-2 font-mono text-sm'}
            />

            <div className="flex gap-2">
              {!isIcs && (
                <label className="flex-1 text-sm text-gray-600">
                  年（月日だけの行に適用）
                  <input
                    type="number"
                    value={year}
                    onChange={(e) => setYear(Number(e.target.value))}
                    className={field + ' mt-1'}
                  />
                </label>
              )}
              <label className="flex-1 text-sm text-gray-600">
                共通タイトル
                <input
                  value={defaultTitle}
                  onChange={(e) => setDefaultTitle(e.target.value)}
                  placeholder="例: 勤務"
                  className={field + ' mt-1'}
                />
              </label>
            </div>

            {CategorySelect}
            {KindToggle}
            <p className="-mt-1 text-[11px] text-gray-400">
              ※ 時刻ありの行は常に「予定」。時刻なし（終日）の行にのみ上の種別が適用されます。
            </p>

            {text.trim() && (
              <div className="rounded-lg border border-gray-100 bg-gray-50 p-2">
                <p className="mb-1 text-xs font-medium text-gray-600">
                  プレビュー: {rows.length}件
                  {skippedPast > 0 && (
                    <span className="text-gray-400"> / 過去を除外 {skippedPast}</span>
                  )}
                  {parsed.errors.length > 0 && (
                    <span className="text-red-500">
                      {' '}
                      / 読めない行 {parsed.errors.length}
                    </span>
                  )}
                </p>
                <ul className="max-h-32 space-y-0.5 overflow-y-auto text-xs">
                  {rows.map((r, i) => (
                    <li key={i} className="text-gray-700">
                      {r.starts_at.slice(0, 10)}{' '}
                      {r.all_day ? '終日' : `${fmtHm(r.starts_at)}–${fmtHm(r.ends_at)}`}{' '}
                      {r.title}
                    </li>
                  ))}
                  {parsed.errors.map((e, i) => (
                    <li key={'e' + i} className="text-red-400">
                      ✗ {e}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {err && <p className="text-sm text-red-600">{err}</p>}
            {done != null && (
              <p className="text-sm text-green-600">{done}件を登録しました ✓</p>
            )}

            <button
              onClick={onRegisterText}
              disabled={bulk.isPending || rows.length === 0}
              className="min-h-tap rounded-lg bg-group-work font-medium text-white disabled:opacity-40"
            >
              {bulk.isPending ? '登録中…' : `${rows.length}件をまとめて登録`}
            </button>
          </>
        ) : (
          <>
            <p className="text-xs text-gray-500">
              同じ予定を入れたい日を、カレンダーでいくつでもタップして選べます（バラバラの日でOK）。
            </p>

            <label className="text-sm text-gray-600">
              予定名
              <input
                value={calTitle}
                onChange={(e) => setCalTitle(e.target.value)}
                placeholder="例: 勤務 / 通院"
                className={field + ' mt-1'}
              />
            </label>

            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={calAllDay}
                onChange={(e) => setCalAllDay(e.target.checked)}
                className="h-5 w-5"
              />
              終日・時間未定
            </label>
            {!calAllDay && (
              <div className="flex items-center gap-2">
                <label className="flex-1 text-sm text-gray-600">
                  開始
                  <input
                    type="time"
                    value={calStart}
                    onChange={(e) => setCalStart(e.target.value)}
                    className={field + ' mt-1'}
                  />
                </label>
                <span className="mt-5 text-gray-400">〜</span>
                <label className="flex-1 text-sm text-gray-600">
                  終了
                  <input
                    type="time"
                    value={calEnd}
                    onChange={(e) => setCalEnd(e.target.value)}
                    className={field + ' mt-1'}
                  />
                </label>
              </div>
            )}

            {CategorySelect}
            {KindToggle}

            {/* 月カレンダー（複数選択） */}
            <div className="rounded-xl border border-gray-200 p-2">
              <div className="mb-1 flex items-center justify-between">
                <button
                  onClick={() => setCalAnchor((d) => addMonths(d, -1))}
                  className="min-h-tap min-w-tap text-gray-500"
                  aria-label="前月"
                >
                  ‹
                </button>
                <span className="text-base font-bold text-gray-800">
                  {fmtMonthLabel(calAnchor)}
                </span>
                <button
                  onClick={() => setCalAnchor((d) => addMonths(d, 1))}
                  className="min-h-tap min-w-tap text-gray-500"
                  aria-label="翌月"
                >
                  ›
                </button>
              </div>
              <div className="grid grid-cols-7 text-center text-[11px] text-gray-400">
                {WEEK.map((w, i) => (
                  <div
                    key={w}
                    className={i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : ''}
                  >
                    {w}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7">
                {cells.map(({ key, date, inMonth }) => {
                  const sel = selectedDays.has(key)
                  return (
                    <button
                      key={key}
                      onClick={() => toggleDay(date)}
                      className="flex items-center justify-center py-1"
                    >
                      <span
                        className={
                          'flex h-8 w-8 items-center justify-center rounded-full text-sm ' +
                          (sel
                            ? 'bg-group-work font-bold text-white'
                            : inMonth
                              ? 'text-gray-700'
                              : 'text-gray-300')
                        }
                      >
                        {Number(key.slice(-2))}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>

            <p className="text-sm font-medium text-gray-600">
              選択中: {selectedDays.size} 日
              {selectedDays.size > 0 && (
                <button
                  onClick={() => setSelectedDays(new Set())}
                  className="ml-2 text-xs text-gray-400 underline"
                >
                  クリア
                </button>
              )}
            </p>

            {err && <p className="text-sm text-red-600">{err}</p>}
            {done != null && (
              <p className="text-sm text-green-600">{done}件を登録しました ✓</p>
            )}

            <button
              onClick={onRegisterCalendar}
              disabled={bulk.isPending || selectedDays.size === 0}
              className="min-h-tap rounded-lg bg-group-work font-medium text-white disabled:opacity-40"
            >
              {bulk.isPending
                ? '登録中…'
                : `選んだ ${selectedDays.size} 日に登録`}
            </button>
          </>
        )}
      </div>
    </BottomSheet>
  )
}
