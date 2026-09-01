// 背景画像の設定（端末内 localStorage に保存。端末ごと・オフラインOK）。
// 画像は縮小してから保存し、明るさ/にぎやかさから「白のせ(ヴェール)」量を自動算出。

export type BgMode = 'default' | 'custom' | 'none'
export type BgFit = 'cover' | 'contain'
export interface BgSettings {
  mode: BgMode
  img?: string // custom時の dataURL
  veil: number // 0..0.6 白のせ不透明度
  fit?: BgFit // 画面いっぱい(cover) / 全体を表示(contain)
  posY?: number // 縦位置 0(上)..100(下)
}

const KEY = 'bg-settings'
const DEFAULT: BgSettings = { mode: 'default', veil: 0.15, fit: 'cover', posY: 0 }

export function loadBg(): BgSettings {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return DEFAULT
    const s = JSON.parse(raw) as BgSettings
    return {
      mode: s.mode ?? 'default',
      img: s.img,
      veil: s.veil ?? 0.15,
      fit: s.fit ?? 'cover',
      posY: s.posY ?? 0,
    }
  } catch {
    return DEFAULT
  }
}

export function applyBg(s: BgSettings) {
  const root = document.documentElement
  if (s.mode === 'none') {
    root.style.setProperty('--bg-img', 'none')
    root.style.setProperty('--bg-veil', '0')
    return
  }
  root.style.setProperty('--bg-size', s.fit ?? 'cover')
  root.style.setProperty('--bg-pos-y', `${s.posY ?? 0}%`)
  root.style.setProperty('--bg-veil', String(s.veil))
  if (s.mode === 'custom' && s.img) {
    root.style.setProperty('--bg-img', `url("${s.img}")`)
  } else {
    root.style.setProperty('--bg-img', "url('/bg.png')")
  }
}

export function saveBg(s: BgSettings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s))
  } catch {
    /* 容量超過などは無視 */
  }
  applyBg(s)
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = url
  })
}

/** 画像を縮小し dataURL 化。明るさ/分散から推奨ヴェールも返す */
export async function processImage(
  file: File
): Promise<{ dataUrl: string; veil: number }> {
  const url = URL.createObjectURL(file)
  try {
    const img = await loadImage(url)
    // 長辺を1600pxに収める（縦長の壁紙でもくっきり）
    const maxSide = 1600
    const scale = Math.min(1, maxSide / Math.max(img.width, img.height))
    const w = Math.max(1, Math.round(img.width * scale))
    const h = Math.max(1, Math.round(img.height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(img, 0, 0, w, h)
    const dataUrl = canvas.toDataURL('image/jpeg', 0.82)

    // 32x32 に縮小して明るさ(平均)と分散(にぎやかさ)を計測
    const s = 32
    const sc = document.createElement('canvas')
    sc.width = s
    sc.height = s
    const sctx = sc.getContext('2d')!
    sctx.drawImage(img, 0, 0, s, s)
    const d = sctx.getImageData(0, 0, s, s).data
    let sum = 0
    let sum2 = 0
    const n = s * s
    for (let i = 0; i < d.length; i += 4) {
      const L = (0.2126 * d[i]! + 0.7152 * d[i + 1]! + 0.0722 * d[i + 2]!) / 255
      sum += L
      sum2 += L * L
    }
    const mean = sum / n
    const std = Math.sqrt(Math.max(0, sum2 / n - mean * mean))
    // にぎやか・明暗が極端 → 白のせ多め
    let veil = 0.22 + std * 1.2 + Math.abs(mean - 0.5) * 0.3
    veil = Math.min(0.6, Math.max(0.15, veil))
    return { dataUrl, veil: Math.round(veil * 100) / 100 }
  } finally {
    URL.revokeObjectURL(url)
  }
}
