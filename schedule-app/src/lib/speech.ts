// 音声入力の抽象化レイヤー（要件 6-5）。
// Phase 1: Web Speech API（webkitSpeechRecognition）。追加コストゼロ・その場で文字化。
// Phase 2 で「録音→文字起こしAPI」に差し替える場合も、この Dictation インターフェースを
// 満たす別実装に置き換えれば、呼び出し側（受信箱）は変更不要。

export interface DictationHandlers {
  /** 認識途中の暫定テキスト */
  onPartial?: (text: string) => void
  /** 確定テキスト */
  onFinal: (text: string) => void
  onError?: (message: string) => void
  onEnd?: () => void
}

export interface Dictation {
  readonly supported: boolean
  start(handlers: DictationHandlers): void
  stop(): void
}

// 標準の型定義に webkitSpeechRecognition が無いため最小限だけ宣言
type SRConstructor = new () => {
  lang: string
  interimResults: boolean
  continuous: boolean
  onresult: ((e: unknown) => void) | null
  onerror: ((e: unknown) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
}

function getSR(): SRConstructor | null {
  const w = window as unknown as {
    SpeechRecognition?: SRConstructor
    webkitSpeechRecognition?: SRConstructor
  }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

export function createDictation(lang = 'ja-JP'): Dictation {
  const SR = getSR()

  if (!SR) {
    return {
      supported: false,
      start: (h) => h.onError?.('この端末/ブラウザは音声入力に未対応です'),
      stop: () => {},
    }
  }

  let rec: InstanceType<SRConstructor> | null = null

  return {
    supported: true,
    start(h) {
      rec = new SR()
      rec.lang = lang
      rec.interimResults = true
      rec.continuous = false
      rec.onresult = (e) => {
        // e.results は SpeechRecognitionResultList
        const ev = e as {
          results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }>
        }
        let partial = ''
        for (let i = 0; i < ev.results.length; i++) {
          const r = ev.results[i]
          const t = r[0]?.transcript ?? ''
          if (r.isFinal) h.onFinal(t.trim())
          else partial += t
        }
        if (partial) h.onPartial?.(partial)
      }
      rec.onerror = (e) => {
        const err = e as { error?: string }
        const map: Record<string, string> = {
          'not-allowed': 'マイクの使用が許可されていません',
          'service-not-allowed': 'マイクの使用が許可されていません',
          'no-speech': '音声が検出されませんでした',
          network: 'ネットワークエラーで認識できませんでした',
        }
        h.onError?.(map[err.error ?? ''] ?? `音声認識エラー: ${err.error ?? '不明'}`)
      }
      rec.onend = () => h.onEnd?.()
      rec.start()
    },
    stop() {
      rec?.stop()
    },
  }
}
