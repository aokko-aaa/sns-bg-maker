import type { Story } from '../types'

export const SHINSHU_STORIES: Story[] = [
  {
    id: 'shinran-rokkakudo',
    title: '六角堂の百日',
    kind: '祖師',
    source: '恵信尼消息（親鸞聖人二十九歳の求道）',
    summary:
      '比叡山で二十年勤めた親鸞聖人は、山を下り、六角堂に百日こもられた。九十五日目の暁に夢のお告げを受け、そのまま法然上人のもとへ通い、また百日通われた。二十年の修行の先にあったのは、新しい修行ではなく、一つの教えを聞くことだった。',
    point: '努力の量では出口が開かなかった、という順番で語れる。行き詰まっている人に。',
    emotions: ['mayoi', 'tsukare', 'munashisa', 'jikokeno'],
    tradition: 'shinshu',
  },
  {
    id: 'shinran-echigo',
    title: '越後への流罪',
    kind: '祖師',
    source: '『教行信証』後序（承元の法難）',
    summary:
      '専修念仏は停止され、法然上人は土佐へ、親鸞聖人は越後へ流された。僧の身分を奪われた聖人は、「僧にあらず俗にあらず」と名のり、禿の字をもって姓とされた。都を離れた地で、はじめて田畑を耕す人々と同じ場所に立たれた。',
    point: '不本意な異動・降格・病など、望まぬ場所に置かれた人に。落ちた先で名のりが変わった話。',
    emotions: ['henka', 'mukuwarenai', 'kodoku', 'jikokeno', 'urami'],
    tradition: 'shinshu',
  },
  {
    id: 'tannisho-yuien',
    title: '踊躍歓喜の心が出ません',
    kind: '祖師',
    source: '『歎異抄』第九条',
    summary:
      '唯円が正直に尋ねた。「念仏を申しても、躍り上がるような喜びが湧きません。急いで浄土へ参りたいとも思えません。これはどうしたことでしょう」。親鸞聖人は答えられた。「親鸞もこの不審ありつるに、唯円房おなじこころにてありけり」。そして、喜べないのは煩悩のしわざであり、だからこそ願われているのだと説かれた。',
    point: 'ありがたいと思えない、という相談に。師が同じ位置に降りてきて答える形がそのまま使える。',
    emotions: ['jikokeno', 'munashisa', 'zaiakukan', 'mayoi', 'ochikomi'],
    tradition: 'shinshu',
  },
  {
    id: 'tannisho-jigoku',
    title: '地獄は一定すみかぞかし',
    kind: '祖師',
    source: '『歎異抄』第二条',
    summary:
      '関東から訪ねてきた人々に、親鸞聖人は言われた。念仏が浄土の因か地獄の業か、自分は知らない。たとえ法然上人にだまされて、念仏して地獄に落ちたとしても、後悔はしない。どのみち他の行を励んでも仏になれない身なのだから、地獄はもとより決まったすみかである、と。',
    point: '保証を求める人に。保証がないまま任せる、という姿勢を見せる話。',
    emotions: ['fuan', 'mayoi', 'jikokeno', 'shi'],
    tradition: 'shinshu',
  },
  {
    id: 'eshinni-tegami',
    title: '恵信尼の手紙',
    kind: '祖師',
    source: '恵信尼消息（覚信尼あて）',
    summary:
      '親鸞聖人が高熱で寝込まれたとき、うわ言のように『大無量寿経』を読み続けておられた。やがて目を覚まし、「これはいけない。人のためにと経を読むのは、まだ自力のこころが残っていた」と言って、読むのをやめられた。その一部始終を、妻の恵信尼が娘への手紙に書き残している。',
    point: '善いことをしているつもりの自力を、身近な人が見ていた、という形で語れる。',
    emotions: ['jikokeno', 'kazoku', 'zaiakukan', 'mukuwarenai'],
    tradition: 'shinshu',
  },
  {
    id: 'rennyo-hakkotsu',
    title: '白骨の御文',
    kind: '祖師',
    source: '蓮如上人『御文』五帖目第十六通',
    summary:
      '「朝には紅顔ありて、夕には白骨となれる身なり」。蓮如上人は、若い人が先に亡くなることもあると記し、それでも人は自分だけは今日を越えられると思っていると書かれた。この一通は、今も葬儀の場で読まれ続けている。',
    point: '葬儀・通夜で。脅しではなく、順番が決まっていないという事実として読む。',
    emotions: ['shi', 'wakare', 'fuan', 'kazoku'],
    tradition: 'shinshu',
  },
  {
    id: 'rennyo-ichiryu',
    title: '聖人一流の御文',
    kind: '祖師',
    source: '蓮如上人『御文』五帖目第十通',
    summary:
      '「聖人一流の御勧化のおもむきは、信心をもつて本とせられ候ふ」。蓮如上人は、親鸞聖人の教えの要は信心一つだと繰り返し書き、称える念仏は御恩報謝のためだと記された。最後はいつも「あなかしこ、あなかしこ」で結ばれる。',
    point: '報恩講や法要で、真宗の筋道を一分で示すときに。',
    emotions: ['kansha', 'mayoi', 'yasuragi', 'mukuwarenai'],
    tradition: 'shinshu',
  },
  {
    id: 'kiyozawa-sanbukyo',
    title: '清沢満之の三部経',
    kind: '近代',
    source: '清沢満之（1863–1903）の随筆・日記',
    summary:
      '大谷派の僧である清沢満之は、自分にとっての三部経は『阿含経』とエピクテトスの『語録』と『歎異抄』だと書いた。結核を病み、家族を失い、大学の職も辞した人が、最後に残したのは「天命に安んじて人事を尽くす」という一行だった。',
    point: '近代の人の言葉として、若い人にも届きやすい。病・喪失・挫折の話に。',
    emotions: ['shi', 'wakare', 'tsukare', 'munashisa', 'jikokeno'],
    tradition: 'shinshu',
  },
  {
    id: 'soga-ryojin',
    title: '如来、我となりて',
    kind: '近代',
    source: '曽我量深（1875–1971）の講義に伝わる言葉',
    summary:
      '大谷派の学僧・曽我量深は言った。「如来、我となりて我を救いたまう」。救いは外から降ってくるのではなく、この私の中ではたらいている如来として来る、という受け取りである。',
    point: '「神頼みではないのか」と問われたときの答えとして使える。',
    emotions: ['kodoku', 'fuan', 'jikokeno', 'mayoi'],
    caution: '講録に基づく言葉。文言の異同があるため、引用と断って語る。',
    tradition: 'shinshu',
  },
  {
    id: 'genza',
    title: '因幡の源左',
    kind: '近代',
    source: '妙好人・因幡の源左（1842–1930）の伝承',
    summary:
      '牛を引いて働いた源左は、何を言われても「ようこそ、ようこそ」と受けたという。腹の立つこと、損なことにも「ようこそ」と言う。理屈で納得したのではなく、口から先に出るようになっていた。',
    point: '受け止め方の話に。理屈が先ではなく、身についた言葉が先という順番で。',
    emotions: ['iraira', 'mukuwarenai', 'kansha', 'yasuragi', 'ningenkankei'],
    caution: '妙好人の逸話は伝承として広まったもの。「と伝えられる」と添える。',
    tradition: 'shinshu',
  },
  {
    id: 'saichi',
    title: '浅原才市の口あい',
    kind: '近代',
    source: '妙好人・浅原才市（1850–1932）の口あい（詩）',
    summary:
      '下駄職人の才市は、仕事場のかんな屑に詩を書きつけた。「わしが阿弥陀になるじゃない、阿弥陀のほうからわしになる」。学問のない市井の人の言葉が、そのまま教えの言い当てになっている。',
    point: '難しい話のあとに、生活者の言葉として置くと効く。',
    emotions: ['jikokeno', 'kansha', 'yorokobi', 'kodoku'],
    caution: '才市は石見（本願寺派）の人。宗派をまたいで語られる妙好人として扱う。',
    tradition: 'shinshu',
  },
  {
    id: 'houonko-otorikoshi',
    title: 'お取り越し',
    kind: '説話',
    source: '真宗の年中行事（在家報恩講）',
    summary:
      '本山の御正忌報恩講は十一月二十一日から二十八日。それに先んじて、各寺や各家では秋から冬にかけて報恩講を勤める。これを「お取り越し」と呼ぶ。本番より先に、家々で勤めてしまう行事である。',
    point: '家の年中行事の意味を聞かれたときに。順番が逆に見えることの説明として。',
    emotions: ['kazoku', 'kansha', 'henka'],
    caution: '日程・呼び方は地域と寺によって異なる。自坊の実際に合わせる。',
    tradition: 'shinshu',
  },
  {
    id: 'doubou-undou',
    title: '同朋会運動',
    kind: '近代',
    source: '真宗大谷派・同朋会運動（1962年、蓮如上人四百五十回忌を機に）',
    summary:
      '大谷派は、家に代々伝わるだけの宗教から、一人ひとりが自分の問題として聞く宗教へ、という願いで同朋会運動を始めた。掲げられたのは「家の宗教から個の自覚の宗教へ」。寺が門徒を数える側でいることを、自分から手放そうとした運動である。',
    point: '「うちは代々真宗です」と言われたときに、そこから一歩進める話として。',
    emotions: ['kazoku', 'henka', 'munashisa', 'shounin'],
    tradition: 'shinshu',
  },
]
