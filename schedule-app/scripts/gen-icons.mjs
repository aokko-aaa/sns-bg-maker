// 依存なしで PWA アイコン PNG を生成する。
// zlib（Node標準）で PNG を手書きエンコードし、要件のカレンダー風アイコンを描く。
import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons')
mkdirSync(OUT, { recursive: true })

const hex = (h) => [
  parseInt(h.slice(1, 3), 16),
  parseInt(h.slice(3, 5), 16),
  parseInt(h.slice(5, 7), 16),
]
const BLUE = hex('#4F86F7')
const BLUE_D = hex('#2f5fbf')
const HEAD = hex('#e6efff')
const WHITE = [255, 255, 255]
const DOTS = [hex('#4F86F7'), hex('#F7845F'), hex('#5FC77E'), hex('#c9d3e0')]

function crc32(buf) {
  let c = ~0
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i]
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1))
  }
  return ~c >>> 0
}
function chunk(type, data) {
  const t = Buffer.from(type, 'ascii')
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length, 0)
  const body = Buffer.concat([t, data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body), 0)
  return Buffer.concat([len, body, crc])
}
function encodePng(size, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // color type RGBA
  const raw = Buffer.alloc((size * 4 + 1) * size)
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0 // filter none
    for (let x = 0; x < size; x++) {
      const src = (y * size + x) * 4
      const dst = y * (size * 4 + 1) + 1 + x * 4
      raw[dst] = rgba[src]
      raw[dst + 1] = rgba[src + 1]
      raw[dst + 2] = rgba[src + 2]
      raw[dst + 3] = rgba[src + 3]
    }
  }
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

function draw(size, { pad = 0.14, transparentBg = false } = {}) {
  const px = new Uint8Array(size * size * 4)
  const set = (x, y, [r, g, b], a = 255) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return
    const i = (y * size + x) * 4
    px[i] = r
    px[i + 1] = g
    px[i + 2] = b
    px[i + 3] = a
  }
  const rrect = (x0, y0, w, h, rad, color) => {
    for (let y = y0; y < y0 + h; y++) {
      for (let x = x0; x < x0 + w; x++) {
        const dx = Math.min(x - x0, x0 + w - 1 - x)
        const dy = Math.min(y - y0, y0 + h - 1 - y)
        if (dx < rad && dy < rad) {
          const d = Math.hypot(rad - dx, rad - dy)
          if (d > rad) continue
        }
        set(x, y, color)
      }
    }
  }

  // 背景（maskable はセーフゾーン考慮でパディング、apple-touch は不透明）
  const p = Math.round(size * pad)
  if (!transparentBg) rrect(0, 0, size, size, Math.round(size * 0.22), BLUE)
  const bx = p
  const by = p
  const bw = size - p * 2
  const bh = size - p * 2
  // カード（角の丸い青地）
  rrect(bx, by, bw, bh, Math.round(bw * 0.18), BLUE)
  // カレンダー本体（白）
  const m = Math.round(bw * 0.14)
  const cx = bx + m
  const cy = by + Math.round(bh * 0.2)
  const cw = bw - m * 2
  const ch = bh - Math.round(bh * 0.28)
  rrect(cx, cy, cw, ch, Math.round(cw * 0.08), WHITE)
  // ヘッダ帯
  rrect(cx, cy, cw, Math.round(ch * 0.22), Math.round(cw * 0.08), HEAD)
  // リング
  const rw = Math.round(cw * 0.08)
  rrect(cx + Math.round(cw * 0.22), by + Math.round(bh * 0.12), rw, Math.round(bh * 0.14), rw / 2, BLUE_D)
  rrect(cx + Math.round(cw * 0.7), by + Math.round(bh * 0.12), rw, Math.round(bh * 0.14), rw / 2, BLUE_D)
  // ドット 2x2
  const dsz = Math.round(cw * 0.16)
  const gap = Math.round(cw * 0.1)
  const gx = cx + Math.round(cw * 0.16)
  const gy = cy + Math.round(ch * 0.42)
  const pos = [
    [gx, gy],
    [gx + dsz + gap, gy],
    [gx, gy + dsz + gap],
    [gx + dsz + gap, gy + dsz + gap],
  ]
  pos.forEach(([x, y], i) => rrect(x, y, dsz, dsz, Math.round(dsz * 0.3), DOTS[i]))

  return px
}

const targets = [
  { name: 'icon-192.png', size: 192, opts: { pad: 0.08 } },
  { name: 'icon-512.png', size: 512, opts: { pad: 0.08 } },
  { name: 'icon-512-maskable.png', size: 512, opts: { pad: 0.16 } },
  { name: 'apple-touch-icon.png', size: 180, opts: { pad: 0.06 } },
]
for (const t of targets) {
  const png = encodePng(t.size, draw(t.size, t.opts))
  writeFileSync(join(OUT, t.name), png)
  console.log('wrote', t.name, png.length, 'bytes')
}
