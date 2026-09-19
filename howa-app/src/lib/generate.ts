import { ANGLES, ANGLE_BY_ID, SCENE_BY_ID } from '../data/angles'
import { CONCEPTS } from '../data/concepts'
import { EMOTION_BY_ID } from '../data/emotions'
import { MODERNS } from '../data/modern'
import { OCCASIONS } from '../data/occasions'
import { STORIES } from '../data/stories'
import { WORDS } from '../data/words'
import type {
  Angle,
  Concept,
  EmotionId,
  Modern,
  Neta,
  NetaSection,
  Occasion,
  Scene,
  SceneId,
  Story,
  Word,
} from '../data/types'
import { rankItems, type Ranked } from './match'
import { hashString, mulberry32, shuffle, type Rand } from './random'

export const SECTION = {
  iriguchi: '入口（一般の人の思考起点）',
  hikkakari: 'ひっかかり',
  toi: '問い',
  kotoba: '仏教のことば',
  tatoe: 'たとえ・逸話',
  zure: '視座のズレ',
  seken: '世間の見方',
  hotoke: '仏の見方',
  otoshi: '落とし込み',
  musubi: '結び',
  watashi: 'ここで仏教へ渡す',
  memo: '演出メモ（語り手向け・声に出さない）',
  hitokoto: '掲示の一行（案）',
  tanbun: '短文（寺報・SNS）',
  shikomi: '仕込み（聞かれたら話す中身）',
} as const

export type GenerateInput = {
  text: string
  emotions: EmotionId[]
  sceneId: SceneId
  month: number
  /** こじつけ度の上限（1=素直のみ 3=全部） */
  kojitsukeMax: 1 | 2 | 3
  seed: number
  count: number
}

type Ctx = {
  emotionLabels: string[]
  primaryLabel: string
  userText: string
  modern: Modern
  concept: Concept
  story: Story
  word: Word
  occasion: Occasion
  scene: Scene
}

type Built = {
  title: string
  sections: NetaSection[]
  /** 語り手にだけ見せる注意・ねらい（本文には混ぜない） */
  meta: string[]
  /** 実際に使った素材（出典と注意書きの収集に使う） */
  uses: { concept?: boolean; story?: boolean; word?: boolean; occasion?: boolean }
}

const s = (label: string, body: string): NetaSection => ({ label, body })

/** 文の途中に埋めるとき、末尾の句点を外す */
const nq = (t: string) => t.replace(/。$/, '')

const conceptLine = (c: Concept) =>
  `${c.term}（${c.reading}）。${c.oneLine}　【${c.source}】`

const storyLine = (st: Story) => `${st.summary}　【${st.source}】`

const BUILDERS: Record<string, (c: Ctx) => Built> = {
  ura: (c) => ({
    title: `${c.modern.scene}の裏にあるもの — ${c.concept.term}`,
    uses: { concept: true },
    meta: [],
    sections: [
      s(SECTION.iriguchi, c.modern.line),
      s(
        SECTION.hikkakari,
        `${c.primaryLabel}という気持ちは、裏返せば「本当はこうであってほしい」という願いです。${c.concept.everyday}`,
      ),
      s(SECTION.kotoba, conceptLine(c.concept)),
      s(SECTION.zure, `世間では、${nq(c.concept.misread)}。けれども、${c.concept.pivot}`),
      s(SECTION.otoshi, c.concept.step),
      s(
        SECTION.musubi,
        `${c.modern.scene}で立ち止まったあの時間は、無駄ではありません。そこに「${c.concept.term}」という言葉を一つ、置いて帰ってください。`,
      ),
    ],
  }),

  gogen: (c) => ({
    title: `「${c.word.word}」は、もともと仏教のことば`,
    uses: { word: true, concept: true },
    meta: [c.word.gap],
    sections: [
      s(SECTION.iriguchi, `${c.modern.line}　そういうとき、私たちは「${c.word.word}」という言葉を使います。`),
      s(SECTION.hikkakari, `いまこの言葉は、${nq(c.word.now)}という意味で使われています。ところが、もとの意味は違いました。`),
      s(SECTION.kotoba, `${c.word.word}（${c.word.reading}）—— ${c.word.origin}`),
      s(
        SECTION.zure,
        `${nq(c.word.origin)}。それが今では、${nq(c.word.now)}。言葉は残って、中身だけが入れ替わりました。`,
      ),
      s(SECTION.watashi, `${conceptLine(c.concept)}　ここにつなげると、${c.concept.pivot}`),
      s(SECTION.otoshi, c.concept.step),
      s(
        SECTION.musubi,
        `毎日使っている言葉の中に、教えはもう入っていました。今日「${c.word.word}」と口にするとき、一度だけ立ち止まってみてください。`,
      ),
    ],
  }),

  kazoeru: (c) => ({
    title: `${c.primaryLabel}を、分けて数えてみる`,
    uses: { concept: true },
    meta: [],
    sections: [
      s(SECTION.iriguchi, c.modern.line),
      s(
        SECTION.hikkakari,
        `苦しいとき、私たちは全部をひとかたまりにして「もうだめだ」と言います。ところが仏教は、こういうときこそ分けて数えます。`,
      ),
      s(SECTION.kotoba, conceptLine(c.concept)),
      s(SECTION.zure, `${nq(c.concept.misread)}。実際には、${c.concept.pivot}`),
      s(SECTION.otoshi, `${nq(c.concept.step)}。紙に三行書くだけで、かたまりが少しほどけます。`),
      s(SECTION.musubi, `全部が苦しいのではありません。分けてみると、今日手をつけられるものが一つは残ります。`),
    ],
  }),

  'tatoe-swap': (c) => ({
    title: `${c.story.title}を、${c.modern.scene}で語る`,
    uses: { story: true, concept: true },
    meta: [c.story.point],
    sections: [
      s(SECTION.iriguchi, c.modern.line),
      s(SECTION.tatoe, `こういう話があります。${storyLine(c.story)}`),
      s(
        SECTION.zure,
        `二千年前の喩えですが、置き換えれば${c.modern.scene}の場面そのものです。道具が変わっただけで、私たちのつまずき方は変わっていません。`,
      ),
      s(SECTION.watashi, conceptLine(c.concept)),
      s(SECTION.otoshi, c.concept.step),
      s(SECTION.musubi, `${c.story.title}は、昔の話ではありませんでした。今朝の話です。`),
    ],
  }),

  toi: (c) => ({
    title: `問いからはじめる — ${c.primaryLabel}`,
    uses: { concept: true },
    meta: ['答えを先に言わない。沈黙を二拍置いてから次へ進む。'],
    sections: [
      s(SECTION.iriguchi, `今日は、はじめに一つだけ質問させてください。${c.modern.line}`),
      s(SECTION.toi, `そのとき、心は何を待っていたのでしょうか。答えは言わずに、少しだけ置いておきます。`),
      s(SECTION.hikkakari, c.concept.everyday),
      s(SECTION.kotoba, conceptLine(c.concept)),
      s(SECTION.zure, `${nq(c.concept.misread)}。けれども、${c.concept.pivot}`),
      s(SECTION.otoshi, c.concept.step),
      s(SECTION.musubi, `答えは申しません。問いを持ったままお帰りいただくのが、今日のおみやげです。`),
    ],
  }),

  ichigyo: (c) => ({
    title: `「${c.concept.term}」— ${c.concept.oneLine}`,
    uses: { concept: true, story: true },
    meta: [c.story.point],
    sections: [
      s(
        SECTION.iriguchi,
        `${c.concept.term}（${c.concept.reading}）。${c.concept.source}にある言葉です。今日はこの一行だけ、覚えて帰ってください。`,
      ),
      s(SECTION.hikkakari, `と申しましても、ふだんの暮らしとは遠い言葉に聞こえます。たとえば、${c.modern.line}`),
      s(SECTION.zure, `${nq(c.concept.misread)}。ところが、${c.concept.pivot}`),
      s(SECTION.tatoe, `${c.story.title}という話があります。${storyLine(c.story)}`),
      s(SECTION.otoshi, c.concept.step),
      s(SECTION.musubi, `もう一度だけ申します。${c.concept.term}。${c.concept.oneLine}`),
    ],
  }),

  shippai: (c) => ({
    title: `私の失敗から — ${c.concept.term}`,
    uses: { concept: true },
    meta: ['冒頭の［　］に自分の失敗を入れる。教訓にせず、格好のつかないまま話し終えるほうが効く。'],
    sections: [
      s(
        SECTION.iriguchi,
        `お恥ずかしい話からはじめます。［ここにご自身の失敗を一つ。「${c.modern.scene}」のような、誰にでもある場面が使えます］`,
      ),
      s(SECTION.hikkakari, `${c.modern.line}　私も、まったく同じところでつまずきました。`),
      s(SECTION.kotoba, conceptLine(c.concept)),
      s(SECTION.zure, `私もずっと、${nq(c.concept.misread)}と思っておりました。けれども、${c.concept.pivot}`),
      s(SECTION.otoshi, c.concept.step),
      s(
        SECTION.musubi,
        `えらそうなことは申せません。同じところでつまずいた者として、この言葉だけお渡しします。${c.concept.term}。`,
      ),
    ],
  }),

  gyakusetsu: (c) => ({
    title: `${c.concept.term} — がんばらないほうの話`,
    uses: { concept: true, story: true },
    meta: [c.story.point, '冒頭で言い切ってから理由を出す。順番を入れ替えると弱くなる。'],
    sections: [
      s(SECTION.iriguchi, `今日は少し、逆のことを申し上げます。${c.modern.line}`),
      s(
        SECTION.hikkakari,
        `ふつうなら「もっと努力を」と言われる場面です。けれども、力の入れ方そのものが違っていることがあります。`,
      ),
      s(SECTION.tatoe, `${c.story.title}。${storyLine(c.story)}`),
      s(SECTION.kotoba, conceptLine(c.concept)),
      s(SECTION.zure, c.concept.pivot),
      s(SECTION.otoshi, c.concept.step),
      s(SECTION.musubi, `やめることで進むことがあります。${c.concept.term}とは、そういう言葉です。`),
    ],
  }),

  hanten: (c) => ({
    title: `世間の見方と、仏の見方 — ${c.modern.scene}`,
    uses: { concept: true, story: true },
    meta: [c.story.point, '二つの見方を並べるだけにして、どちらが正しいとは言わない。'],
    sections: [
      s(SECTION.iriguchi, c.modern.line),
      s(SECTION.seken, `世間はこう見ます。${c.concept.misread}`),
      s(
        SECTION.hotoke,
        `仏教はこう見ます。${c.concept.term}（${c.concept.reading}）—— ${c.concept.pivot}　【${c.concept.source}】`,
      ),
      s(SECTION.tatoe, `${c.story.title}。${storyLine(c.story)}`),
      s(SECTION.zure, `同じ出来事を見ているのに、立っている場所が違うだけで、これだけ変わります。`),
      s(SECTION.otoshi, c.concept.step),
      s(
        SECTION.musubi,
        `見方を変えなさい、とは申しません。もう一つの見方があると知っておくだけで、逃げ場が一つ増えます。`,
      ),
    ],
  }),

  gyoji: (c) => ({
    title: `${c.occasion.name}に寄せて — ${c.concept.term}`,
    uses: { concept: true, occasion: true },
    meta: [`行事の由来は一分以内で切り上げ、${c.modern.scene}の話に早めに移る。`],
    sections: [
      s(SECTION.iriguchi, `${c.occasion.name}の頃になりました。${c.occasion.hook}、という話をいたします。`),
      s(SECTION.hikkakari, c.modern.line),
      s(SECTION.kotoba, conceptLine(c.concept)),
      s(SECTION.zure, `${nq(c.concept.misread)}。けれども、${c.concept.pivot}`),
      s(SECTION.otoshi, c.concept.step),
      s(
        SECTION.musubi,
        `${c.occasion.name}は、毎年めぐってきます。めぐってくるたびに、同じ言葉の意味が変わっていきます。`,
      ),
    ],
  }),

  itsuwa: (c) => ({
    title: `${c.story.title}`,
    uses: { story: true, concept: true },
    meta: [c.story.point, '解説を足したくなるところをこらえる。間を置いて終える。'],
    sections: [
      s(SECTION.iriguchi, `${c.modern.line}　その話をする前に、昔の話を一つ。`),
      s(SECTION.tatoe, storyLine(c.story)),
      s(SECTION.zure, `私たちも、${c.modern.scene}のたびに、この話と同じところに立っています。`),
      s(SECTION.watashi, conceptLine(c.concept)),
      s(SECTION.otoshi, c.concept.step),
      s(SECTION.musubi, `話はこれだけです。解説はいたしません。持ち帰って、ふと思い出していただければ十分です。`),
    ],
  }),

  kojitsuke: (c) => ({
    title: `こじつけですが — 「${c.word.word}」と${c.concept.term}`,
    uses: { word: true, concept: true },
    meta: [c.word.gap, '強引さを隠さない。「こじつけです」と先に言ってしまうほうが笑いが出る。'],
    sections: [
      s(SECTION.iriguchi, c.modern.line),
      s(
        SECTION.hikkakari,
        `ここから少し強引にまいります。「${c.word.word}」という言葉があります。いまの意味は${nq(c.word.now)}。ところがもとは、${c.word.origin}`,
      ),
      s(SECTION.kotoba, conceptLine(c.concept)),
      s(SECTION.zure, `こじつけついでに申しますと、${c.concept.pivot}`),
      s(SECTION.otoshi, c.concept.step),
      s(SECTION.musubi, `だいぶ無理をいたしました。それでも覚えて帰っていただけたなら、今日はそれで十分です。`),
    ],
  }),
}

/** 掲示板・SNS用に短く畳み直す（一行の案を複数出す） */
function condense(built: Built, c: Ctx): NetaSection[] {
  const hitokoto = [
    `${nq(c.concept.oneLine)}\n　　　　—— ${c.concept.term}`,
    `${nq(c.concept.pivot)}\n　　　　—— ${c.concept.term}`,
    `「${c.word.word}」は、もとは${nq(c.word.origin)}\n　　　　—— 仏教語`,
  ]
    .map((t, i) => `［案${i + 1}］${t}`)
    .join('\n\n')
  const tanbun = `${c.modern.line}\n\n${c.concept.term}（${c.concept.reading}）。${c.concept.oneLine}\n${c.concept.pivot}\n\n${c.concept.step}`
  const shikomi = built.sections
    .filter((x) => x.label !== SECTION.iriguchi)
    .map((x) => x.body)
    .join('\n')
  return [
    s(SECTION.hitokoto, hitokoto),
    s(SECTION.tanbun, tanbun),
    s(SECTION.shikomi, shikomi),
  ]
}

function takeUnused<T extends { id: string }>(
  ranked: Ranked<T>[],
  used: Set<string>,
  rand: Rand,
  window = 6,
): T {
  // 気持ちに当たっている素材が足りているうちは、その中からだけ選ぶ。
  const positive = ranked.filter((r) => r.score > 0)
  const base = positive.length >= 3 ? positive : ranked
  const freshBase = base.filter((r) => !used.has(r.item.id))
  const freshAll = ranked.filter((r) => !used.has(r.item.id))
  const source = freshBase.length >= 2 ? freshBase : freshAll.length > 0 ? freshAll : ranked
  const pool = source.slice(0, Math.max(window, 3))
  const chosen = pool[Math.floor(rand() * pool.length) % pool.length].item
  used.add(chosen.id)
  return chosen
}

export function generateNeta(input: GenerateInput): Neta[] {
  const rand = mulberry32(input.seed ^ hashString(input.text + input.emotions.join(',')))
  const scene = SCENE_BY_ID[input.sceneId] ?? SCENE_BY_ID.howakai
  const emotionLabels = input.emotions.map((id) => EMOTION_BY_ID[id]?.label).filter(Boolean)
  const primaryLabel = emotionLabels[0] ?? 'そのざわつき'

  const rankedConcepts = rankItems(
    CONCEPTS,
    input.emotions,
    input.text,
    (x) => x.emotions,
    (x) => [x.term, ...(x.keywords ?? [])],
  )
  const rankedStories = rankItems(
    STORIES,
    input.emotions,
    input.text,
    (x) => x.emotions,
    (x) => [x.title],
  )
  const rankedWords = rankItems(
    WORDS,
    input.emotions,
    input.text,
    (x) => x.emotions,
    (x) => [x.word],
  )
  const rankedModerns = rankItems(
    MODERNS,
    input.emotions,
    input.text,
    (x) => x.emotions,
    (x) => [x.scene, ...(x.keywords ?? [])],
  )

  const occasionPool = OCCASIONS.filter((o) => o.months.includes(input.month))
  const occasions: Occasion[] = occasionPool.length > 0 ? occasionPool : OCCASIONS

  const angles = shuffle(
    ANGLES.filter((a) => a.kojitsuke <= input.kojitsukeMax),
    rand,
  )

  const usedConcept = new Set<string>()
  const usedStory = new Set<string>()
  const usedWord = new Set<string>()
  const usedModern = new Set<string>()

  const out: Neta[] = []
  for (let i = 0; i < input.count; i++) {
    const angle: Angle = angles[i % angles.length]
    const ctx: Ctx = {
      emotionLabels,
      primaryLabel,
      userText: input.text,
      modern: takeUnused(rankedModerns, usedModern, rand, 8),
      concept: takeUnused(rankedConcepts, usedConcept, rand, 8),
      story: takeUnused(rankedStories, usedStory, rand, 8),
      word: takeUnused(rankedWords, usedWord, rand, 8),
      occasion: occasions[Math.floor(rand() * occasions.length) % occasions.length],
      scene,
    }
    const built = BUILDERS[angle.id](ctx)
    const meta = [
      ...built.meta,
      `避けたい入り方：「${ctx.concept.term}とは——という意味であります」と解説から始めると、そこで顔が下がります。今日の入口は「${ctx.modern.scene}」です。`,
      scene.minutes === 0
        ? `${scene.label}：一行で立ち止まらせる。説明はしない。`
        : `${scene.label}：目安${scene.minutes}分。${scene.note}。`,
    ]
    const sections =
      scene.minutes === 0
        ? condense(built, ctx)
        : [...built.sections, s(SECTION.memo, meta.join('\n'))]

    const sources: string[] = []
    const cautions: string[] = []
    if (built.uses.concept) {
      sources.push(`${ctx.concept.term}：${ctx.concept.source}`)
      if (ctx.concept.caution) cautions.push(`${ctx.concept.term}：${ctx.concept.caution}`)
    }
    if (built.uses.story) {
      sources.push(`${ctx.story.title}：${ctx.story.source}`)
      if (ctx.story.caution) cautions.push(`${ctx.story.title}：${ctx.story.caution}`)
    }
    if (built.uses.word) {
      sources.push(`${ctx.word.word}：仏教語（${ctx.word.origin}）`)
      if (ctx.word.caution) cautions.push(`${ctx.word.word}：${ctx.word.caution}`)
    }

    out.push({
      id: `${input.seed}-${i}-${angle.id}`,
      angleId: angle.id,
      angleName: angle.name,
      aim: ANGLE_BY_ID[angle.id].aim,
      kojitsuke: angle.kojitsuke,
      title: scene.minutes === 0 ? `${ctx.concept.term} — ${ctx.modern.scene}` : built.title,
      sections,
      sources,
      cautions,
      materials: {
        conceptId: built.uses.concept ? ctx.concept.id : undefined,
        storyId: built.uses.story ? ctx.story.id : undefined,
        wordId: built.uses.word ? ctx.word.id : undefined,
        modernId: ctx.modern.id,
        occasionId: built.uses.occasion ? ctx.occasion.id : undefined,
      },
      minutes: scene.minutes,
    })
  }
  return out
}

export type { Concept, Story, Word, Modern, Scene }
