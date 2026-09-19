import { ANGLES, ANGLE_BY_ID, SCENE_BY_ID } from '../data/angles'
import { CONCEPTS } from '../data/concepts'
import { EMOTION_BY_ID } from '../data/emotions'
import { MODERNS } from '../data/modern'
import { OCCASIONS } from '../data/occasions'
import { MANNERS } from '../data/shinshu/manners'
import { PHRASES } from '../data/shinshu/phrases'
import { STORIES } from '../data/stories'
import { WORDS } from '../data/words'
import type {
  Angle,
  Concept,
  EmotionId,
  Manner,
  Phrase,
  Tradition,
  TraditionMode,
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
  shogyo: 'お聖教の一句',
  honne: '聴き手の本音（先に言ってしまう）',
  seken_tsukaikata: '世間での使い方',
  moto: 'もとの意味',
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
  /** 'otani' で真宗大谷派の素材と切り口を優先する */
  tradition: TraditionMode
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
  phrase: Phrase
  scene: Scene
  mode: TraditionMode
}

type Built = {
  title: string
  sections: NetaSection[]
  /** 語り手にだけ見せる注意・ねらい（本文には混ぜない） */
  meta: string[]
  /** 実際に使った素材（出典と注意書きの収集に使う） */
  uses: {
    concept?: boolean
    story?: boolean
    word?: boolean
    occasion?: boolean
    phrase?: boolean
  }
}

const s = (label: string, body: string): NetaSection => ({ label, body })

/** タイトルに入れるために一句を詰める */
const short = (t: string, n = 16) => (t.length > n ? `${t.slice(0, n)}…` : t)

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

  shogyo: (c) => ({
    title: `「${short(c.phrase.text)}」に聞く`,
    uses: { concept: true, phrase: true },
    meta: [c.phrase.use],
    sections: [
      s(SECTION.shogyo, `${c.phrase.text}　【${c.phrase.source}】`),
      s(SECTION.iriguchi, `${c.modern.line}　この一句を、そこへ置いてみます。`),
      s(SECTION.hikkakari, c.phrase.gloss),
      s(SECTION.kotoba, conceptLine(c.concept)),
      s(SECTION.zure, `${nq(c.concept.misread)}。けれども、${c.concept.pivot}`),
      s(SECTION.otoshi, c.concept.step),
      s(SECTION.musubi, `もう一度、あの一句を。${c.phrase.text}`),
    ],
  }),

  ofumi: (c) => ({
    title: `御文をひらく — ${c.modern.scene}`,
    uses: { concept: true, phrase: true },
    meta: [c.phrase.use, '御文の本文は自坊の勤行本で確かめる。大谷派では「御文」、本願寺派では「御文章」。'],
    sections: [
      s(SECTION.iriguchi, `御文を一通、読ませていただきます。${c.phrase.text}　【${c.phrase.source}】`),
      s(SECTION.hikkakari, `今の言葉に直すと、${nq(c.phrase.gloss)}ということになりましょうか。`),
      s(SECTION.zure, `${c.modern.line}　五百年前の手紙が、その場面をまっすぐに指しています。`),
      s(SECTION.kotoba, conceptLine(c.concept)),
      s(SECTION.otoshi, c.concept.step),
      s(SECTION.musubi, `あなかしこ、あなかしこ。`),
    ],
  }),

  tannisho: (c) => ({
    title: `歎異抄に聞く — ${c.primaryLabel}`,
    uses: { concept: true, phrase: true },
    meta: [c.phrase.use, '唯円の問いを借りて、聴き手が言えずにいることを先に口にする。'],
    sections: [
      s(SECTION.iriguchi, c.modern.line),
      s(SECTION.honne, `言いにくいことを、先に申します。${c.concept.everyday}`),
      s(SECTION.shogyo, `${c.phrase.text}　【${c.phrase.source}】`),
      s(SECTION.hikkakari, c.phrase.gloss),
      s(SECTION.kotoba, conceptLine(c.concept)),
      s(SECTION.zure, `${nq(c.concept.misread)}。ところが、${c.concept.pivot}`),
      s(SECTION.otoshi, c.concept.step),
      s(SECTION.musubi, `同じ問いを持った人が、八百年前にもおりました。問いのほうは、まだ私に残っています。`),
    ],
  }),

  jitoku: (c) => ({
    title: `私の上に聞く — ${c.concept.term}`,
    uses: { concept: true },
    meta: ['真宗の法話は、説く形にすると途端に遠くなる。聞いている側の一人として話す。', '［　］に自分のこととして一つ入れる。'],
    sections: [
      s(SECTION.iriguchi, `${c.modern.line}　これは、よその話ではありません。`),
      s(SECTION.honne, `［ここに、ご自身が「${c.modern.scene}」で引っかかった場面を一つ］`),
      s(SECTION.kotoba, conceptLine(c.concept)),
      s(SECTION.zure, `私はずっと、${nq(c.concept.misread)}と思っておりました。けれども、${c.concept.pivot}`),
      s(SECTION.otoshi, c.concept.step),
      s(
        SECTION.musubi,
        `説く側に立ってしまうと、この一句は聞こえません。私も、聞かせていただく側の一人としてここにおります。`,
      ),
    ],
  }),

  gobyakudo: (c) => ({
    title: `「${c.word.word}」は、そういう意味ではありません`,
    uses: { word: true, concept: true },
    meta: [c.word.gap],
    sections: [
      s(SECTION.iriguchi, c.modern.line),
      s(SECTION.seken_tsukaikata, `「${c.word.word}」という言葉があります。世間では、${nq(c.word.now)}——そういう意味で使われています。`),
      s(SECTION.moto, `もとの意味は、${c.word.origin}`),
      s(SECTION.kotoba, conceptLine(c.concept)),
      s(SECTION.zure, `言葉だけが残って、中身が入れ替わりました。${c.concept.pivot}`),
      s(SECTION.otoshi, c.concept.step),
      s(SECTION.musubi, `言葉を直すだけの話ではありません。使い方が変わったところに、私たちの受け取り方が出ています。`),
    ],
  }),

  houonko: (c) => ({
    title: `${c.occasion.name}に — ${c.concept.term}`,
    uses: { concept: true, occasion: true },
    meta: ['供養ではなく報恩、という一点を外さない。由来の説明は短く。'],
    sections: [
      s(SECTION.iriguchi, `${c.occasion.name}のお勤めです。${c.occasion.hook}、というところから申します。`),
      s(SECTION.hikkakari, c.modern.line),
      s(SECTION.kotoba, conceptLine(c.concept)),
      s(SECTION.zure, `${nq(c.concept.misread)}。けれども、${c.concept.pivot}`),
      s(SECTION.otoshi, c.concept.step),
      s(
        SECTION.musubi,
        `${c.occasion.name}は、こちらが何かをして差し上げる日ではありません。受けていたことに気づかせていただく日です。`,
      ),
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

/** 絞り込んだ候補が空なら、全体に戻す */
const orAll = <T,>(narrowed: Ranked<T>[], all: Ranked<T>[]) => (narrowed.length > 0 ? narrowed : all)

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

/** 真宗大谷派モードでの素材の重みづけ（0で中立、負で後ろへ回す） */
const TRADITION_BONUS: Record<TraditionMode, Record<Tradition, number>> = {
  otani: { shinshu: 8, common: 1, zen: -2 },
  any: { shinshu: 0, common: 0, zen: 0 },
}

function weighTradition<T extends { tradition?: Tradition }>(
  ranked: Ranked<T>[],
  mode: TraditionMode,
): Ranked<T>[] {
  const bonus = TRADITION_BONUS[mode]
  return ranked
    .map((r) => ({ item: r.item, score: r.score + bonus[r.item.tradition ?? 'common'] }))
    .sort((a, b) => b.score - a.score)
}

const onlyShinshu = <T extends { tradition?: Tradition }>(ranked: Ranked<T>[]) =>
  ranked.filter((r) => r.item.tradition === 'shinshu')

/** 真宗モードの結びに添える一句 */
const OTANI_CLOSINGS = [
  '南無阿弥陀仏。',
  'なんまんだぶ、なんまんだぶ。',
  'ようこそのお聴聞でございました。',
]

function mannerFor(scene: Scene, rand: Rand): Manner {
  const fit = MANNERS.filter((m) => !m.scenes || m.scenes.includes(scene.id))
  const pool = fit.length > 0 ? fit : MANNERS
  return pool[Math.floor(rand() * pool.length) % pool.length]
}

export function generateNeta(input: GenerateInput): Neta[] {
  const rand = mulberry32(input.seed ^ hashString(input.text + input.emotions.join(',')))
  const scene = SCENE_BY_ID[input.sceneId] ?? SCENE_BY_ID.howakai
  const mode = input.tradition
  const emotionLabels = input.emotions.map((id) => EMOTION_BY_ID[id]?.label).filter(Boolean)
  const primaryLabel = emotionLabels[0] ?? 'そのざわつき'

  const rankedConcepts = weighTradition(
    rankItems(
      CONCEPTS,
      input.emotions,
      input.text,
      (x) => x.emotions,
      (x) => [x.term, ...(x.keywords ?? [])],
    ),
    mode,
  )
  const rankedStories = weighTradition(
    rankItems(
      STORIES,
      input.emotions,
      input.text,
      (x) => x.emotions,
      (x) => [x.title],
    ),
    mode,
  )
  const rankedWords = weighTradition(
    rankItems(
      WORDS,
      input.emotions,
      input.text,
      (x) => x.emotions,
      (x) => [x.word],
    ),
    mode,
  )
  const rankedModerns = rankItems(
    MODERNS.filter((m) => !(m.avoidScenes ?? []).includes(scene.id)),
    input.emotions,
    input.text,
    (x) => x.emotions,
    (x) => [x.scene, ...(x.keywords ?? [])],
  )
  const rankedPhrases = rankItems(
    PHRASES,
    input.emotions,
    input.text,
    (x) => x.emotions,
    (x) => [x.text, x.source],
  )

  const monthly = OCCASIONS.filter((o) => o.months.includes(input.month))
  const occasionPool = monthly.length > 0 ? monthly : OCCASIONS
  const occasions = weighTradition(
    occasionPool.map((item) => ({ item, score: 0 })),
    mode,
  )

  // 真宗の切り口は真宗モードのときだけ。しかも先に回して、最初の一巡に必ず入るようにする。
  const usable = ANGLES.filter(
    (a) => a.kojitsuke <= input.kojitsukeMax && (mode === 'otani' || a.tradition !== 'shinshu'),
  )
  const angles =
    mode === 'otani'
      ? [
          ...shuffle(
            usable.filter((a) => a.tradition === 'shinshu'),
            rand,
          ),
          ...shuffle(
            usable.filter((a) => a.tradition !== 'shinshu'),
            rand,
          ),
        ]
      : shuffle(usable, rand)

  const usedConcept = new Set<string>()
  const usedStory = new Set<string>()
  const usedWord = new Set<string>()
  const usedModern = new Set<string>()
  const usedOccasion = new Set<string>()
  const usedPhrase = new Set<string>()

  const out: Neta[] = []
  for (let i = 0; i < input.count; i++) {
    const angle: Angle = angles[i % angles.length]
    const shinshuAngle = angle.tradition === 'shinshu'

    // 真宗の切り口には真宗の素材を当てる（足りなければ全体から）
    const conceptPool = shinshuAngle ? orAll(onlyShinshu(rankedConcepts), rankedConcepts) : rankedConcepts
    const wordPool = shinshuAngle ? orAll(onlyShinshu(rankedWords), rankedWords) : rankedWords
    const storyPool = shinshuAngle ? orAll(onlyShinshu(rankedStories), rankedStories) : rankedStories
    const occasionPoolForAngle = shinshuAngle ? orAll(onlyShinshu(occasions), occasions) : occasions

    // 御文・歎異抄の切り口は、その出典の一句だけを引く
    const phrasePool =
      angle.id === 'ofumi'
        ? rankedPhrases.filter((r) => r.item.source.includes('御文'))
        : angle.id === 'tannisho'
          ? rankedPhrases.filter((r) => r.item.source.includes('歎異抄'))
          : rankedPhrases

    const concept = takeUnused(conceptPool, usedConcept, rand, 8)
    // 一句・喩え・日常語は、選んだ教義と同じ気持ちを向いているものから引く（話の筋がずれないように）
    const conceptTags = new Set(concept.emotions)
    const alignTo = <T extends { emotions: readonly EmotionId[] }>(pool: Ranked<T>[]) =>
      pool
        .map((r) => ({
          item: r.item,
          score: r.score + r.item.emotions.filter((e) => conceptTags.has(e)).length * 4,
        }))
        .sort((a, b) => b.score - a.score)

    const ctx: Ctx = {
      emotionLabels,
      primaryLabel,
      userText: input.text,
      modern: takeUnused(rankedModerns, usedModern, rand, 8),
      concept,
      story: takeUnused(alignTo(storyPool), usedStory, rand, 6),
      word: takeUnused(alignTo(wordPool), usedWord, rand, 6),
      occasion: takeUnused(occasionPoolForAngle, usedOccasion, rand, 6),
      phrase: takeUnused(alignTo(orAll(phrasePool, rankedPhrases)), usedPhrase, rand, 4),
      scene,
      mode,
    }

    const built = BUILDERS[angle.id](ctx)
    const manner = mannerFor(scene, rand)
    const meta = [
      ...built.meta,
      `避けたい入り方：「${ctx.concept.term}とは——という意味であります」と解説から始めると、そこで顔が下がります。今日の入口は「${ctx.modern.scene}」です。`,
      ...(mode === 'otani'
        ? [`大谷派の言い回し：「${manner.avoid}」ではなく「${manner.use}」。${manner.why}`]
        : []),
      scene.minutes === 0
        ? `${scene.label}：一行で立ち止まらせる。説明はしない。`
        : `${scene.label}：目安${scene.minutes}分。${scene.note}。`,
    ]

    // 真宗モードでは、結びにお念仏の一句を添える
    const spoken =
      mode === 'otani' && scene.minutes > 0
        ? built.sections.map((sec) =>
            sec.label === SECTION.musubi && !sec.body.includes('あなかしこ')
              ? s(sec.label, `${sec.body}\n\n${OTANI_CLOSINGS[Math.floor(rand() * OTANI_CLOSINGS.length) % OTANI_CLOSINGS.length]}`)
              : sec,
          )
        : built.sections

    const sections =
      scene.minutes === 0 ? condense(built, ctx) : [...spoken, s(SECTION.memo, meta.join('\n'))]

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
    if (built.uses.phrase) {
      sources.push(`一句：${ctx.phrase.source}`)
      if (ctx.phrase.caution) cautions.push(`一句：${ctx.phrase.caution}`)
    }
    if (built.uses.occasion && ctx.occasion.caution) {
      cautions.push(`${ctx.occasion.name}：${ctx.occasion.caution}`)
    }

    const tradition: Tradition = shinshuAngle
      ? 'shinshu'
      : (built.uses.concept ? ctx.concept.tradition : undefined) ?? 'common'

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
        phraseId: built.uses.phrase ? ctx.phrase.id : undefined,
      },
      minutes: scene.minutes,
      tradition,
    })
  }
  return out
}

export type { Concept, Story, Word, Modern, Phrase, Manner, Scene }
