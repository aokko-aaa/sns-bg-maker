import { useMemo, useState } from 'react'
import BottomSheet from './BottomSheet'
import { useCategories } from '@/hooks/useCategories'
import { useBulkAddEntries } from '@/hooks/useEntries'
import { parseBulk } from '@/lib/parseBulk'
import { fmtHm } from '@/lib/dates'
import { errMessage } from '@/lib/errors'
import type { EntryKind } from '@/types/database'

const PLACEHOLDER = `例（1行に1件）:
2026/08/17 08:30-12:00
08/18 13:00-16:00
08/19            ← 時刻なしは終日
08/20 09:00 打合せ`

export default function BulkAddSheet({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const { data: categories = [] } = useCategories()
  const bulk = useBulkAddEntries()

  const [text, setText] = useState('')
  const [year, setYear] = useState(new Date().getFullYear())
  const [defaultTitle, setDefaultTitle] = useState('予定')
  const [categoryId, setCategoryId] = useState<string | null>(null)
  const [kind, setKind] = useState<EntryKind>('event')
  const [err, setErr] = useState<string | null>(null)
  const [done, setDone] = useState<number | null>(null)

  const parsed = useMemo(
    () => parseBulk(text, year, defaultTitle.trim() || '予定'),
    [text, year, defaultTitle]
  )

  async function onRegister() {
    setErr(null)
    if (parsed.rows.length === 0) {
      setErr('登録できる行がありません')
      return
    }
    try {
      await bulk.mutateAsync(
        parsed.rows.map((r) => ({
          title: r.title,
          category_id: categoryId,
          kind: r.all_day ? kind : 'event',
          starts_at: r.starts_at,
          ends_at: r.ends_at,
          all_day: r.all_day,
        }))
      )
      setDone(parsed.rows.length)
      setText('')
    } catch (e) {
      setErr('登録に失敗: ' + errMessage(e))
    }
  }

  const field =
    'min-h-tap w-full rounded-lg border border-gray-300 px-3 text-base'

  return (
    <BottomSheet open={open} onClose={onClose} title="表から一括追加">
      <div className="flex flex-col gap-3">
        <p className="text-xs text-gray-500">
          日付と時刻を1行に1件ずつ貼り付けてください。時刻なしの行は終日になります。
        </p>

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
          <label className="flex-1 text-sm text-gray-600">
            年（月日だけの行に適用）
            <input
              type="number"
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className={field + ' mt-1'}
            />
          </label>
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
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
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
              プレビュー: {parsed.rows.length}件
              {parsed.errors.length > 0 && (
                <span className="text-red-500">
                  {' '}
                  / 読めない行 {parsed.errors.length}
                </span>
              )}
            </p>
            <ul className="max-h-40 space-y-0.5 overflow-y-auto text-xs">
              {parsed.rows.map((r, i) => (
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
          disabled={bulk.isPending || parsed.rows.length === 0}
          className="min-h-tap rounded-lg bg-group-work font-medium text-white disabled:opacity-40"
        >
          {bulk.isPending ? '登録中…' : `${parsed.rows.length}件をまとめて登録`}
        </button>
      </div>
    </BottomSheet>
  )
}
