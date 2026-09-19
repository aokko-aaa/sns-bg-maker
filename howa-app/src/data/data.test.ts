import { describe, expect, it } from 'vitest'
import { ANGLES, SCENES } from './angles'
import { CONCEPTS } from './concepts'
import { EMOTIONS } from './emotions'
import { MODERNS } from './modern'
import { OCCASIONS } from './occasions'
import { MANNERS } from './shinshu/manners'
import { PHRASES } from './shinshu/phrases'
import { STORIES } from './stories'
import { WORDS } from './words'

const emotionIds = new Set(EMOTIONS.map((e) => e.id))

const datasets = [
  { name: 'emotions', items: EMOTIONS as { id: string }[] },
  { name: 'concepts', items: CONCEPTS as { id: string }[] },
  { name: 'stories', items: STORIES as { id: string }[] },
  { name: 'words', items: WORDS as { id: string }[] },
  { name: 'moderns', items: MODERNS as { id: string }[] },
  { name: 'occasions', items: OCCASIONS as { id: string }[] },
  { name: 'phrases', items: PHRASES as { id: string }[] },
  { name: 'manners', items: MANNERS as { id: string }[] },
  { name: 'angles', items: ANGLES as { id: string }[] },
  { name: 'scenes', items: SCENES as { id: string }[] },
]

describe('データの整合', () => {
  it.each(datasets)('$name のidが重複していない', ({ items }) => {
    const ids = items.map((x) => x.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  const tagged = [
    { name: 'concepts', items: CONCEPTS },
    { name: 'stories', items: STORIES },
    { name: 'words', items: WORDS },
    { name: 'moderns', items: MODERNS },
  ]
  it.each(tagged)('$name の感情タグがすべて実在する', ({ items }) => {
    const unknown = items.flatMap((x) => x.emotions.filter((e) => !emotionIds.has(e)))
    expect(unknown).toEqual([])
  })

  it('すべての感情に、素材が最低一つずつ結びついている', () => {
    const covered = new Set(
      [...CONCEPTS, ...STORIES, ...WORDS, ...MODERNS].flatMap((x) => x.emotions),
    )
    const missing = EMOTIONS.map((e) => e.id).filter((id) => !covered.has(id))
    expect(missing).toEqual([])
  })

  it('どの感情でも、仏教語・喩え話・日常語がそれぞれ用意されている', () => {
    for (const e of EMOTIONS) {
      expect(CONCEPTS.some((c) => c.emotions.includes(e.id)), `concept: ${e.id}`).toBe(true)
      expect(STORIES.some((s) => s.emotions.includes(e.id)), `story: ${e.id}`).toBe(true)
      expect(WORDS.some((w) => w.emotions.includes(e.id)), `word: ${e.id}`).toBe(true)
      expect(MODERNS.some((m) => m.emotions.includes(e.id)), `modern: ${e.id}`).toBe(true)
    }
  })

  it('お聖教の一句に、出典と意味と使いどころが揃っている', () => {
    for (const p of PHRASES) {
      expect(p.source.length, p.text).toBeGreaterThan(0)
      expect(p.gloss.length, p.text).toBeGreaterThan(0)
      expect(p.use.length, p.text).toBeGreaterThan(0)
      expect(p.emotions.every((e) => emotionIds.has(e)), p.text).toBe(true)
    }
  })

  it('御文と歎異抄の一句が、それぞれ複数ある', () => {
    expect(PHRASES.filter((p) => p.source.includes('御文')).length).toBeGreaterThanOrEqual(2)
    expect(PHRASES.filter((p) => p.source.includes('歎異抄')).length).toBeGreaterThanOrEqual(2)
  })

  it('言い回しの注意に、代わりの言い方と理由がある', () => {
    for (const m of MANNERS) {
      expect(m.use.length, m.avoid).toBeGreaterThan(0)
      expect(m.why.length, m.avoid).toBeGreaterThan(0)
    }
  })

  it('真宗の素材が、どの切り口にも回せるだけある', () => {
    expect(CONCEPTS.filter((c) => c.tradition === 'shinshu').length).toBeGreaterThanOrEqual(20)
    expect(STORIES.filter((x) => x.tradition === 'shinshu').length).toBeGreaterThanOrEqual(10)
    expect(WORDS.filter((x) => x.tradition === 'shinshu').length).toBeGreaterThanOrEqual(4)
  })

  it('どの月にも真宗の行事がある', () => {
    for (let m = 1; m <= 12; m++) {
      expect(
        OCCASIONS.some((o) => o.tradition === 'shinshu' && o.months.includes(m)),
        `month: ${m}`,
      ).toBe(true)
    }
  })

  it('どの月にも行事の素材がある', () => {
    for (let m = 1; m <= 12; m++) {
      expect(OCCASIONS.some((o) => o.months.includes(m)), `month: ${m}`).toBe(true)
    }
  })

  it('仏教語には出典と、世間の受け取り／ズレが揃っている', () => {
    for (const c of CONCEPTS) {
      expect(c.source.length, c.term).toBeGreaterThan(0)
      expect(c.misread.length, c.term).toBeGreaterThan(0)
      expect(c.pivot.length, c.term).toBeGreaterThan(0)
      expect(c.step.length, c.term).toBeGreaterThan(0)
    }
  })
})
