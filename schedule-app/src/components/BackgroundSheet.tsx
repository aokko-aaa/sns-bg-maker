import { useRef, useState } from 'react'
import BottomSheet from './BottomSheet'
import { loadBg, processImage, saveBg, type BgSettings } from '@/lib/background'

export default function BackgroundSheet({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const [s, setS] = useState<BgSettings>(() => loadBg())
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  function update(next: Partial<BgSettings>) {
    const merged = { ...s, ...next }
    setS(merged)
    saveBg(merged)
  }

  async function onPick(file: File) {
    setErr(null)
    setBusy(true)
    try {
      const { dataUrl, veil } = await processImage(file)
      update({ mode: 'custom', img: dataUrl, veil })
    } catch {
      setErr('画像を読み込めませんでした')
    } finally {
      setBusy(false)
    }
  }

  return (
    <BottomSheet open={open} onClose={onClose} title="背景の設定">
      <div className="flex flex-col gap-4">
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) onPick(f)
            e.target.value = ''
          }}
        />

        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => fileRef.current?.click()}
            disabled={busy}
            className="min-h-tap rounded-lg bg-group-work text-sm font-medium text-white disabled:opacity-50"
          >
            {busy ? '処理中…' : '画像を選ぶ'}
          </button>
          <button
            onClick={() => update({ mode: 'default' })}
            className={
              'min-h-tap rounded-lg border text-sm ' +
              (s.mode === 'default'
                ? 'border-group-work text-group-work'
                : 'border-gray-300 text-gray-500')
            }
          >
            元の背景
          </button>
          <button
            onClick={() => update({ mode: 'none' })}
            className={
              'min-h-tap rounded-lg border text-sm ' +
              (s.mode === 'none'
                ? 'border-group-work text-group-work'
                : 'border-gray-300 text-gray-500')
            }
          >
            背景なし
          </button>
        </div>

        {err && <p className="text-sm text-red-600">{err}</p>}

        {/* プレビュー */}
        {s.mode === 'custom' && s.img && (
          <>
            <div
              className="h-40 w-full rounded-lg border border-gray-100 bg-[#f2f6fb] bg-no-repeat"
              style={{
                backgroundImage: `url("${s.img}")`,
                backgroundSize: s.fit ?? 'cover',
                backgroundPosition: `center ${s.posY ?? 0}%`,
              }}
            />

            {/* 表示方法 */}
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  ['cover', '画面いっぱい'],
                  ['contain', '全体を表示'],
                ] as const
              ).map(([f, label]) => (
                <button
                  key={f}
                  onClick={() => update({ fit: f })}
                  className={
                    'min-h-tap rounded-lg border text-sm ' +
                    ((s.fit ?? 'cover') === f
                      ? 'border-group-work bg-group-work/10 font-medium text-group-work'
                      : 'border-gray-300 text-gray-500')
                  }
                >
                  {label}
                </button>
              ))}
            </div>

            {/* 縦位置 */}
            <label className="text-sm text-gray-600">
              縦位置（見せたい部分に合わせる）
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={s.posY ?? 0}
                onChange={(e) => update({ posY: Number(e.target.value) })}
                className="mt-1 w-full"
              />
              <div className="flex justify-between text-[11px] text-gray-400">
                <span>上</span>
                <span>中央</span>
                <span>下</span>
              </div>
            </label>
          </>
        )}

        {/* 読みやすさ（白のせ） */}
        <label
          className={
            'text-sm text-gray-600 ' + (s.mode === 'none' ? 'opacity-40' : '')
          }
        >
          読みやすさ（白のせ）: {Math.round(s.veil * 100)}%
          <input
            type="range"
            min={0}
            max={0.6}
            step={0.01}
            value={s.veil}
            disabled={s.mode === 'none'}
            onChange={(e) => update({ veil: Number(e.target.value) })}
            className="mt-1 w-full"
          />
          <span className="text-xs text-gray-400">
            画像を選ぶと、明るさに合わせて自動で設定します。見づらいときは右へ。
          </span>
        </label>

        <p className="text-[11px] text-gray-400">
          ※ 背景はこの端末に保存されます（他の端末とは別設定）。
        </p>
      </div>
    </BottomSheet>
  )
}
