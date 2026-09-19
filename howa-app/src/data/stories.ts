import type { Story } from './types'

// 語りの「山」に使う喩え話・逸話。summary はそのまま声に出せる長さにしている。
export const STORIES: Story[] = [
  {
    id: 'devadatta',
    title: '提婆達多の嫉妬',
    kind: '経典',
    source: '律蔵・諸経に伝わる提婆達多の物語',
    summary:
      '釈尊のいとこである提婆達多は、教団の中で人一倍修行し、神通力まで得た。それでも人々は釈尊を慕う。やがて彼は教団を割ろうとし、釈尊の命を狙うまでになった。持っていたものが足りなかったのではなく、比べる相手がすぐそばにいた。',
    point: '嫉妬は遠い相手には起きない。近い人、似た立場の人にだけ起きるという指摘に使える。',
    emotions: ['shitto', 'hikaku', 'shounin', 'urami'],
  },
  {
    id: 'kanbutsu-ushi',
    title: '牛飼いの数え歌',
    kind: '経典',
    source: '『法句経』19（牧牛者の喩え）',
    summary:
      '人の牛をいくら正確に数えても、その牛は一頭も自分のものにはならない。教えをいくら暗んじても、そのとおりに歩かなければ同じことだと説かれる。',
    point: '人の暮らしぶりを数えて過ごした時間を、そのまま自分の持ち分の話に折り返せる。',
    emotions: ['hikaku', 'shitto', 'munashisa', 'shounin'],
  },
  {
    id: 'dokuya',
    title: '毒矢のたとえ',
    kind: '経典',
    source: '『箭喩経』（中部63 マールンキャプッタ経）',
    summary:
      '毒矢に射られた人がいる。ところが本人は「誰が射たのか、弓の材質は何か、矢羽根は何の鳥か。それがわかるまで抜かせない」と言う。釈尊は言われた。その人は、答えが出る前に死んでしまうだろう、と。',
    point: '理由がすべて解けてからでないと動けない人に。まず矢を抜く、という順番の話。',
    emotions: ['mayoi', 'fuan', 'koukai', 'ochikomi'],
  },
  {
    id: 'kisagotami',
    title: 'キサーゴータミーと芥子の実',
    kind: '経典',
    source: '『法句経』註釈（ダンマパダ・アッタカター）',
    summary:
      '幼子を亡くした母が、遺体を抱いて釈尊に「生き返らせてください」と願った。釈尊は「まだ一人も死者を出していない家から、芥子の実をもらってきなさい」と言われた。母は家々を回り、どの家にも亡き人がいることを知って、我が子を弔った。',
    point: '説得ではなく、自分の足で気づかせる。悲しみを取り上げず、分かち合いに変える話。',
    emotions: ['wakare', 'shi', 'kodoku', 'zaiakukan'],
  },
  {
    id: 'mouki-fuboku',
    title: '盲亀浮木',
    kind: '経典',
    source: '『雑阿含経』ほか',
    summary:
      '大海の底に、目の見えない亀がいる。百年に一度だけ浮かび上がる。海面には穴のあいた流木が一本、波に漂っている。その亀が浮いたとき、たまたま流木の穴に首が入る。人として生まれ、教えに出会うのは、それほどのことだと説かれる。',
    point: '「ありがとう＝有り難し」の出どころ。当たり前のほうが異常事態だと気づかせる。',
    emotions: ['kansha', 'yorokobi', 'munashisa', 'yasuragi'],
  },
  {
    id: 'ikada',
    title: '筏のたとえ',
    kind: '経典',
    source: '『蛇喩経』（中部22）',
    summary:
      '向こう岸へ渡るために筏を組んだ人がいる。渡り終えたあと、「この筏のおかげで助かった」と頭に載せて歩き続けたらどうだろう。釈尊は、教えさえも渡るための筏であり、担ぎ続けるものではないと説かれた。',
    point: '役に立った考え方や肩書きを、いつまでも背負っていないか。手放しの話に。',
    emotions: ['henka', 'tsukare', 'koukai', 'mukuwarenai'],
  },
  {
    id: 'koto-no-ito',
    title: '琴の弦（ソーナ尊者）',
    kind: '経典',
    source: '『増支部』（ソーナ経）',
    summary:
      '修行に励みすぎて足から血を流していたソーナに、釈尊が尋ねた。「琴の弦を張りすぎたらどうなるか」「切れます」「ゆるめすぎたら」「鳴りません」。ちょうどよく張ったときにだけ、音が出る。修行もそれと同じだと説かれた。',
    point: '頑張りすぎの人に、根性ではなく調律という言葉を渡す。',
    emotions: ['tsukare', 'aseri', 'isogashii', 'jikokeno'],
  },
  {
    id: 'shio-no-katamari',
    title: '塩のかたまり',
    kind: '経典',
    source: '『増支部』（塩の塊の経）',
    summary:
      '同じひとつまみの塩でも、コップの水に入れれば飲めなくなり、大きな川に入れれば味は変わらない。同じ出来事が、人によって致命傷にも、かすり傷にもなる。違うのは塩の量ではなく、受ける水のほうだと説かれる。',
    point: '出来事を変えられないときに、器の話へ持っていける喩え。',
    emotions: ['iraira', 'ochikomi', 'ningenkankei', 'tsukare'],
  },
  {
    id: 'shigetsu',
    title: '指と月',
    kind: '経典',
    source: '『楞伽経』ほか（指月の喩え）',
    summary:
      '月を指させば、人は指の先を見る。指の長さや形を論じ、月を見ない。言葉は月を指す指であって、月そのものではない、と説かれる。',
    point: '言葉尻や作法の議論に落ちたときの軌道修正に。',
    emotions: ['ningenkankei', 'mayoi', 'shounin'],
  },
  {
    id: 'angulimala',
    title: 'アングリマーラ',
    kind: '経典',
    source: '『中部』86 アングリマーラ経',
    summary:
      '人を殺めては指を数えていた男が、釈尊を追いかけた。走っても追いつけない。「止まれ」と叫ぶと、釈尊は「私はとうに止まっている。止まっていないのはお前だ」と答えた。男はそこで出家し、のちに石を投げられながら托鉢して歩いた。',
    point: '過去が消えるという話ではない。受けながら生きる姿を語れる。',
    emotions: ['zaiakukan', 'koukai', 'jikokeno', 'urami'],
  },
  {
    id: 'hinja-ittou',
    title: '貧者の一灯',
    kind: '経典',
    source: '『賢愚経』『阿闍世王授決経』ほか',
    summary:
      '王が万灯を供えた夜、貧しい女が髪を売って一灯を捧げた。夜半、風が吹いて王の灯は次々と消えたが、その一灯だけは朝まで消えなかった。',
    point: '額ではなく、何を削って差し出したか。布施の話に。',
    emotions: ['okane', 'mukuwarenai', 'kansha', 'munashisa'],
  },
  {
    id: 'chunda',
    title: '鍛冶屋チュンダの供養',
    kind: '経典',
    source: '『大般涅槃経』（南伝ほか）',
    summary:
      '釈尊は、鍛冶屋チュンダの供養した食事のあと重い病になり、まもなく亡くなった。そのとき釈尊は、「成道の前の供養と、この最後の供養は、等しく大きな功徳がある」と言い残し、チュンダが責められないよう手を打たれた。',
    point: '「自分のせいだ」と抱えている人に。最期の配慮としての言葉。',
    emotions: ['zaiakukan', 'wakare', 'koukai', 'kazoku'],
  },
  {
    id: 'zenchishiki',
    title: '善き友は、道のすべて',
    kind: '経典',
    source: '『相応部』（アーナンダとの対話）',
    summary:
      'アーナンダが「善き友を持つことは、道の半ばを成し遂げたようなものですね」と言うと、釈尊は「そうではない。善き友を持つことは、道のすべてである」と答えられた。',
    point: '孤独や人間関係の話を、責任論から環境の話へ移せる。',
    emotions: ['kodoku', 'ningenkankei', 'jikokeno', 'kansha'],
  },
  {
    id: 'daruma-butei',
    title: '達磨と武帝',
    kind: '禅',
    source: '『碧巌録』第一則',
    summary:
      '寺を建て僧を養った梁の武帝が、達磨に問う。「どれほどの功徳があるか」。達磨は「無功徳」。「では、目の前にいるあなたは誰か」と問えば「不識（知らぬ）」。話はそこで終わり、達磨は国を去った。',
    point: '数えた善は取引になる。承認や見返りの話に。',
    emotions: ['mukuwarenai', 'shounin', 'munashisa'],
  },
  {
    id: 'eka-anjin',
    title: '慧可の安心',
    kind: '禅',
    source: '『無門関』第四十一則ほか',
    summary:
      '慧可が達磨に願った。「私の心は不安です。どうか安らかにしてください」。達磨は「その心を、ここへ出してみよ」。慧可は「探しましたが、見つかりません」。達磨は「もう安らかにしておいた」と答えた。',
    point: '不安を実体として扱っているうちは終わらない、という転換に。',
    emotions: ['fuan', 'ochikomi', 'mayoi', 'kodoku'],
  },
  {
    id: 'joshu-kissako',
    title: '趙州のお茶',
    kind: '禅',
    source: '『五灯会元』ほか（喫茶去）',
    summary:
      '趙州は、初めて来た僧にも「お茶でも飲んでいきなさい」、前にも来たことのある僧にも「お茶でも飲んでいきなさい」と言った。院主が「なぜどちらにも同じことを」と尋ねると、趙州は院主にも「お茶でも飲んでいきなさい」と言った。',
    point: '相手によって態度を変えない、という一点で笑いも取れる。',
    emotions: ['ningenkankei', 'isogashii', 'kodoku'],
  },
  {
    id: 'hyakujo-ichijitsu',
    title: '一日作さざれば一日食らわず',
    kind: '禅',
    source: '百丈懐海の逸話',
    summary:
      '高齢の百丈が畑仕事をやめないので、弟子たちが農具を隠した。百丈はその日、食事をとらなかった。「一日作さざれば一日食らわず」。',
    point: '働くことと食べることのつながり。定年・介護・役割喪失の話にも。',
    emotions: ['henka', 'munashisa', 'mukuwarenai', 'tsukare'],
  },
  {
    id: 'kyogen-gekichiku',
    title: '香厳、竹に当たる音で',
    kind: '禅',
    source: '『無門関』第五則ほか（香厳撃竹）',
    summary:
      '学問では誰にも負けなかった香厳が、師の一問に答えられず、書物をすべて焼いて山に入った。ある日、掃除をしていて飛んだ小石が竹に当たった。その音で、すべてが落ちた。',
    point: '答えは机の上ではなく、日常の作業の途中で来る。',
    emotions: ['mayoi', 'ochikomi', 'tassei', 'isogashii'],
  },
  {
    id: 'jugyuzu',
    title: '十牛図の最後',
    kind: '禅',
    source: '廓庵『十牛図』',
    summary:
      '牛を探し、見つけ、連れ帰り、やがて牛も自分も消える。ところが図はそこで終わらない。最後の一枚で、その人は袋をさげて町へ出て、誰かと笑っている。',
    point: '悟りのゴールが山ではなく町だという意外性。日常回帰の締めに。',
    emotions: ['munashisa', 'yasuragi', 'henka', 'tassei'],
  },
  {
    id: 'seigen-sanzan',
    title: '山は山',
    kind: '禅',
    source: '青原惟信の語（『続伝灯録』）',
    summary:
      '修行の前は、山は山、水は水に見えた。修行に入ると、山は山ではなく、水は水ではなくなった。そして今、やはり山は山、水は水である。同じ言葉が、三度とも違う意味を持つ。',
    point: '同じ日常が違って見える、という構造を短く示せる。',
    emotions: ['henka', 'yasuragi', 'mayoi', 'jikokeno'],
  },
  {
    id: 'ryokan-sainan',
    title: '良寛の手紙',
    kind: '近代',
    source: '良寛から山田杜皐への手紙（三条地震・1828年）',
    summary:
      '大地震のあと、見舞いの手紙に良寛はこう書いた。「災難に逢う時節には災難に逢うがよく候、死ぬ時節には死ぬがよく候。これはこれ災難をのがるる妙法にて候」。',
    point: '慰めの言葉が尽きた場面で。逃げ道を示さないことが、かえって支えになる。',
    emotions: ['wakare', 'shi', 'fuan', 'ochikomi'],
  },
  {
    id: 'ryokan-tsuki',
    title: '盗人に取り残されし窓の月',
    kind: '近代',
    source: '良寛の句と伝わる逸話',
    summary:
      '庵に入った盗人が、持ち去るものを何も見つけられず出ていった。良寛の句に「盗人に取り残されし窓の月」とある。',
    point: '失った話のあとに、残っているものへ視線を動かす一句として。',
    emotions: ['okane', 'munashisa', 'yasuragi', 'wakare'],
    caution: '逸話としての伝承が強い。句の位置づけは断定を避けて語る。',
  },
  {
    id: 'ikkyu-kadomatsu',
    title: '一休の門松',
    kind: '近代',
    source: '一休宗純作と伝わる狂歌',
    summary:
      '「門松は冥土の旅の一里塚 めでたくもあり めでたくもなし」。正月に浮かれる町で、一休は杖の先に髑髏をつけて歩いたとも伝えられる。',
    point: '正月・節目の法話で、めでたさを否定せずに一枚めくる。',
    emotions: ['hajimari', 'shi', 'henka', 'yorokobi'],
    caution: '伝承の要素が大きい。「と伝えられる」と添えて語る。',
  },
  {
    id: 'mokuren-urabon',
    title: '目連と盂蘭盆',
    kind: '経典',
    source: '『盂蘭盆経』',
    summary:
      '神通力を得た目連が亡き母を探すと、餓鬼の世界で飢えていた。差し出した食べ物は口に入る前に炎になる。釈尊は「一人で救おうとするな。修行を終えた僧たちに供養しなさい」と教えた。そこからお盆が始まったとされる。',
    point: 'お盆の法話に。「一人で背負わない」という筋で介護・看取りにもつながる。',
    emotions: ['kazoku', 'wakare', 'zaiakukan', 'shi'],
  },
  {
    id: 'gunmou-zou',
    title: '象をなでる',
    kind: '経典',
    source: '『涅槃経』ほかの喩え',
    summary:
      '目の見えない人たちが象にふれ、鼻にふれた者は「蛇のようだ」、耳にふれた者は「扇だ」、足にふれた者は「柱だ」と言い合う。誰も嘘はついていない。全員が正しくて、全員が足りない。',
    point: '意見の対立を、正誤ではなく部分の話に変える。',
    emotions: ['ningenkankei', 'iraira', 'mayoi', 'hikaku'],
    caution: '古い喩え。目の不自由な人を笑う話にならないよう「全員が正しい」側で語る。',
  },
  {
    id: 'hakuin-souka',
    title: '白隠「そうか」',
    kind: '近代',
    source: '白隠にまつわる逸話',
    summary:
      '近所の娘が身ごもり、父親は白隠だと言われた。白隠は「そうか」と言って赤子を引き取り、育てた。のちに真実が明らかになり、娘の家が詫びに来た。白隠はまた「そうか」と言って、赤子を返した。',
    point: '弁明しない強さ。誤解や悪評に苦しむ人への話に。',
    emotions: ['urami', 'zaiakukan', 'shounin', 'ningenkankei'],
    caution: '出典のはっきりしない逸話として広まっている。伝承と断って語る。',
  },
  {
    id: 'ashoka-doro',
    title: '土の餅を捧げた子',
    kind: '説話',
    source: '『阿育王伝』ほか',
    summary:
      '道で遊んでいた子どもが、托鉢の釈尊に差し上げるものがなく、砂で作った餅を捧げた。その子がのちのアショーカ王だと伝えられる。',
    point: '子どもの供養、形の整わない布施を肯定する話に。',
    emotions: ['kazoku', 'okane', 'kansha', 'hajimari'],
  },
]

export const STORY_BY_ID: Record<string, Story> = Object.fromEntries(
  STORIES.map((s) => [s.id, s]),
)
