import { useMemo, useState } from 'react'
import { CONCEPTS } from '../data/concepts'
import { MANNERS } from '../data/shinshu/manners'
import { PHRASES } from '../data/shinshu/phrases'
import { STORIES } from '../data/stories'
import { WORDS } from '../data/words'

type Kind = 'phrase' | 'manner' | 'concept' | 'word' | 'story'

const TABS: { id: Kind; label: string; note: string }[] = [
  { id: 'phrase', label: 'お聖教', note: '正信偈・和讃・歎異抄・御文の一句。法話の頭に置く' },
  { id: 'manner', label: '大谷派の言い回し', note: '法話・挨拶でうっかり出やすい言い方と、その言い換え' },
  { id: 'concept', label: '仏教語', note: '世間での受け取りと、本来の意味の落差で引ける' },
  { id: 'word', label: '日常語の出どころ', note: '毎日使う言葉が、もとは仏教語だったもの' },
  { id: 'story', label: '喩え・逸話', note: 'そのまま語れる長さにしてある' },
]

export default function DictView() {
  const [kind, setKind] = useState<Kind>('phrase')
  const [q, setQ] = useState('')

  const hit = (...parts: string[]) =>
    q.trim() === '' || parts.some((p) => p.includes(q.trim()))

  const concepts = useMemo(
    () => CONCEPTS.filter((c) => hit(c.term, c.reading, c.oneLine, c.everyday, c.misread, c.pivot)),
    [q],
  )
  const words = useMemo(
    () => WORDS.filter((w) => hit(w.word, w.reading, w.origin, w.now, w.gap)),
    [q],
  )
  const stories = useMemo(
    () => STORIES.filter((s) => hit(s.title, s.summary, s.point, s.source)),
    [q],
  )
  const phrases = useMemo(
    () => PHRASES.filter((p) => hit(p.text, p.reading ?? '', p.source, p.gloss, p.use)),
    [q],
  )
  const manners = useMemo(
    () => MANNERS.filter((m) => hit(m.avoid, m.use, m.why)),
    [q],
  )

  const tab = TABS.find((t) => t.id === kind)!

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-1.5">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`chip ${kind === t.id ? 'chip-on' : ''}`}
            onClick={() => setKind(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <p className="text-xs text-stone-500">{tab.note}</p>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="言葉で探す（例：本願、御文、無常、我慢）"
        className="min-h-tap w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
      />

      {kind === 'phrase' && (
        <div className="flex flex-col gap-2">
          {phrases.map((p) => (
            <div key={p.id} className="card px-4 py-3">
              <p className="text-[15px] font-bold leading-relaxed">{p.text}</p>
              {p.reading && <p className="mt-0.5 text-xs text-stone-500">{p.reading}</p>}
              <p className="mt-1 text-sm leading-relaxed">
                <span className="label">意 </span>
                {p.gloss}
              </p>
              <p className="text-sm leading-relaxed text-stone-700">
                <span className="label">使いどころ </span>
                {p.use}
              </p>
              <p className="mt-2 text-xs text-stone-500">出典：{p.source}</p>
              {p.caution && <p className="mt-1 text-xs text-amber-700">確認：{p.caution}</p>}
            </div>
          ))}
        </div>
      )}

      {kind === 'manner' && (
        <div className="flex flex-col gap-2">
          <p className="text-xs leading-relaxed text-stone-500">
            地域・寺によって実際の扱いに幅があります。頭から否定せず、由来として伝えるための材料です。
          </p>
          {manners.map((m) => (
            <div key={m.id} className="card px-4 py-3">
              <p className="text-sm leading-relaxed text-stone-500 line-through decoration-stone-300">
                {m.avoid}
              </p>
              <p className="mt-0.5 text-[15px] font-bold leading-relaxed text-enji">{m.use}</p>
              <p className="mt-1 text-sm leading-relaxed text-stone-700">{m.why}</p>
              {m.caution && <p className="mt-1 text-xs text-amber-700">確認：{m.caution}</p>}
            </div>
          ))}
        </div>
      )}

      {kind === 'concept' && (
        <div className="flex flex-col gap-2">
          {concepts.map((c) => (
            <div key={c.id} className="card px-4 py-3">
              <div className="flex flex-wrap items-baseline gap-2">
                <h3 className="text-base font-bold">{c.term}</h3>
                <span className="text-xs text-stone-500">{c.reading}</span>
              </div>
              <p className="mt-1 text-[15px] leading-relaxed">{c.oneLine}</p>
              <dl className="mt-2 space-y-1 text-sm leading-relaxed">
                <div>
                  <dt className="label inline">世間では </dt>
                  <dd className="inline text-stone-700">{c.misread}</dd>
                </div>
                <div>
                  <dt className="label inline">ズレ </dt>
                  <dd className="inline text-stone-700">{c.pivot}</dd>
                </div>
                <div>
                  <dt className="label inline">一歩 </dt>
                  <dd className="inline text-stone-700">{c.step}</dd>
                </div>
              </dl>
              <p className="mt-2 text-xs text-stone-500">出典：{c.source}</p>
              {c.caution && <p className="mt-1 text-xs text-amber-700">確認：{c.caution}</p>}
            </div>
          ))}
        </div>
      )}

      {kind === 'word' && (
        <div className="flex flex-col gap-2">
          {words.map((w) => (
            <div key={w.id} className="card px-4 py-3">
              <div className="flex flex-wrap items-baseline gap-2">
                <h3 className="text-base font-bold">{w.word}</h3>
                <span className="text-xs text-stone-500">{w.reading}</span>
              </div>
              <p className="mt-1 text-sm leading-relaxed">
                <span className="label">いま </span>
                {w.now}
              </p>
              <p className="text-sm leading-relaxed">
                <span className="label">もとは </span>
                {w.origin}
              </p>
              <p className="mt-1 text-[15px] leading-relaxed text-stone-700">{w.gap}</p>
              {w.caution && <p className="mt-1 text-xs text-amber-700">確認：{w.caution}</p>}
            </div>
          ))}
        </div>
      )}

      {kind === 'story' && (
        <div className="flex flex-col gap-2">
          {stories.map((s) => (
            <div key={s.id} className="card px-4 py-3">
              <div className="flex flex-wrap items-baseline gap-2">
                <h3 className="text-base font-bold">{s.title}</h3>
                <span className="rounded bg-stone-100 px-1.5 py-0.5 text-xs text-stone-500">
                  {s.kind}
                </span>
              </div>
              <p className="mt-1 text-[15px] leading-relaxed">{s.summary}</p>
              <p className="mt-1 text-sm text-stone-700">
                <span className="label">使いどころ </span>
                {s.point}
              </p>
              <p className="mt-2 text-xs text-stone-500">出典：{s.source}</p>
              {s.caution && <p className="mt-1 text-xs text-amber-700">確認：{s.caution}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
