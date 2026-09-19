import type { Angle, Scene } from './types'

// 切り口＝同じ感情から、別の入り方を何通りも出すためのテンプレート。
// kojitsuke: 1=素直に教義へ 2=ひとひねり 3=こじつけ全開（笑いを取りにいく）
export const ANGLES: Angle[] = [
  { id: 'ura', name: '裏返し', aim: 'その感情の裏にある願いを言い当ててから、教えに渡す', needs: ['concept'], kojitsuke: 1 },
  { id: 'gogen', name: '語源ひらき', aim: '毎日使っている日常語が仏教語だった、という驚きから入る', needs: ['word'], kojitsuke: 1 },
  { id: 'kazoeru', name: '数え直し', aim: 'ひとかたまりの悩みを、仏教の分類で分けて軽くする', needs: ['concept'], kojitsuke: 1 },
  { id: 'tatoe-swap', name: 'たとえ差し替え', aim: '古い喩え話を、現代の場面に置き換えて語る', needs: ['story'], kojitsuke: 2 },
  { id: 'toi', name: '問いから入る', aim: '答えを言わず、聴き手に考えさせる一問から始める', needs: ['concept'], kojitsuke: 1 },
  { id: 'ichigyo', name: '一行から入る', aim: '経典の一句を先に置き、その意味を日常でほどく', needs: ['concept'], kojitsuke: 1 },
  { id: 'shippai', name: '自分の失敗から', aim: '語り手自身の話から入り、上からの説教にしない', needs: ['concept'], kojitsuke: 2 },
  { id: 'gyakusetsu', name: '逆説', aim: '「やらないほうがうまくいく」と言い切って、耳を起こす', needs: ['concept'], kojitsuke: 2 },
  { id: 'hanten', name: '視座の反転', aim: '世間の見方と仏の見方を並べ、落差そのものを見せる', needs: ['concept', 'story'], kojitsuke: 1 },
  { id: 'gyoji', name: '行事に寄せる', aim: '季節や法要の由来から入り、今の気持ちにつなげる', needs: ['concept'], kojitsuke: 2 },
  { id: 'itsuwa', name: '逸話まるごと', aim: '説話を最後まで語り、解説は最小限にする', needs: ['story'], kojitsuke: 1 },
  { id: 'kojitsuke', name: 'こじつけ全開', aim: '語呂や見立てで強引につなぎ、笑ってもらってから本題に入る', needs: ['word', 'concept'], kojitsuke: 3 },
]

export const ANGLE_BY_ID: Record<string, Angle> = Object.fromEntries(
  ANGLES.map((a) => [a.id, a]),
)

export const SCENES: Scene[] = [
  { id: 'houji', label: '法事・年回法要', note: '故人を軸に、遺族へ向けて', minutes: 5 },
  { id: 'tsukimairi', label: '月参り・お内仏の前', note: '一対一、立ち話に近い距離で', minutes: 3 },
  { id: 'sougo', label: '通夜・葬儀のあと', note: '悲しみの最中。教えを急がない', minutes: 5 },
  { id: 'howakai', label: '法話会・寺の集まり', note: 'ある程度の尺で構成して語る', minutes: 10 },
  { id: 'keijiban', label: '掲示板のことば', note: '一行で立ち止まらせる', minutes: 0 },
  { id: 'sns', label: 'SNS・寺報の一言', note: '短く、読み物として', minutes: 0 },
]

export const SCENE_BY_ID: Record<string, Scene> = Object.fromEntries(
  SCENES.map((s) => [s.id, s]),
)
