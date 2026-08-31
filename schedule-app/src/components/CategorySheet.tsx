import { useState } from 'react'
import BottomSheet from './BottomSheet'
import {
  useCategories,
  useDeleteCategory,
  useUpsertCategory,
} from '@/hooks/useCategories'
import { GROUP_LABELS } from '@/hooks/useGroupFilter'
import { GROUP_COLORS } from '@/lib/palette'
import { errMessage } from '@/lib/errors'
import type { Category, GroupKey } from '@/types/database'

const GROUPS: GroupKey[] = ['work', 'family', 'personal']

export default function CategorySheet({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const { data: categories = [] } = useCategories()
  const upsert = useUpsertCategory()
  const del = useDeleteCategory()
  // 削除時: 対象カテゴリと、その予定の移動先（'' = 未分類）
  const [pendingDelete, setPendingDelete] = useState<Category | null>(null)
  const [reassign, setReassign] = useState<string>('')

  async function addTo(group: GroupKey) {
    const name = window.prompt(`「${GROUP_LABELS[group]}」に追加する名前（例: A社）`)
    if (!name || !name.trim()) return
    await upsert.mutateAsync({
      name: name.trim(),
      group_key: group,
      color: GROUP_COLORS[group],
      sort_order: categories.length,
    })
  }

  async function rename(c: Category) {
    const name = window.prompt('名前を変更', c.name)
    if (!name || !name.trim() || name.trim() === c.name) return
    await upsert.mutateAsync({
      id: c.id,
      name: name.trim(),
      group_key: c.group_key,
      color: GROUP_COLORS[c.group_key],
      sort_order: c.sort_order,
    })
  }

  async function move(c: Category, group: GroupKey) {
    if (group === c.group_key) return
    await upsert.mutateAsync({
      id: c.id,
      name: c.name,
      group_key: group,
      color: GROUP_COLORS[group],
      sort_order: c.sort_order,
    })
  }

  return (
    <BottomSheet open={open} onClose={onClose} title="カテゴリ管理">
      <div className="flex flex-col gap-5">
        <p className="text-xs text-gray-500">
          大分類（Work / Family / Personal）ごとに中分類を整理できます。色は大分類で自動。
        </p>

        {GROUPS.map((g) => {
          const items = categories.filter((c) => c.group_key === g)
          return (
            <section key={g} className="flex flex-col gap-1.5">
              {/* 大分類の見出し */}
              <div className="flex items-center gap-2">
                <span
                  className="h-3.5 w-3.5 rounded-full"
                  style={{ backgroundColor: GROUP_COLORS[g] }}
                />
                <h3
                  className="text-sm font-bold"
                  style={{ color: GROUP_COLORS[g] }}
                >
                  {GROUP_LABELS[g]}
                </h3>
                <span className="text-xs text-gray-400">
                  {items.length}件
                </span>
              </div>

              {/* 中分類 */}
              {items.length === 0 && (
                <p className="pl-6 text-xs text-gray-400">
                  まだありません
                </p>
              )}
              {items.map((c) => (
                <div key={c.id}>
                  <div className="ml-6 flex items-center gap-2 rounded-lg border border-gray-100 px-2 py-1.5">
                    <button
                      onClick={() => rename(c)}
                      className="flex-1 text-left text-sm text-gray-800"
                      title="タップで名前を変更"
                    >
                      {c.name}
                    </button>
                    {/* 移動先（別の大分類） */}
                    <select
                      value={c.group_key}
                      onChange={(e) => move(c, e.target.value as GroupKey)}
                      className="rounded-md border border-gray-200 bg-white px-1 py-0.5 text-xs text-gray-500"
                      title="別の大分類へ移動"
                    >
                      {GROUPS.map((gg) => (
                        <option key={gg} value={gg}>
                          {GROUP_LABELS[gg]}へ
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => {
                        setReassign('')
                        setPendingDelete(c)
                      }}
                      className="px-1 text-sm text-red-500"
                      aria-label="削除"
                    >
                      削除
                    </button>
                  </div>

                  {/* 削除の確認: 予定の移動先を選ぶ */}
                  {pendingDelete?.id === c.id && (
                    <div className="ml-6 mt-1 rounded-lg border border-red-200 bg-red-50 p-2">
                      <p className="mb-1 text-xs text-gray-700">
                        「{c.name}」を削除します。この分類の予定の移動先：
                      </p>
                      <select
                        value={reassign}
                        onChange={(e) => setReassign(e.target.value)}
                        className="min-h-tap w-full rounded-lg border border-gray-300 bg-white px-2 text-base"
                      >
                        <option value="">未分類にする</option>
                        {GROUPS.map((gg) => {
                          const opts = categories.filter(
                            (x) => x.group_key === gg && x.id !== c.id
                          )
                          if (opts.length === 0) return null
                          return (
                            <optgroup key={gg} label={GROUP_LABELS[gg]}>
                              {opts.map((o) => (
                                <option key={o.id} value={o.id}>
                                  {o.name}
                                </option>
                              ))}
                            </optgroup>
                          )
                        })}
                      </select>
                      <div className="mt-2 flex gap-2">
                        <button
                          onClick={() => setPendingDelete(null)}
                          className="min-h-tap flex-1 rounded-lg border border-gray-300 text-sm text-gray-600"
                        >
                          キャンセル
                        </button>
                        <button
                          onClick={async () => {
                            try {
                              await del.mutateAsync({
                                id: c.id,
                                reassignTo: reassign || null,
                              })
                              setPendingDelete(null)
                            } catch (e) {
                              alert('削除に失敗: ' + errMessage(e))
                            }
                          }}
                          disabled={del.isPending}
                          className="min-h-tap flex-1 rounded-lg bg-red-500 text-sm font-medium text-white disabled:opacity-50"
                        >
                          削除する
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {/* 追加 */}
              <button
                onClick={() => addTo(g)}
                className="ml-6 mt-0.5 self-start rounded-lg border border-dashed border-gray-300 px-3 py-1 text-xs text-gray-500"
              >
                ＋ {GROUP_LABELS[g]}に追加
              </button>
            </section>
          )
        })}
      </div>
    </BottomSheet>
  )
}
