import { useEffect, useRef, useState } from 'react'
import { createDictation, type Dictation } from '@/lib/speech'

/**
 * 音声入力フック。lib/speech の Dictation を React から使いやすくラップ。
 * onFinal で確定テキストを受け取り、listening 状態を返す。
 */
export function useDictation() {
  const ref = useRef<Dictation | null>(null)
  if (!ref.current) ref.current = createDictation()
  const [listening, setListening] = useState(false)
  const [partial, setPartial] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    return () => ref.current?.stop()
  }, [])

  function start(onFinal: (text: string) => void) {
    setError(null)
    setPartial('')
    setListening(true)
    ref.current!.start({
      onPartial: setPartial,
      onFinal: (t) => {
        if (t) onFinal(t)
      },
      onError: (m) => {
        setError(m)
        setListening(false)
      },
      onEnd: () => {
        setPartial('')
        setListening(false)
      },
    })
  }

  function stop() {
    ref.current?.stop()
    setListening(false)
  }

  return {
    supported: ref.current!.supported,
    listening,
    partial,
    error,
    start,
    stop,
  }
}
