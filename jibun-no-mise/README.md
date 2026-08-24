# じぶんの店 — 開店準備中ページ

`public/index.html` 一枚だけの静的サイト。Cloudflare Workers の静的アセットとして配信する。
ビルド手順はなし。HTML を直接編集すれば内容が変わる。

## 公開する

```bash
cd jibun-no-mise
npx wrangler deploy
```

初回は `jibun-no-mise.<サブドメイン>.workers.dev` が払い出される。
以降も同じコマンドで上書き公開される。

wrangler 本体は `schedule-app/node_modules` のものを使う（このフォルダに
`package.json` は置いていない）。未インストールなら先に `cd ../schedule-app && npm install`。

## 独自ドメインを割り当てる

Cloudflare でドメインを管理している場合は `wrangler.jsonc` に追記する。

```jsonc
"routes": [
  { "pattern": "example.com", "custom_domain": true }
]
```
