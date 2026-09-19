import { SHINSHU_OCCASIONS } from './shinshu/occasions'
import type { Occasion } from './types'

// 季節・行事に寄せる切り口のための素材。
const GENERAL_OCCASIONS: Occasion[] = [
  { id: 'shogatsu', name: '正月・修正会', months: [1], hook: '一年の初めに、めでたさの中身を一枚めくる' },
  { id: 'nehan-e', name: '涅槃会（2月15日）', months: [2], hook: '釈尊が亡くなった日から、別れの受け取り方を考える' },
  { id: 'haru-higan', name: '春彼岸', months: [3], hook: '昼と夜が同じ長さになる日に、かたよりを見直す' },
  { id: 'hanamatsuri', name: '花まつり（4月8日）', months: [4], hook: '誕生の日に、生まれてきたことの意味を問い直す' },
  { id: 'nyugaku', name: '入学・新年度', months: [4], hook: '始まりの季節に、続けることの話をする' },
  { id: 'gotan-e', name: '降誕会（5月・宗祖の誕生日）', months: [5], hook: '生まれた日を祝う行事から、いのちを受け取った側の話をする' },
  { id: 'shinryoku', name: '新緑・田植えの頃', months: [5, 6], hook: '植える季節に、実りを急がない話をする' },
  { id: 'tsuyu', name: '梅雨', months: [6], hook: '嫌がられる雨の側から、日日是好日を語る' },
  { id: 'obon', name: 'お盆・盂蘭盆会', months: [7, 8], hook: '帰ってくる人を迎える行事から、つながりを語る' },
  { id: 'shuubun', name: '秋彼岸', months: [9], hook: '暑さ寒さも彼岸まで。移り変わりを実感として語る' },
  { id: 'jouyou', name: '報恩講・年回法要', months: [10, 11], hook: '受け取ってきたものを数える場として語る' },
  { id: 'joudou-e', name: '成道会（12月8日）', months: [12], hook: '悟りの日から、長く続けることの意味を語る' },
  { id: 'joya', name: '除夜の鐘', months: [12], hook: '百八の煩悩を、減点ではなく持ち物として語る' },
  { id: 'sotsugyou', name: '卒業・送別', months: [2, 3], hook: '別れの季節に、一期一会を実務の言葉として語る' },
]

// 真宗大谷派の素材を先に置く（真宗モードで優先的に当たるようにするため）
export const OCCASIONS: Occasion[] = [...SHINSHU_OCCASIONS, ...GENERAL_OCCASIONS]

export const OCCASION_BY_ID: Record<string, Occasion> = Object.fromEntries(
  OCCASIONS.map((o) => [o.id, o]),
)
