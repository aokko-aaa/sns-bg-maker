import { describe, expect, it } from 'vitest'
import { ANGLES } from '../data/angles'
import { CONCEPTS } from '../data/concepts'
import { MODERNS } from '../data/modern'
import type { EmotionId } from '../data/types'
import { toProse, toScript } from './format'
import { generateNeta, SECTION, type GenerateInput } from './generate'
import { detectEmotions } from './match'

const base: GenerateInput = {
  text: '',
  emotions: ['shitto', 'hikaku'],
  sceneId: 'howakai',
  month: 5,
  kojitsukeMax: 3,
  seed: 12345,
  count: 6,
}

describe('generateNeta', () => {
  it('指定した数だけ出る', () => {
    expect(generateNeta(base)).toHaveLength(6)
    expect(generateNeta({ ...base, count: 12 })).toHaveLength(12)
  })

  it('同じ入力と種なら同じ結果になる（引き直すまで変わらない）', () => {
    expect(generateNeta(base)).toEqual(generateNeta(base))
  })

  it('種が変われば中身が変わる', () => {
    const a = generateNeta(base).map((n) => n.title)
    const b = generateNeta({ ...base, seed: 999 }).map((n) => n.title)
    expect(a).not.toEqual(b)
  })

  it('本文に未定義や空欄が混ざらない', () => {
    for (const n of generateNeta({ ...base, count: 24 })) {
      expect(n.title).not.toMatch(/undefined|NaN/)
      expect(n.sections.length).toBeGreaterThan(0)
      for (const s of n.sections) {
        expect(s.body.trim().length, `${n.title} / ${s.label}`).toBeGreaterThan(0)
        expect(s.body).not.toMatch(/undefined|NaN/)
      }
    }
  })

  it('こじつけ度の上限を超える切り口は出ない', () => {
    for (const n of generateNeta({ ...base, kojitsukeMax: 1, count: 12 })) {
      expect(n.kojitsuke).toBe(1)
    }
    for (const n of generateNeta({ ...base, kojitsukeMax: 2, count: 12 })) {
      expect(n.kojitsuke).toBeLessThanOrEqual(2)
    }
  })

  it('ひと回しで切り口が偏らない', () => {
    const kinds = new Set(generateNeta(base).map((n) => n.angleId))
    expect(kinds.size).toBe(6)
  })

  it('使える切り口をすべて回せる', () => {
    const kinds = new Set(generateNeta({ ...base, count: ANGLES.length }).map((n) => n.angleId))
    expect(kinds.size).toBe(ANGLES.length)
  })

  it('掲示板を選ぶと、一行と短文の形になる', () => {
    for (const n of generateNeta({ ...base, sceneId: 'keijiban' })) {
      expect(n.minutes).toBe(0)
      expect(n.sections.map((s) => s.label)).toEqual([
        SECTION.hitokoto,
        SECTION.tanbun,
        SECTION.shikomi,
      ])
    }
  })

  it('法話会では入口から結びまでの構成で出て、最後に語り手向けメモがつく', () => {
    for (const n of generateNeta(base)) {
      const labels = n.sections.map((s) => s.label)
      expect(labels[0]).toBe(SECTION.iriguchi)
      expect(labels[labels.length - 1]).toBe(SECTION.memo)
      expect(labels[labels.length - 2]).toBe(SECTION.musubi)
      expect(labels).toContain(SECTION.otoshi)
    }
  })

  it('通し原稿には語り手向けメモを混ぜない', () => {
    for (const n of generateNeta(base)) {
      const memo = n.sections.find((s) => s.label === SECTION.memo)
      expect(memo).toBeDefined()
      expect(toProse(n)).not.toContain(memo!.body)
      expect(toScript(n)).toContain(memo!.body)
    }
  })

  it('使った素材の出典が必ずついてくる', () => {
    for (const n of generateNeta({ ...base, count: 12 })) {
      expect(n.sources.length).toBeGreaterThan(0)
      if (n.materials.storyId) {
        expect(n.sources.join('\n')).toContain('：')
      }
    }
  })

  it('気持ちを選ばなくても出る', () => {
    const out = generateNeta({ ...base, emotions: [] })
    expect(out).toHaveLength(6)
  })

  it('選んだ気持ちに当たる素材が優先される', () => {
    const emotions: EmotionId[] = ['shitto', 'hikaku']
    const out = generateNeta({ ...base, emotions, count: 6 })
    const onTag = out.filter((n) => {
      const c = CONCEPTS.find((x) => x.id === n.materials.conceptId)
      const m = MODERNS.find((x) => x.id === n.materials.modernId)
      return (
        (c?.emotions ?? []).some((e) => emotions.includes(e)) ||
        (m?.emotions ?? []).some((e) => emotions.includes(e))
      )
    })
    expect(onTag.length).toBeGreaterThanOrEqual(5)
  })

  it('選んだ気持ちに寄った素材が使われる', () => {
    const out = generateNeta({ ...base, emotions: ['wakare'], count: 12 })
    const modernIds = out.map((n) => n.materials.modernId)
    // 別れに紐づく場面が一つは選ばれる
    expect(
      modernIds.some((id) =>
        ['oshi', 'soubetsu', 'butsudan', 'byoushitsu', 'nokosareta_fuku', 'nokosareta-fuku'].includes(
          id ?? '',
        ),
      ),
    ).toBe(true)
  })
})

describe('detectEmotions', () => {
  it('書かれた文から気持ちを拾う', () => {
    expect(detectEmotions('同級生のSNSを見て、つい比べてしまう')).toContain('hikaku')
    expect(detectEmotions('親に同じことを三度聞かれてイライラした')).toContain('iraira')
    expect(detectEmotions('')).toEqual([])
  })
})
