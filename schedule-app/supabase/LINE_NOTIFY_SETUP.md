# LINE通知（翌日の予定・TODOを毎晩お届け）セットアップ手順

毎晩、決まった時刻に「翌日の予定とやること（TODO）」をLINEへ自動送信する機能です。
**クラウド版（ログインあり）専用**です（ローカル版はサーバーが無いため使えません）。

全体の流れ:
LINE公式アカウント作成 → Supabaseにテーブル作成 → 関数をデプロイ → 秘密情報を設定 →
Webhook設定 → 毎晩実行のcron設定 → アプリの「設定」から連携。

所要 30〜40分。用意するもの: LINEアカウント、Supabaseプロジェクト（この repo の接続先）。

---

## 1. LINE公式アカウント（Messaging API）を作る

1. [LINE Developers](https://developers.line.biz/) にログイン → プロバイダーを作成。
2. 「Messaging API」チャネルを新規作成（アイコン・名前は「MY SCHEDULE」等でOK）。
3. 作成後、次の2つを控える:
   - **Channel secret**（「チャネル基本設定」タブ）
   - **Channel access token（長期）**（「Messaging API設定」タブで「発行」）
4. 「Messaging API設定」で:
   - **応答メッセージ: オフ**、**あいさつメッセージ: 任意**、**Webhook: オン** にする。
   - 友だち追加用URL（`https://lin.ee/xxxx`）を控える（アプリの「友だち追加」ボタン用）。

> かつての「LINE Notify」は 2025/3 で終了したため、Messaging API を使います。
> 個人利用なら無料枠（月あたりの無料メッセージ数）で足ります。

## 2. テーブルを作成

Supabase → SQL Editor で `supabase/add_line_links.sql` を実行（cron部分のコメントはまだ触らない）。

## 3. Edge Function をデプロイ

`line-webhook` と `line-notify` の2つ。**どちらも `--no-verify-jwt` 必須**
（LINEやcronはSupabaseのJWTを送らないため。付けないと401で弾かれます）。

```bash
supabase functions deploy line-webhook --no-verify-jwt
supabase functions deploy line-notify  --no-verify-jwt
```

（ダッシュボードからデプロイする場合は、各関数の設定で「Verify JWT」をオフに）

## 4. 秘密情報（Secrets）を設定

Supabase → Edge Functions → Secrets（または `supabase secrets set`）で設定:

| キー | 値 | 使う関数 |
| --- | --- | --- |
| `LINE_CHANNEL_SECRET` | 手順1のChannel secret | line-webhook |
| `LINE_CHANNEL_ACCESS_TOKEN` | 手順1のアクセストークン | line-webhook / line-notify |
| `CRON_SECRET` | 自分で決める長い文字列 | line-notify |

`SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` は自動で入るので設定不要です。

```bash
supabase secrets set LINE_CHANNEL_SECRET=xxxx LINE_CHANNEL_ACCESS_TOKEN=xxxx CRON_SECRET=$(openssl rand -hex 24)
```

## 5. Webhook URL を LINE に設定

LINE Developers → Messaging API設定 → Webhook URL に次を設定して「検証」:

```
https://<PROJECT_REF>.functions.supabase.co/line-webhook
```

`<PROJECT_REF>` は Supabase の Project ref（例: `yshnutsgkoxadwjhhtlp`）。
「Webhookの利用」をオンに。

## 6. 毎晩の自動送信（cron）を設定

Supabase → Database → Extensions で **pg_cron** と **pg_net** を有効化してから、
`supabase/add_line_links.sql` 末尾のコメント（`cron.schedule(...)`）を、
`<PROJECT_REF>` と `<CRON_SECRET>` を置き換えて実行します。

毎正時(UTC)に `line-notify` を叩き、関数側が「いまJSTで各ユーザーの通知時刻か？」を判定して、
その人にだけ送ります（通知時刻はユーザーごとにアプリで変更可）。

## 7. （任意）友だち追加ボタンを出す

Vercel（クラウド版）の環境変数に、手順1で控えた友だち追加URLを設定すると、
アプリの連携画面に「LINEで友だち追加」ボタンが出ます。

```
VITE_LINE_ADD_URL=https://lin.ee/xxxx
```

---

## 使い方（利用者側）

1. アプリ右上の歯車 → **設定** → 「🔔 LINEで翌日のお知らせ」→ **LINE連携をはじめる**。
2. 表示された**合言葉（6桁）**を控える。
3. LINE公式アカウントを**友だち追加**し、トークに合言葉を**そのまま送信**。
4. 「連携できました🌷」が返れば完了。アプリの画面で「更新」を押すと「連携済み」に。
5. 設定画面で **オン/オフ** と **送る時刻** を変更できます。

## 送られる内容

翌日（JST）にかかる **予定** と、未完了の **やること（TODO）** をまとめて1通。
翌日ぶんが何も無い日は送りません。

## トラブル時

- 合言葉を送っても連携されない → Webhook URLの「検証」がOKか、`--no-verify-jwt`でデプロイしたか、`LINE_CHANNEL_SECRET`が正しいか。
- 通知が来ない → cronが登録されているか（`select * from cron.job;`）、`CRON_SECRET`がcronのSQLと関数Secretで一致しているか、対象ユーザーが「連携済み・オン」で、その時刻に翌日ぶんがあるか。
- 動作ログは Supabase → Edge Functions → 各関数の Logs で確認できます。
