import type { Occasion } from '../types'

// 真宗大谷派の年中行事。日程は本山・地域で幅があるので、カード側に注意を出す。
export const SHINSHU_OCCASIONS: Occasion[] = [
  { id: 'shushoe', name: '修正会', months: [1], hook: '一年の初めを、めでたさではなくお礼から始める', tradition: 'shinshu' },
  { id: 'nehan-shinshu', name: '涅槃会', months: [2], hook: '寒い時季の別れの話から、順番の決まっていないいのちへ', tradition: 'shinshu' },
  { id: 'haru-higan-shin', name: '春の彼岸会', months: [3], hook: '彼岸は向こう岸。こちらから渡る話ではないという筋で', tradition: 'shinshu' },
  { id: 'eitaikyo-haru', name: '永代経法要', months: [4, 5], hook: '永代とは、経が永く読まれ続けること。人ではなく法が続く話', tradition: 'shinshu' },
  { id: 'gotan-e-shin', name: '宗祖降誕会', months: [5], hook: '五月二十一日、親鸞聖人のお誕生日から、生まれてきたことの受け取りへ', tradition: 'shinshu' },
  { id: 'urabon-shin', name: '盂蘭盆会', months: [7, 8], hook: '迎え火を焚かない盆の意味を、来られているのは誰かという話へ', tradition: 'shinshu', caution: '盆の作法は地域差が大きい。家の習慣を頭から否定しない。' },
  { id: 'shidokyo', name: '祠堂経・夏のお参り', months: [6], hook: '行事の少ない時季に、ふだんのお内仏のお参りから語る', tradition: 'shinshu', caution: '祠堂経の時期や有無は寺によって異なる。自坊の年中行事に合わせる。' },
  { id: 'aki-higan-shin', name: '秋の彼岸会', months: [9], hook: '暑さ寒さも彼岸まで。移り変わりを実感のまま語る', tradition: 'shinshu' },
  { id: 'otorikoshi', name: 'お取り越し報恩講', months: [10, 11, 12], hook: '本山より先に家で勤める報恩講から、順番の話へ', tradition: 'shinshu', caution: '時期と呼び名は地域・寺で異なる。' },
  { id: 'goshoki', name: '御正忌報恩講', months: [11], hook: '十一月二十一日から二十八日、宗祖の祥月命日のお勤め。供養ではなく報恩だという一点で', tradition: 'shinshu' },
  { id: 'joya-shin', name: '除夜', months: [12], hook: '煩悩を数え上げる夜に、減点ではない受け取りを置く', tradition: 'shinshu' },
]
