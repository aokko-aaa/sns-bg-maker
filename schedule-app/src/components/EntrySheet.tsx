import { useEffect, useState } from 'react'
import BottomSheet from './BottomSheet'
import { useCategories, useAddCategoryReturning } from '@/hooks/useCategories'
import { GROUP_LABELS } from '@/hooks/useGroupFilter'
import type { GroupKey } from '@/types/database'
import {
  useDeleteEntry,
  useSaveEntry,
  type EntryInput,
} from '@/hooks/useEntries'
import { isoToJstLocal, jstLocalToIso } from '@/lib/dates'
import { errMessage } from '@/lib/errors'
import {
  checklistProgress,
  parseChecklist,
  serializeChecklist,
  type ChecklistItem,
} from '@/lib/checklist'
import type { Entry, EntryKind } from '@/types/database'

interface Props {
  open: boolean
  onClose: () => void
  /** 編集対象。null なら新規 */
  entry: Entry | null
  /** 新規時の初期日時（JST datetime-local 文字列） */
  defaultStartLocal?: string
  /** 新規時の初期カテゴリ（レーンから追加したとき用） */
  defaultCategoryId?: string | null
  /** 新規時の初期タイトル（受信箱からの手動予定化など） */
  defaultTitle?: string
  /** 受信箱由来として紐付ける inbox_id（指定時 source='inbox'） */
  inboxId?: string
  /** 保存成功後に呼ばれる（受信箱ステータス更新などに使う） */
  onSaved?: () => void
}

export default function EntrySheet({
  open,
  onClose,
  entry,
  defaultStartLocal,
  defaultCategoryId,
  defaultTitle,
  inboxId,
  onSaved,
}: Props) {
  const { data: categories = [] } = useCategories()
  const addCat = useAddCategoryReturning()
  const save = useSaveEntry()
  const del = useDeleteEntry()

  const [title, setTitle] = useState('')
  const [kind, setKind] = useState<EntryKind>('event')
  const [group, setGroup] = useState<GroupKey>('work')
  const [categoryId, setCategoryId] = useState<string | null>(null)
  const [allDay, setAllDay] = useState(false)
  const [startLocal, setStartLocal] = useState('')
  const [endLocal, setEndLocal] = useState('')
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState<ChecklistItem[]>([])
  const [err, setErr] = useState<string | null>(null)

  // カテゴリ追加（選んでいる大分類の中に作る → すぐ選択）
  async function onAddCategory() {
    const name = window.prompt(
      `「${GROUP_LABELS[group]}」に追加する中分類の名前（例: A社）`
    )
    if (!name || !name.trim()) return
    try {
      const c = await addCat.mutateAsync({ name: name.trim(), group_key: group })
      setCategoryId(c.id)
    } catch (e) {
      setErr('カテゴリ追加に失敗: ' + errMessage(e))
    }
  }

  // 大分類を変えたら、その大分類の先頭の中分類を選び直す
  function selectGroup(g: GroupKey) {
    setGroup(g)
    const first = categories.find((c) => c.group_key === g)
    setCategoryId(first?.id ?? null)
  }

  // 開くたびに初期値を流し込む
  useEffect(() => {
    if (!open) return
    if (entry) {
      const cat = entry.category_id
        ? categories.find((c) => c.id === entry.category_id)
        : undefined
      setTitle(entry.title)
      setKind(entry.kind)
      setGroup(cat?.group_key ?? 'work')
      setCategoryId(entry.category_id)
      setAllDay(entry.all_day)
      setStartLocal(isoToJstLocal(entry.starts_at))
      setEndLocal(isoToJstLocal(entry.ends_at))
      if (entry.kind === 'task') {
        setItems(parseChecklist(entry.notes))
        setNotes('')
      } else {
        setItems([])
        setNotes(entry.notes ?? '')
      }
    } else {
      const base = defaultStartLocal ?? isoToJstLocal(new Date().toISOString())
      // 開始の1時間後をデフォルト終了に（要件 6-4: event は60分）
      const endDate = new Date(jstLocalToIso(base))
      endDate.setHours(endDate.getHours() + 1)
      const dc = defaultCategoryId
        ? categories.find((c) => c.id === defaultCategoryId)
        : categories[0]
      setTitle(defaultTitle ?? '')
      setKind('event')
      setGroup(dc?.group_key ?? 'work')
      setCategoryId(dc?.id ?? null)
      setAllDay(false)
      setStartLocal(base)
      setEndLocal(isoToJstLocal(endDate.toISOString()))
      setNotes('')
      setItems([])
    }
    setErr(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, entry])

  async function onSave() {
    if (!title.trim()) {
      setErr('タイトルを入力してください')
      return
    }
    let startsIso: string
    let endsIso: string
    if (allDay) {
      // 終日・時間未定: 日付だけ。開始日0:00〜終了日の翌0:00（その日を丸ごとカバー）
      const sDay = startLocal.slice(0, 10)
      const eDay = endLocal.slice(0, 10) || sDay
      if (eDay < sDay) {
        setErr('終了日は開始日以降にしてください')
        return
      }
      startsIso = jstLocalToIso(`${sDay}T00:00`)
      endsIso = new Date(
        new Date(jstLocalToIso(`${eDay}T00:00`)).getTime() + 86400000
      ).toISOString()
    } else {
      startsIso = jstLocalToIso(startLocal)
      endsIso = jstLocalToIso(endLocal)
      if (new Date(endsIso) <= new Date(startsIso)) {
        setErr('終了は開始より後にしてください')
        return
      }
    }
    const payload: EntryInput = {
      id: entry?.id,
      title: title.trim(),
      category_id: categoryId,
      kind,
      starts_at: startsIso,
      ends_at: endsIso,
      all_day: allDay,
      progress: kind === 'task' ? checklistProgress(items) : 0,
      notes:
        kind === 'task'
          ? serializeChecklist(items) || null
          : notes.trim() || null,
      source: entry ? entry.source : inboxId ? 'inbox' : 'manual',
      inbox_id: entry ? entry.inbox_id : inboxId ?? null,
    }
    try {
      await save.mutateAsync(payload)
      onSaved?.()
      onClose()
    } catch (e) {
      setErr('保存に失敗: ' + errMessage(e))
    }
  }

  async function onDelete() {
    if (!entry) return
    if (!confirm('この予定を削除しますか？')) return
    try {
      await del.mutateAsync(entry.id)
      onClose()
    } catch (e) {
      setErr('削除に失敗: ' + errMessage(e))
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
              {k === 'event' ? '予定' : 'TODO'}
            </button>
          ))}
        </div>

        {/* 大分類 */}
        <div className={label}>
          大分類
          <div className="mt-1 flex gap-2">
            {(['work', 'family', 'personal'] as GroupKey[]).map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => selectGroup(g)}
                className={
                  'min-h-tap flex-1 rounded-lg border text-sm ' +
                  (group === g
                    ? 'border-group-work bg-group-work/10 font-medium text-group-work'
                    : 'border-gray-300 text-gray-500')
                }
              >
                {GROUP_LABELS[g]}
              </button>
            ))}
          </div>
        </div>

        {/* 中分類（選んだ大分類の中のカテゴリ） */}
        <label className={label}>
          中分類（カテゴリ）
          <div className="mt-1 flex gap-2">
            <select
              value={categoryId ?? ''}
              onChange={(e) => setCategoryId(e.target.value || null)}
              className="min-h-tap flex-1 rounded-lg border border-gray-300 px-3 text-base"
            >
              {categories.filter((c) => c.group_key === group).length === 0 && (
                <option value="">（まだありません）</option>
              )}
              {categories
                .filter((c) => c.group_key === group)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </select>
            <button
              type="button"
              onClick={onAddCategory}
              className="min-h-tap shrink-0 rounded-lg border border-group-work px-3 text-sm font-medium text-group-work"
            >
              ＋追加
            </button>
          </div>
        </label>

        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={allDay}
            onChange={(e) => setAllDay(e.target.checked)}
            className="h-5 w-5"
          />
          終日・時間未定（日付だけ）
        </label>

        {allDay ? (
          <>
            <label className={label}>
              日付
              <input
                type="date"
                value={startLocal.slice(0, 10)}
                onChange={(e) => {
                  const d = e.target.value
                  setStartLocal(`${d}T00:00`)
                  if (endLocal.slice(0, 10) < d) setEndLocal(`${d}T00:00`)
                }}
                className={field}
              />
            </label>
            <label className={label}>
              終了日（複数日にまたぐ場合のみ・省略可）
              <input
                type="date"
                value={endLocal.slice(0, 10)}
                onChange={(e) => setEndLocal(`${e.target.value}T00:00`)}
                className={field}
              />
            </label>
          </>
        ) : (
          <>
            <label className={label}>
              開始
              <input
                type="datetime-local"
                value={startLocal}
                onChange={(e) => setStartLocal(e.target.value)}
                className={field}
              />
            </label>
            <label className={label}>
              終了
              <input
                type="datetime-local"
                value={endLocal}
                onChange={(e) => setEndLocal(e.target.value)}
                className={field}
              />
            </label>
          </>
        )}

        {kind === 'task' ? (
          /* TODO: チェックリスト（1枠に複数項目） */
          <div className={label}>
            やること（チェックリスト）
            <div className="mt-1 flex flex-col gap-1.5">
              {items.map((it, i) => (
                <div key={i} className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setItems((prev) =>
                        prev.map((x, j) =>
                          j === i ? { ...x, done: !x.done } : x
                        )
                      )
                    }
                    className="shrink-0 text-lg leading-none text-group-work"
                    aria-label={it.done ? '未完了に戻す' : '完了にする'}
                  >
                    {it.done ? '☑' : '☐'}
                  </button>
                  <input
                    value={it.text}
                    onChange={(e) =>
                      setItems((prev) =>
                        prev.map((x, j) =>
                          j === i ? { ...x, text: e.target.value } : x
                        )
                      )
                    }
                    placeholder="項目を入力"
                    className={
                      'min-h-tap flex-1 rounded-lg border border-gray-300 px-2 text-base ' +
                      (it.done ? 'text-gray-400 line-through' : '')
                    }
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setItems((prev) => prev.filter((_, j) => j !== i))
                    }
                    className="shrink-0 px-1 text-gray-400"
                    aria-label="削除"
                  >
                    ×
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() =>
                  setItems((prev) => [...prev, { text: '', done: false }])
                }
                className="min-h-tap self-start rounded-lg border border-dashed border-gray-300 px-3 text-sm text-gray-500"
              >
                ＋ 項目を追加
              </button>
            </div>
          </div>
        ) : (
          <label className={label}>
            メモ
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className={field + ' min-h-[72px] py-2'}
            />
          </label>
        )}

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
