# じぶんの店 — 開店準備中ページ

`public/index.html` 一枚だけの静的サイト。Cloudflare Workers の静的アセットとして配信する。
ビルド手順はなし。HTML を直接編集すれば内容が変わる。

## 公開する

```bash
cd jibun-no-mise
./deploy.sh
```

`deploy.sh` は「デプロイ → 数秒待つ → 実際にHTTPで叩いて中身を確認」までを一続きで行う。
罠帖 G-5（pushしただけでは本番は変わらない）と A-1（公開直後は行き渡るまでずれる）への備え。

初回だけ `npm install`（wrangler が入る）。

手で叩くなら:

```bash
npx wrangler deploy
# 5秒ほど待ってから curl で確認する（1回目の404で即断しない）
```

## この構成についての判定メモ

**罠帖 K-1（そもそもCloudflareに載るか）: 問題なし。**

- 常駐して待ち続ける部分 → なし
- 1回が数分かかる重い計算 → なし
- PHP等の既製品をそのまま載せる → なし
- 大きなファイルの同梱（A-5・A-6）→ なし。HTML 1枚 3.4KB、外部リクエストもゼロ

素直に Workers に載る形。Workers 無料プラン（1日10万リクエスト）で十分収まる。

## 独自ドメインを割り当てるとき

Cloudflare でドメインを管理している場合は `wrangler.jsonc` に追記する。

```jsonc
"routes": [
  { "pattern": "example.com", "custom_domain": true }
]
```

**先に確認すること（罠帖 A-2）**: 独自ドメインを付けると `workers.dev` の仮URLは既定で
無効化され、404 になる。仮URLをブックマークや他サービスから叩いている場所があるなら、
設定で仮URLを残す指定を明示しておく。

外すときは設定ファイルから消すだけでは剥がれない。Workers のカスタムドメイン一覧から
削除する（罠帖 A-3）。

**.jp を使いたい場合（罠帖 E-1）**: Cloudflare では .jp / .co.jp を取得できない。
日本のドメイン会社で取得し、DNS だけ Cloudflare に預ける。以後の手順は同じ。

## 困ったときのログ

```bash
npx wrangler tail --format json > tail.log
```

見やすい形式（pretty）をパイプに繋ぐと何も出てこない（罠帖 A-14）。json でファイルに直落としする。

---

罠帖の項目は 2026-08-17 版に基づく。Cloudflare の仕様は変わるので、
適用前に「いまも同じ挙動か」を一度確かめること。
