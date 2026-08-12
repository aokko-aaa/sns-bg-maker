import { useEffect, useState } from 'react'
import BottomSheet from './BottomSheet'
import { useCategories } from '@/hooks/useCategories'
import {
  useDeleteEntry,
  useSaveEntry,
  type EntryInput,
} from '@/hooks/useEntries'
import { isoToJstLocal, jstLocalToIso } from '@/lib/dates'
import type { Entry, EntryKind } from '@/types/database'

interface Props {
  open: boolean
  onClose: () => void
  /** 編集対象。null なら新規 */
  entry: Entry | null
  /** 新規時の初期日時（JST datetime-local 文字列） */
  defaultStartLocal?: string
}

export default function EntrySheet({
  open,
  onClose,
  entry,
  defaultStartLocal,
}: Props) {
  const { data: categories = [] } = useCategories()
  const save = useSaveEntry()
  const del = useDeleteEntry()

  const [title, setTitle] = useState('')
  const [kind, setKind] = useState<EntryKind>('event')
  const [categoryId, setCategoryId] = useState<string | null>(null)
  const [allDay, setAllDay] = useState(false)
  const [startLocal, setStartLocal] = useState('')
  const [endLocal, setEndLocal] = useState('')
  const [progress, setProgress] = useState(0)
  const [notes, setNotes] = useState('')
  const [err, setErr] = useState<string | null>(null)

  // 開くたびに初期値を流し込む
  useEffect(() => {
    if (!open) return
    if (entry) {
      setTitle(entry.title)
      setKind(entry.kind)
      setCategoryId(entry.category_id)
      setAllDay(entry.all_day)
      setStartLocal(isoToJstLocal(entry.starts_at))
      setEndLocal(isoToJstLocal(entry.ends_at))
      setProgress(entry.progress ?? 0)
      setNotes(entry.notes ?? '')
    } else {
      const base = defaultStartLocal ?? isoToJstLocal(new Date().toISOString())
      // 開始の1時間後をデフォルト終了に（要件 6-4: event は60分）
      const endDate = new Date(jstLocalToIso(base))
      endDate.setHours(endDate.getHours() + 1)
      setTitle('')
      setKind('event')
      setCategoryId(categories[0]?.id ?? null)
      setAllDay(false)
      setStartLocal(base)
      setEndLocal(isoToJstLocal(endDate.toISOString()))
      setProgress(0)
      setNotes('')
    }
    setErr(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, entry])

  async function onSave() {
    if (!title.trim()) {
      setErr('タイトルを入力してください')
      return
    }
    const startsIso = jstLocalToIso(startLocal)
    const endsIso = allDay
      ? jstLocalToIso(startLocal)
      : jstLocalToIso(endLocal)
    if (!allDay && new Date(endsIso) <= new Date(startsIso)) {
      setErr('終了は開始より後にしてください')
      return
    }
    const payload: EntryInput = {
      id: entry?.id,
      title: title.trim(),
      category_id: categoryId,
      kind,
      starts_at: startsIso,
      ends_at: endsIso,
      all_day: allDay,
      progress: kind === 'task' ? progress : 0,
      notes: notes.trim() || null,
      source: entry?.source ?? 'manual',
      inbox_id: entry?.inbox_id ?? null,
    }
    try {
      await save.mutateAsync(payload)
      onClose()
    } catch (e) {
      setErr(e instanceof Error ? e.message : '保存に失敗しました')
    }
  }

  async function onDelete() {
    if (!entry) return
    if (!confirm('この予定を削除しますか？')) return
    try {
      await del.mutateAsync(entry.id)
      onClose()
    } catch (e) {
      setErr(e instanceof Error ? e.message : '削除に失敗しました')
    }
  }

  const label = 'text-sm text-gray-600'
  const field =
    'mt-1 min-h-tap w-full rounded-lg border border-gray-300 px-3 text-base'

  return (
    <BottomSheet open={open} onClose={onClose} title={entry ? '予定を編集' : '予定を追加'}>
      <div className="flex flex-col gap-3">
        <label className={label}>
          タイトル
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className={field}
            placeholder="例: 歯医者"
          />
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
              {k === 'event' ? '予定' : '期間タスク'}
            </button>
          ))}
        </div>

        <label className={label}>
          カテゴリ
          <select
            value={categoryId ?? ''}
            onChange={(e) => setCategoryId(e.target.value || null)}
            className={field}
          >
            <option value="">（未分類）</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={allDay}
            onChange={(e) => setAllDay(e.target.checked)}
            className="h-5 w-5"
          />
          終日
        </label>

        <label className={label}>
          開始
          <input
            type="datetime-local"
            value={startLocal}
            onChange={(e) => setStartLocal(e.target.value)}
            className={field}
          />
        </label>

        {!allDay && (
          <label className={label}>
            終了
            <input
              type="datetime-local"
              value={endLocal}
              onChange={(e) => setEndLocal(e.target.value)}
              className={field}
            />
          </label>
        )}

        {kind === 'task' && (
          <label className={label}>
            進捗: {progress}%
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={progress}
              onChange={(e) => setProgress(Number(e.target.value))}
              className="mt-1 w-full"
            />
          </label>
        )}

        <label className={label}>
          メモ
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className={field + ' min-h-[72px] py-2'}
          />
        </label>

        {err && <p className="text-sm text-red-600">{err}</p>}

        <div className="mt-1 flex gap-2">
          {entry && (
            <button
              onClick={onDelete}
              className="min-h-tap rounded-lg border border-red-300 px-4 text-sm text-red-600"
            >
              削除
            </button>
          )}
          <button
            onClick={onSave}
            disabled={save.isPending}
            className="min-h-tap flex-1 rounded-lg bg-group-work font-medium text-white disabled:opacity-50"
          >
            {save.isPending ? '保存中…' : '保存'}
          </button>
        </div>
      </div>
    </BottomSheet>
  )
}
