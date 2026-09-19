// 法話ネタの素材となるデータの型。
// 設計の軸: 「入口は一般の人の思考起点、出口が仏教」。
// どの素材も「世間ではこう受け取られている(misread/now/scene)」と
// 「仏教から見るとこうズレる(pivot/gap/point)」の対で持つ。

export type EmotionId = string

export type EmotionGroup = 'くるしみ' | 'ざわつき' | 'しあわせ' | 'ゆらぎ'

export type Emotion = {
  id: EmotionId
  label: string
  group: EmotionGroup
  /** 一般の人が実際に口にする言い方 */
  plain: string
  /** 自由記述から拾うための語 */
  keywords: string[]
}

/** 仏教語・教義 */
export type Concept = {
  id: string
  term: string
  reading: string
  /** 一行で意味（仏教語を使わずに） */
  oneLine: string
  source: string
  /** 一般の人の実感に寄せた言い換え */
  everyday: string
  /** 世間でのありがちな受け取り方（＝話の入口にできる誤解） */
  misread: string
  /** そこからの視座のズラし（＝落差＝話の山） */
  pivot: string
  /** 日常への落とし込み（聴き手が今日できる一歩） */
  step: string
  emotions: EmotionId[]
  keywords?: string[]
  /** 出典や扱いに注意がいる場合のメモ */
  caution?: string
}

/** 経典の喩え・説話・祖師の逸話 */
export type Story = {
  id: string
  title: string
  kind: '経典' | '説話' | '禅' | '祖師' | '近代'
  source: string
  /** そのまま語れる長さの要約 */
  summary: string
  /** この話の使いどころ・落としどころ */
  point: string
  emotions: EmotionId[]
  caution?: string
}

/** 日常語になっている仏教語（入口を広げるための素材） */
export type Word = {
  id: string
  word: string
  reading: string
  /** 仏教でのもとの意味 */
  origin: string
  /** 今の使われ方 */
  now: string
  /** そのズレのどこが話になるか */
  gap: string
  emotions: EmotionId[]
  caution?: string
}

/** 現代の入口（一般の人の思考起点になる場面） */
export type Modern = {
  id: string
  scene: string
  /** そのまま語り出しに使える一文 */
  line: string
  emotions: EmotionId[]
  keywords?: string[]
}

/** 年中行事・節目（季節に寄せる切り口の素材） */
export type Occasion = {
  id: string
  name: string
  months: number[]
  hook: string
}

/** 切り口のテンプレート */
export type AngleKind = 'concept' | 'story' | 'word'

export type Angle = {
  id: string
  name: string
  /** この切り口のねらい */
  aim: string
  /** 組み立てに必要な素材 */
  needs: AngleKind[]
  /** こじつけ度 1=素直 2=ひとひねり 3=こじつけ全開 */
  kojitsuke: 1 | 2 | 3
}

/** 話す場面 */
export type SceneId = 'houji' | 'tsukimairi' | 'sougo' | 'howakai' | 'keijiban' | 'sns'

export type Scene = {
  id: SceneId
  label: string
  note: string
  /** 目安の尺（分）。掲示板・SNSは0 */
  minutes: number
}

export type NetaSection = {
  label: string
  body: string
}

export type Neta = {
  id: string
  angleId: string
  angleName: string
  aim: string
  kojitsuke: 1 | 2 | 3
  title: string
  sections: NetaSection[]
  sources: string[]
  cautions: string[]
  materials: {
    conceptId?: string
    storyId?: string
    wordId?: string
    modernId?: string
    occasionId?: string
  }
  minutes: number
}
