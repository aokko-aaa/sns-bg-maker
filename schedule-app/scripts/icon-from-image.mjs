// あなたが用意した画像を、ホーム画面アイコン(PWA)の各サイズPNGに変換する。
// 使い方:  node scripts/icon-from-image.mjs <画像ファイル> [背景色hex]
//   例:    node scripts/icon-from-image.mjs my-icon.png "#ffe9df"
// 依存: sharp（`npm i -D sharp` で導入）。ビルドには使わない手動ツール。
import sharp from 'sharp'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons')

const input = process.argv[2]
const bg = process.argv[3] || '#ffffff'
if (!input) {
  console.error('使い方: node scripts/icon-from-image.mjs <画像ファイル> [背景色hex]')
  process.exit(1)
}
const src = resolve(input)

const hexToRgb = (h) => ({
  r: parseInt(h.slice(1, 3), 16),
  g: parseInt(h.slice(3, 5), 16),
  b: parseInt(h.slice(5, 7), 16),
  alpha: 1,
})
const bgRgb = hexToRgb(bg.length === 7 ? bg : '#ffffff')

// 画像を size×size の正方形に「はみ出さないよう全体を収める(contain)」。
// pad=余白率（maskableはセーフゾーン確保のため大きめ）。fillBg=背景を塗るか（透過を残すか）。
async function make(name, size, { pad = 0, fillBg = true } = {}) {
  const inner = Math.round(size * (1 - pad * 2))
  const resized = await sharp(src)
    .resize(inner, inner, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer()
  const canvas = sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: fillBg ? bgRgb : { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
  const off = Math.round((size - inner) / 2)
  const out = await canvas
    .composite([{ input: resized, top: off, left: off }])
    .png()
    .toBuffer()
  const path = join(OUT, name)
  await sharp(out).toFile(path)
  console.log('wrote', name, out.length, 'bytes')
}

// 192/512: そのまま（角丸はOSが自動でつける）
await make('icon-192.png', 192, { pad: 0.06 })
await make('icon-512.png', 512, { pad: 0.06 })
// maskable: 端が切られても大丈夫なようセーフゾーンを広めに
await make('icon-512-maskable.png', 512, { pad: 0.18 })
// apple-touch(iOS): 透過非対応なので必ず背景を塗る
await make('apple-touch-icon.png', 180, { pad: 0.06, fillBg: true })

console.log('done →', OUT)
