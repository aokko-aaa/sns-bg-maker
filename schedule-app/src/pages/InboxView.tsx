import { useEffect, useState } from 'react'
import {
  useAddInbox,
  useInboxItems,
  useParseInbox,
  useUpdateInboxStatus,
} from '@/hooks/useInbox'
import { useCategories } from '@/hooks/useCategories'
import { useSaveEntry, type EntryInput } from '@/hooks/useEntries'
import { isoToJstLocal, jstLocalToIso } from '@/lib/dates'
import EntrySheet from '@/components/EntrySheet'
import type { InboxItem, ParsedInboxItem } from '@/types/database'

const STATUS_LABEL: Record<string, string> = {
  pending: '未処理',
  converted: '予定化済',
  memo: 'メモ',
  held: '保留',
  dismissed: '破棄',
}

export default function InboxView() {
  const [text, setText] = useState('')
  const { data: items = [], isLoading } = useInboxItems()
  const add = useAddInbox()

  async function submit() {
    if (!text.trim()) return
    await add.mutateAsync({ raw_text: text.trim() })
    setText('')
  }

  return (
    <div className="flex flex-1 flex-col">
      {/* 入力欄（常時上部） */}
      <div className="border-b border-gray-100 p-3">
        <div className="flex items-end gap-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="つぶやきを投げる（例: 来週火曜10時に歯医者）"
            className="min-h-tap flex-1 resize-none rounded-lg border border-gray-300 px-3 py-2 text-base"
            rows={2}
          />
          <button
            className="min-h-tap min-w-tap rounded-lg border border-gray-200 text-gray-300"
            title="音声入力は Phase 4 で対応"
            disabled
            aria-label="音声入力（準備中）"
          >
            🎤
          </button>
        </div>
        <button
          onClick={submit}
          disabled={add.isPending || !text.trim()}
          className="min-h-tap mt-2 w-full rounded-lg bg-group-work font-medium text-white disabled:opacity-40"
        >
          投げ込む
        </button>
      </div>

      {/* カード一覧 */}
      <div className="flex-1 space-y-3 overflow-y-auto p-3">
        {isLoading && (
          <p className="text-center text-sm text-gray-400">読み込み中…</p>
        )}
        {!isLoading && items.length === 0 && (
          <p className="pt-8 text-center text-sm text-gray-400">
            まだつぶやきはありません。
            <br />
            上の欄に思いついた予定を投げ込んでみてください。
          </p>
        )}
        {items.map((item) => (
          <InboxCard key={item.id} item={item} />
        ))}
      </div>
    </div>
  )
}

function InboxCard({ item }: { item: InboxItem }) {
  const parse = useParseInbox()
  const setStatus = useUpdateInboxStatus()
  const save = useSaveEntry()
  const { data: categories = [] } = useCategories()

  const [proposals, setProposals] = useState<ParsedInboxItem[]>([])
  const [err, setErr] = useState<string | null>(null)
  const [manualOpen, setManualOpen] = useState(false)

  useEffect(() => {
    setProposals(item.parsed?.items ?? [])
  }, [item.parsed])

  const patch = (i: number, p: Partial<ParsedInboxItem>) =>
    setProposals((prev) => prev.map((x, j) => (j === i ? { ...x, ...p } : x)))

  async function onParse() {
    setErr(null)
    try {
      await parse.mutateAsync(item.id)
    } catch (e) {
      setErr(e instanceof Error ? e.message : '解釈に失敗しました')
    }
  }

  async function onConvert() {
    setErr(null)
    try {
      for (const p of proposals) {
        const payload: EntryInput = {
          title: p.title,
          category_id: p.category_id,
          kind: p.kind,
          starts_at: p.starts_at,
          ends_at: p.ends_at,
          all_day: p.all_day,
          progress: 0,
          notes: null,
          source: 'inbox',
          inbox_id: item.id,
        }
        await save.mutateAsync(payload)
      }
      await setStatus.mutateAsync({ id: item.id, status: 'converted' })
    } catch (e) {
      setErr(e instanceof Error ? e.message : '登録に失敗しました')
    }
  }

  const parsed = item.parsed
  const done = item.status !== 'pending'
  const field =
    'mt-1 min-h-tap w-full rounded-lg border border-gray-300 px-2 text-sm'

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
      <div className="mb-2 flex items-start justify-between gap-2">
        <p className="flex-1 whitespace-pre-wrap text-sm text-gray-800">
          {item.raw_text}
        </p>
        <span
          className={
            'shrink-0 rounded-full px-2 py-0.5 text-[10px] ' +
            (item.status === 'pending'
              ? 'bg-amber-100 text-amber-700'
              : 'bg-gray-100 text-gray-500')
          }
        >
          {STATUS_LABEL[item.status] ?? item.status}
        </span>
      </div>

      {/* 未解釈: 手動で予定化 / AIで整理 */}
      {!parsed && !done && (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setManualOpen(true)}
              className="min-h-tap rounded-lg bg-group-work font-medium text-white"
            >
              予定にする
            </button>
            <button
              onClick={onParse}
              disabled={parse.isPending}
              className="min-h-tap rounded-lg bg-group-work/10 font-medium text-group-work disabled:opacity-50"
              title="AI解釈には Anthropic API の設定が必要です"
            >
              {parse.isPending ? 'AI整理中…' : '✨ AIで整理'}
            </button>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setStatus.mutate({ id: item.id, status: 'memo' })}
              className="min-h-tap flex-1 rounded-lg border border-gray-300 text-xs text-gray-500"
            >
              メモ
            </button>
            <button
              onClick={() =>
                setStatus.mutate({ id: item.id, status: 'dismissed' })
              }
              className="min-h-tap flex-1 rounded-lg border border-red-200 text-xs text-red-500"
            >
              破棄
            </button>
          </div>
          {err && <p className="text-sm text-red-600">{err}</p>}
        </div>
      )}

      {/* 手動予定化シート */}
      <EntrySheet
        open={manualOpen}
        onClose={() => setManualOpen(false)}
        entry={null}
        defaultTitle={item.raw_text}
        inboxId={item.id}
        onSaved={() =>
          setStatus.mutate({ id: item.id, status: 'converted' })
        }
      />

      {/* 解釈済 */}
      {parsed && !done && (
        <div className="space-y-3">
          {parsed.classification === 'memo' && (
            <p className="rounded-lg bg-gray-50 p-2 text-sm text-gray-600">
              メモとして判定: {parsed.memo || item.raw_text}
            </p>
          )}
          {parsed.classification === 'unclear' && (
            <p className="rounded-lg bg-amber-50 p-2 text-sm text-amber-700">
              日時が特定できませんでした。{parsed.reason}
            </p>
          )}

          {proposals.map((p, i) => (
            <div key={i} className="rounded-lg border border-gray-100 p-2">
              <input
                value={p.title}
                onChange={(e) => patch(i, { title: e.target.value })}
                className={field}
              />
              <div className="mt-1 flex gap-2">
                <label className="flex items-center gap-1 text-xs text-gray-500">
                  <input
                    type="checkbox"
                    checked={p.all_day}
                    onChange={(e) => patch(i, { all_day: e.target.checked })}
                  />
                  終日
                </label>
                <select
                  value={p.category_id ?? ''}
                  onChange={(e) =>
                    patch(i, { category_id: e.target.value || null })
                  }
                  className="min-h-tap flex-1 rounded-lg border border-gray-300 px-2 text-sm"
                >
                  <option value="">（未分類）</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="mt-1 flex items-center gap-1 text-sm">
                <input
                  type="datetime-local"
                  value={isoToJstLocal(p.starts_at)}
                  onChange={(e) =>
                    patch(i, { starts_at: jstLocalToIso(e.target.value) })
                  }
                  className="min-h-tap flex-1 rounded-lg border border-gray-300 px-2 text-xs"
                />
                {!p.all_day && (
                  <>
                    <span className="text-gray-400">〜</span>
                    <input
                      type="datetime-local"
                      value={isoToJstLocal(p.ends_at)}
                      onChange={(e) =>
                        patch(i, { ends_at: jstLocalToIso(e.target.value) })
                      }
                      className="min-h-tap flex-1 rounded-lg border border-gray-300 px-2 text-xs"
                    />
                  </>
                )}
              </div>
              {p.source_phrase && (
                <p className="mt-1 text-[10px] text-gray-400">
                  根拠: 「{p.source_phrase}」
                </p>
              )}
            </div>
          ))}

          {err && <p className="text-sm text-red-600">{err}</p>}

          {/* 4アクション（要件 5-4） */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={onConvert}
              disabled={proposals.length === 0 || save.isPending}
              className="min-h-tap rounded-lg bg-group-work font-medium text-white disabled:opacity-40"
            >
              予定に追加
            </button>
            <button
              onClick={() => setStatus.mutate({ id: item.id, status: 'memo' })}
              className="min-h-tap rounded-lg border border-gray-300 text-gray-600"
            >
              メモとして保存
            </button>
            <button
              onClick={() => setStatus.mutate({ id: item.id, status: 'held' })}
              className="min-h-tap rounded-lg border border-gray-300 text-gray-600"
            >
              保留
            </button>
            <button
              onClick={() =>
                setStatus.mutate({ id: item.id, status: 'dismissed' })
              }
              className="min-h-tap rounded-lg border border-red-200 text-red-500"
            >
              破棄
            </button>
          </div>
        </div>
      )}

      {/* 処理済みは再表示ボタン */}
      {done && (
        <button
          onClick={() => setStatus.mutate({ id: item.id, status: 'pending' })}
          className="mt-1 text-xs text-gray-400 underline"
        >
          未処理に戻す
        </button>
      )}
    </div>
  )
}
