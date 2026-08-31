// あなたが用意した画像を、ホーム画面アイコン(PWA)の各サイズPNGに変換する。
// 使い方:  node scripts/icon-from-image.mjs <画像ファイル> [背景色hex]
//   例:    node scripts/icon-from-image.mjs my-icon.png "#c9789f"
// 背景色を省略すると、画像の四隅の色を自動でサンプリングして使う。
// 依存: sharp（`npm i -D sharp` で導入）。ビルドには使わない手動ツール。
import sharp from 'sharp'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons')

const input = process.argv[2]
const bgArg = process.argv[3]
if (!input) {
  console.error('使い方: node scripts/icon-from-image.mjs <画像ファイル> [背景色hex]')
  process.exit(1)
}
const src = resolve(input)

async function cornerColor() {
  // 左上の1pxを取り出して背景色とする（フルブリード画像の余白色に合わせるため）
  const { data } = await sharp(src)
    .extract({ left: 1, top: 1, width: 1, height: 1 })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  return { r: data[0], g: data[1], b: data[2], alpha: 1 }
}
const hexToRgb = (h) => ({
  r: parseInt(h.slice(1, 3), 16),
  g: parseInt(h.slice(3, 5), 16),
  b: parseInt(h.slice(5, 7), 16),
  alpha: 1,
})
const bg = bgArg ? hexToRgb(bgArg) : await cornerColor()
console.log('背景色:', `rgb(${bg.r},${bg.g},${bg.b})`)

// 端まで塗る(cover)で正方形にトリミング。
async function cover(size) {
  return sharp(src).resize(size, size, { fit: 'cover', position: 'centre' }).png().toBuffer()
}

// maskable用: セーフゾーン確保のため中身を少し縮小し、周囲を背景色で塗る。
async function masked(size, pad) {
  const inner = Math.round(size * (1 - pad * 2))
  const content = await sharp(src).resize(inner, inner, { fit: 'cover', position: 'centre' }).toBuffer()
  const off = Math.round((size - inner) / 2)
  return sharp({ create: { width: size, height: size, channels: 4, background: bg } })
    .composite([{ input: content, top: off, left: off }])
    .png()
    .toBuffer()
}

async function write(name, buf) {
  await sharp(buf).toFile(join(OUT, name))
  console.log('wrote', name, buf.length, 'bytes')
}

await write('icon-192.png', await cover(192))
await write('icon-512.png', await cover(512))
await write('icon-512-maskable.png', await masked(512, 0.12))
await write('apple-touch-icon.png', await cover(180))

console.log('done →', OUT)
