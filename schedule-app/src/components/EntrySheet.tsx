import { useEffect, useState } from 'react'
import BottomSheet from './BottomSheet'
import BulkAddPanel from './BulkAddPanel'
import Icon from './Icon'
import { useCategories, useAddCategoryReturning } from '@/hooks/useCategories'
import { GROUP_LABELS } from '@/hooks/useGroupFilter'
import type { GroupKey } from '@/types/database'
import { addDays, addWeeks, addMonths } from 'date-fns'
import {
  useDeleteEntry,
  useSaveEntry,
  useAddEntries,
  type EntryInput,
} from '@/hooks/useEntries'
import {
  useStartTimer,
  useStopTimer,
  useRunningTimers,
} from '@/hooks/useTimeTracking'
import {
  isoToJstLocal,
  jstLocalToIso,
  monthGrid,
  fmtMonthLabel,
} from '@/lib/dates'
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
  const addEntries = useAddEntries()
  const del = useDeleteEntry()
  const startTimer = useStartTimer()
  const stopTimer = useStopTimer()
  const { data: runningTimers = [] } = useRunningTimers()
  // この予定を計測中のログ（あれば）
  const runningForEntry = entry
    ? runningTimers.find((t) => t.entry_id === entry.id)
    : undefined

  // 新規追加の入力方法: 1件ずつ / CSV・表で一括
  const [addMode, setAddMode] = useState<'single' | 'bulk'>('single')
  // TODO の分類ピッカーを開いているか（ふだんは隠してシンプルに）
  const [showCat, setShowCat] = useState(false)
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
  // 繰り返し（新規のみ）: なし/毎日/毎週/毎月 × 回数、または カレンダーで複数日選択
  const [repeat, setRepeat] = useState<
    'none' | 'daily' | 'weekly' | 'monthly' | 'dates'
  >('none')
  const [repeatCount, setRepeatCount] = useState(4)
  // repeat==='dates' 用: カレンダーで選んだ複数日
  const [pickedDates, setPickedDates] = useState<Set<string>>(new Set())
  const [calAnchor, setCalAnchor] = useState(() => new Date())

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
    setAddMode('single')
    setShowCat(!!(entry && entry.kind === 'task' && entry.category_id))
    setRepeat('none')
    setRepeatCount(4)
    setPickedDates(new Set())
    setCalAnchor(new Date())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, entry])

  async function onSave() {
    // TODO はタイトル任意（空なら先頭項目 or 'TODO'）。予定は必須
    let finalTitle = title.trim()
    if (kind === 'task') {
      if (!finalTitle) {
        finalTitle = items.find((i) => i.text.trim())?.text.trim() || 'TODO'
      }
    } else if (!finalTitle) {
      setErr('タイトルを入力してください')
      return
    }
    // TODO は日付だけ（時刻なし）で扱う。予定は「終日」チェックで日付だけにできる。
    const dateOnly = kind === 'task' || allDay
    let startsIso: string
    let endsIso: string
    if (dateOnly) {
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
      title: finalTitle,
      category_id: categoryId,
      kind,
      starts_at: startsIso,
      ends_at: endsIso,
      all_day: dateOnly,
      progress: kind === 'task' ? checklistProgress(items) : 0,
      notes:
        kind === 'task'
          ? serializeChecklist(items) || null
          : notes.trim() || null,
      source: entry ? entry.source : inboxId ? 'inbox' : 'manual',
      inbox_id: entry ? entry.inbox_id : inboxId ?? null,
    }
    try {
      // 新規＋カレンダーで複数日選択 → 選んだ各日に同じ内容で作成（時刻は上の設定を使用）
      if (!entry && repeat === 'dates') {
        const days = [...pickedDates].sort()
        if (days.length === 0) {
          setErr('カレンダーで日付を選んでください')
          return
        }
        const { id: _omit, ...base } = payload
        const rows = days.map((d) => {
          if (dateOnly) {
            const s = jstLocalToIso(`${d}T00:00`)
            const e = new Date(new Date(s).getTime() + 86400000).toISOString()
            return { ...base, starts_at: s, ends_at: e, all_day: true }
          }
          const hhmmS = startLocal.slice(11, 16) || '09:00'
          const hhmmE = endLocal.slice(11, 16) || '10:00'
          const s = jstLocalToIso(`${d}T${hhmmS}`)
          let e = jstLocalToIso(`${d}T${hhmmE}`)
          if (new Date(e).getTime() <= new Date(s).getTime()) {
            e = new Date(new Date(s).getTime() + 3600000).toISOString()
          }
          return { ...base, starts_at: s, ends_at: e, all_day: false }
        })
        await addEntries.mutateAsync(rows)
        onSaved?.()
        onClose()
        return
      }
      // 新規＋繰り返しあり → 期間をずらして複数件をまとめて追加
      if (!entry && repeat !== 'none' && repeatCount > 1) {
        const n = Math.min(60, Math.max(1, repeatCount))
        const shift = (iso: string, i: number) => {
          const d = new Date(iso)
          const shifted =
            repeat === 'daily'
              ? addDays(d, i)
              : repeat === 'weekly'
                ? addWeeks(d, i)
                : addMonths(d, i)
          return shifted.toISOString()
        }
        const { id: _omit, ...base } = payload
        const rows = Array.from({ length: n }, (_, i) => ({
          ...base,
          starts_at: shift(startsIso, i),
          ends_at: shift(endsIso, i),
        }))
        await addEntries.mutateAsync(rows)
      } else {
        await save.mutateAsync(payload)
      }
      onSaved?.()
      onClose()
    } catch (e) {
      setErr('保存に失敗: ' + errMessage(e))
    }
  }

  // 既存の予定を複製（同じ内容でもう1件追加）
  async function onDuplicate() {
    if (!entry) return
    setErr(null)
    try {
      await addEntries.mutateAsync([
        {
          title: entry.title,
          category_id: entry.category_id,
          kind: entry.kind,
          starts_at: entry.starts_at,
          ends_at: entry.ends_at,
          all_day: entry.all_day,
          progress: entry.progress ?? 0,
          notes: entry.notes,
          source: 'manual',
          inbox_id: null,
        },
      ])
      onSaved?.()
      onClose()
    } catch (e) {
      setErr('複製に失敗: ' + errMessage(e))
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

  // TODO の「やること（チェックリスト）」。TODOでは入力を上に置くため関数化。
  const checklistNode = (
    <div className={label}>
      やること（チェックリスト）
      <div className="mt-1 flex flex-col gap-1.5">
        {items.map((it, i) => (
          <div key={i} className="flex items-center gap-2">
            <button
              type="button"
              onClick={() =>
                setItems((prev) =>
                  prev.map((x, j) => (j === i ? { ...x, done: !x.done } : x))
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
              onClick={() => setItems((prev) => prev.filter((_, j) => j !== i))}
              className="shrink-0 px-1 text-gray-400"
              aria-label="削除"
            >
              ×
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => setItems((prev) => [...prev, { text: '', done: false }])}
          className="min-h-tap self-start rounded-lg border border-dashed border-gray-300 px-3 text-sm text-gray-500"
        >
          ＋ 項目を追加
        </button>
      </div>
    </div>
  )

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={`${kind === 'task' ? 'TODO' : '予定'}を${entry ? '編集' : '追加'}`}
    >
      <div className="flex flex-col gap-3">
        {/* 入力方法の切り替え（新規のみ）: 1件ずつ / CSV・表で一括 */}
        {!entry && (
          <div className="flex overflow-hidden rounded-xl border border-group-work/30 bg-group-work/5">
            {(
              [
                ['single', '1件ずつ'],
                ['bulk', 'CSVで一括'],
              ] as const
            ).map(([m, label]) => (
              <button
                key={m}
                onClick={() => setAddMode(m)}
                className={
                  'flex min-h-tap flex-1 items-center justify-center gap-1 text-sm font-medium ' +
                  (addMode === m
                    ? 'bg-group-work text-white'
                    : 'text-group-work')
                }
              >
                <Icon name={m === 'single' ? 'add' : 'csv'} size={16} />
                {label}
              </button>
            ))}
          </div>
        )}

        {!entry && addMode === 'bulk' ? (
          <BulkAddPanel
            onDone={() => {
              onSaved?.()
            }}
          />
        ) : (
          <>
        {/* 予定 / TODO 切り替え（一番上） */}
        <div className="flex overflow-hidden rounded-xl border border-gray-200">
          {(['event', 'task'] as EntryKind[]).map((k) => (
            <button
              key={k}
              onClick={() => setKind(k)}
              className={
                'flex min-h-tap flex-1 items-center justify-center gap-1 text-sm font-medium ' +
                (kind === k
                  ? 'bg-group-work text-white'
                  : 'bg-white text-gray-500')
              }
            >
              {k === 'event' ? (
                <>
                  <Icon name="schedule" size={16} />
                  予定
                </>
              ) : (
                '✓ TODO'
              )}
            </button>
          ))}
        </div>

        <label className={label}>
          {kind === 'task' ? 'タイトル（任意）' : 'タイトル'}
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className={field}
            placeholder={kind === 'task' ? '例: 買い物リスト（空でもOK）' : '例: 歯医者'}
          />
        </label>

        {/* TODO は「やること」を最優先で上に。ノイズになる大分類/中分類は出さない */}
        {kind === 'task' && checklistNode}

        {/* 大分類・中分類は予定のときだけ（TODOはシンプルに） */}
        {kind !== 'task' && (
          <>
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
          </>
        )}

        {kind === 'task' ? (
          /* TODO は日付だけ（開始/終了の時刻は不要でまぎらわしいので出さない） */
          <label className={label}>
            日付
            <input
              type="date"
              value={startLocal.slice(0, 10)}
              onChange={(e) => {
                const d = e.target.value
                setStartLocal(`${d}T00:00`)
                setEndLocal(`${d}T00:00`)
              }}
              className={field}
            />
          </label>
        ) : (
          <>
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
          </>
        )}

        {/* TODO の分類（任意）。小さめボタンで折りたたみ、押すと大分類/中分類 */}
        {kind === 'task' &&
          (showCat ? (
            <div className={label}>
              分類（任意）
              <div className="mt-1 flex gap-1.5">
                {(['work', 'family', 'personal'] as GroupKey[]).map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => selectGroup(g)}
                    className={
                      'min-h-tap flex-1 rounded-lg border py-1 text-xs ' +
                      (group === g
                        ? 'border-group-work bg-group-work/10 font-medium text-group-work'
                        : 'border-gray-300 text-gray-500')
                    }
                  >
                    {GROUP_LABELS[g]}
                  </button>
                ))}
              </div>
              <div className="mt-1.5 flex gap-2">
                <select
                  value={categoryId ?? ''}
                  onChange={(e) => setCategoryId(e.target.value || null)}
                  className="min-h-tap flex-1 rounded-lg border border-gray-300 px-3 text-sm"
                >
                  <option value="">（分類なし）</option>
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
                  className="min-h-tap shrink-0 rounded-lg border border-group-work px-3 text-xs font-medium text-group-work"
                >
                  ＋
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowCat(true)}
              className="self-start rounded-full border border-gray-300 px-3 py-1 text-xs text-gray-500"
            >
              🏷 分類をつける（任意）
            </button>
          ))}

        {/* メモは予定のときだけ（TODOは上のチェックリストで入力） */}
        {kind !== 'task' && (
          <label className={label}>
            メモ
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className={field + ' min-h-[72px] py-2'}
            />
          </label>
        )}

        {/* 繰り返し登録（新規の予定のみ。TODOはシンプルにするため非表示） */}
        {!entry && kind !== 'task' && (
          <div className={label}>
            繰り返し
            <div className="mt-1 flex gap-2">
              <select
                value={repeat}
                onChange={(e) =>
                  setRepeat(e.target.value as typeof repeat)
                }
                className="min-h-tap flex-1 rounded-lg border border-gray-300 px-3 text-base"
              >
                <option value="none">なし（1件だけ）</option>
                <option value="daily">毎日</option>
                <option value="weekly">毎週</option>
                <option value="monthly">毎月</option>
                <option value="dates">🗓️ カレンダーで選ぶ</option>
              </select>
              {repeat !== 'none' && repeat !== 'dates' && (
                <label className="flex items-center gap-1 text-sm text-gray-600">
                  <input
                    type="number"
                    min={1}
                    max={60}
                    value={repeatCount}
                    onChange={(e) =>
                      setRepeatCount(Number(e.target.value) || 1)
                    }
                    className="min-h-tap w-16 rounded-lg border border-gray-300 px-2 text-base"
                  />
                  回
                </label>
              )}
            </div>
            {repeat !== 'none' && repeat !== 'dates' && (
              <p className="mt-1 text-[11px] text-gray-400">
                この予定を含めて{' '}
                {repeat === 'daily' ? '毎日' : repeat === 'weekly' ? '毎週' : '毎月'}
                、合計 {Math.min(60, Math.max(1, repeatCount))} 件つくります。
              </p>
            )}

            {/* カレンダーで複数日を選ぶ */}
            {repeat === 'dates' && (
              <div className="mt-2">
                <p className="mb-1 text-[11px] text-gray-400">
                  上の時刻で、選んだ各日に登録します。バラバラの日でOK。
                </p>
                <div className="rounded-xl border border-gray-200 p-2">
                  <div className="mb-1 flex items-center justify-between">
                    <button
                      type="button"
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
                      type="button"
                      onClick={() => setCalAnchor((d) => addMonths(d, 1))}
                      className="min-h-tap min-w-tap text-gray-500"
                      aria-label="翌月"
                    >
                      ›
                    </button>
                  </div>
                  <div className="grid grid-cols-7 text-center text-[11px] text-gray-400">
                    {['日', '月', '火', '水', '木', '金', '土'].map((w, i) => (
                      <div
                        key={w}
                        className={
                          i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : ''
                        }
                      >
                        {w}
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-7">
                    {monthGrid(calAnchor).map(({ key, inMonth }) => {
                      const sel = pickedDates.has(key)
                      return (
                        <button
                          type="button"
                          key={key}
                          onClick={() =>
                            setPickedDates((prev) => {
                              const n = new Set(prev)
                              if (n.has(key)) n.delete(key)
                              else n.add(key)
                              return n
                            })
                          }
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
                <p className="mt-1 text-sm font-medium text-gray-600">
                  選択中: {pickedDates.size} 日
                  {pickedDates.size > 0 && (
                    <button
                      type="button"
                      onClick={() => setPickedDates(new Set())}
                      className="ml-2 text-xs text-gray-400 underline"
                    >
                      クリア
                    </button>
                  )}
                </p>
              </div>
            )}
          </div>
        )}

        {/* 予定の作業時間を計測（既存の予定のみ） */}
        {entry && entry.kind === 'event' && (
          runningForEntry ? (
            <button
              type="button"
              onClick={() => stopTimer.mutate(runningForEntry.id)}
              className="min-h-tap rounded-lg border border-red-300 bg-red-50 text-sm font-medium text-red-600"
            >
              ■ 計測を停止
            </button>
          ) : (
            <button
              type="button"
              onClick={() =>
                startTimer.mutate({
                  label: entry.title,
                  entry_id: entry.id,
                  category_id: entry.category_id,
                })
              }
              className="min-h-tap rounded-lg border border-group-work/40 bg-group-work/5 text-sm font-medium text-group-work"
            >
              ▶ この予定を計測
            </button>
          )
        )}

        {err && <p className="text-sm text-red-600">{err}</p>}

        {entry && (
          <button
            onClick={onDuplicate}
            disabled={addEntries.isPending}
            className="min-h-tap rounded-lg border border-group-work/40 bg-group-work/5 text-sm font-medium text-group-work disabled:opacity-50"
          >
            ⧉ この{entry.kind === 'task' ? 'TODO' : '予定'}を複製
          </button>
        )}

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
            disabled={save.isPending || addEntries.isPending}
            className="min-h-tap flex-1 rounded-lg bg-group-work font-medium text-white disabled:opacity-50"
          >
            {save.isPending || addEntries.isPending
              ? '保存中…'
              : !entry && repeat === 'dates'
                ? `選んだ ${pickedDates.size} 日に登録`
                : !entry && repeat !== 'none'
                  ? `${Math.min(60, Math.max(1, repeatCount))}件を登録`
                  : '保存'}
          </button>
        </div>
          </>
        )}
      </div>
    </BottomSheet>
  )
}
