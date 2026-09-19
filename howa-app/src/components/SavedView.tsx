import { useEffect, useState } from 'react'
import { copyText, toMarkdown } from '../lib/format'
import { savedStore, type SavedNeta } from '../lib/storage'
import NetaCard from './NetaCard'

export default function SavedView() {
  const [list, setList] = useState<SavedNeta[]>([])
  const [msg, setMsg] = useState<string | null>(null)

  useEffect(() => {
    setList(savedStore.list())
  }, [])

  const exportAll = async () => {
    const ok = await copyText(toMarkdown(list.map((x) => ({ neta: x.neta, memo: x.memo }))))
    setMsg(ok ? 'ネタ帳をまるごとコピーしました' : 'コピーできませんでした')
    setTimeout(() => setMsg(null), 2200)
  }

  if (list.length === 0) {
    return (
      <p className="text-sm leading-relaxed text-stone-500">
        まだ何も入っていません。「つくる」で出たネタを〈ネタ帳に入れる〉と、ここに溜まります。
        <br />
        保存先はこの端末のブラウザです（サーバーには送っていません）。
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <span className="text-sm text-stone-600">{list.length}件</span>
        <button type="button" className="btn-ghost ml-auto" onClick={exportAll}>
          まるごとコピー（Markdown）
        </button>
      </div>
      {msg && <p className="text-xs text-matcha">{msg}</p>}
      {list.map((item) => (
        <NetaCard
          key={item.neta.id}
          neta={item.neta}
          saved
          onSave={() => {}}
          onRemove={(id) => setList(savedStore.remove(id))}
        >
          <div className="mt-3">
            <label className="label" htmlFor={`memo-${item.neta.id}`}>
              自分のメモ（どこで使うか、誰に話すか）
            </label>
            <textarea
              id={`memo-${item.neta.id}`}
              value={item.memo}
              onChange={(e) => setList(savedStore.updateMemo(item.neta.id, e.target.value))}
              rows={2}
              className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
              placeholder="例：来月の月参り、Aさんのお宅で"
            />
            <p className="mt-1 text-xs text-stone-400">
              {new Date(item.savedAt).toLocaleString('ja-JP')} に保存
            </p>
          </div>
        </NetaCard>
      ))}
    </div>
  )
}
