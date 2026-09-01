import { useMemo, useRef, useState } from 'react'
import { useCategories } from '@/hooks/useCategories'
import { useBulkAddEntries } from '@/hooks/useEntries'
import { parseBulk } from '@/lib/parseBulk'
import { parseCsv } from '@/lib/parseCsv'
import { parseIcs } from '@/lib/parseIcs'
import { fmtHm, startOfDayJst } from '@/lib/dates'
import { errMessage } from '@/lib/errors'
import { GROUP_LABELS } from '@/hooks/useGroupFilter'
import type { EntryKind, GroupKey } from '@/types/database'

const PLACEHOLDER = `例（1行に1件）:
2026/08/17 08:30-12:00
08/18 13:00-16:00
08/19            ← 時刻なしは終日
08/20 09:00 打合せ

CSV/表形式もOK:
日付,開始,終了,タイトル
2026/08/21,09:00,10:00,面談`

/**
 * CSV / 表 / .ics でまとめて登録するパネル。BottomSheet の枠は持たず、
 * 予定追加シート（EntrySheet）の中に「CSVで一括」モードとして埋め込む。
 */
export default function BulkAddPanel({ onDone }: { onDone?: () => void }) {
  const { data: categories = [] } = useCategories()
  const bulk = useBulkAddEntries()

  const [text, setText] = useState('')
  const [year, setYear] = useState(new Date().getFullYear())
  const [defaultTitle, setDefaultTitle] = useState('予定')
  const [categoryId, setCategoryId] = useState<string | null>(null)
  const [kind, setKind] = useState<EntryKind>('event')
  const [err, setErr] = useState<string | null>(null)
  const [done, setDone] = useState<number | null>(null)
  const [skipPast, setSkipPast] = useState(true)
  const fileInput = useRef<HTMLInputElement>(null)

  // Googleカレンダーの書き出しは .ics(iCalendar)。BEGIN:VEVENT があれば .ics として解析。
  const isIcs = /BEGIN:VEVENT/i.test(text)
  // カンマ/タブ区切りが1行でもあれば CSV/TSV として解析（.ics 以外）。
  const isCsv =
    !isIcs && text.split('\n').some((l) => l.includes(',') || l.includes('\t'))
  const parsed = useMemo(
    () =>
      isIcs
        ? parseIcs(text, defaultTitle.trim() || '予定')
        : isCsv
          ? parseCsv(text, year, defaultTitle.trim() || '予定')
          : parseBulk(text, year, defaultTitle.trim() || '予定'),
    [text, year, defaultTitle, isIcs, isCsv]
  )

  // ファイル取り込み(.ics / CSV)時は「過去の予定を入れない」フィルタ（今日以降だけ）を適用できる。
  const canSkipPast = isIcs || isCsv
  const rows = useMemo(() => {
    if (!canSkipPast || !skipPast) return parsed.rows
    const todayStart = startOfDayJst(new Date()).getTime()
    return parsed.rows.filter((r) => new Date(r.ends_at).getTime() >= todayStart)
  }, [parsed, canSkipPast, skipPast])
  const skippedPast = canSkipPast && skipPast ? parsed.rows.length - rows.length : 0

  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = '' // 同じファイルを再選択できるようにリセット
    if (!file) return
    setErr(null)
    setDone(null)
    try {
      const content = await file.text()
      setText(content)
    } catch (ex) {
      setErr('ファイルの読み込みに失敗: ' + errMessage(ex))
    }
  }

  async function onRegister() {
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
      onDone?.()
    } catch (e) {
      setErr('登録に失敗: ' + errMessage(e))
    }
  }

  const field =
    'min-h-tap w-full rounded-lg border border-gray-300 px-3 text-base'

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-gray-500">
        日付と時刻を1行に1件ずつ。時刻なしの行は終日になります。
        <br />
        Googleカレンダー(.ics)や、CSV / txt ファイルもそのまま取り込めます。
        <br />
        CSV例:{' '}
        <code className="rounded bg-gray-100 px-1">日付,開始,終了,タイトル</code>
      </p>

      <button
        type="button"
        onClick={() => fileInput.current?.click()}
        className="min-h-tap rounded-lg border border-group-work/40 bg-group-work/5 text-sm font-medium text-group-work"
      >
        📄 ファイルを読み込む（.ics / .csv / .txt）
      </button>
      <input
        ref={fileInput}
        type="file"
        accept=".ics,.csv,.txt,text/calendar,text/csv,text/plain"
        onChange={onPickFile}
        className="hidden"
      />
      {(isIcs || isCsv) && (
        <div className="-mt-1 flex flex-col gap-1">
          <p className="text-[11px] text-group-work">
            {isIcs
              ? '✓ カレンダー形式(.ics)として読み取っています'
              : '✓ CSV / 表形式として読み取っています'}
          </p>
          <label className="flex items-center gap-2 text-sm text-gray-600">
            <input
              type="checkbox"
              checked={skipPast}
              onChange={(e) => setSkipPast(e.target.checked)}
              className="h-4 w-4"
            />
            過去の予定は取り込まない（今日以降だけ）
          </label>
        </div>
      )}

      <textarea
        value={text}
        onChange={(e) => {
          setText(e.target.value)
          setDone(null)
        }}
        placeholder={PLACEHOLDER}
        rows={7}
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
      <p className="-mt-1 text-[11px] text-gray-400">
        ※ 時刻ありの行は常に「予定」。時刻なし（終日）の行にのみ上の種別が適用されます。
      </p>

      {/* プレビュー */}
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
          <ul className="max-h-40 space-y-0.5 overflow-y-auto text-xs">
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
        onClick={onRegister}
        disabled={bulk.isPending || rows.length === 0}
        className="min-h-tap rounded-lg bg-group-work font-medium text-white disabled:opacity-40"
      >
        {bulk.isPending ? '登録中…' : `${rows.length}件をまとめて登録`}
      </button>
    </div>
  )
}
