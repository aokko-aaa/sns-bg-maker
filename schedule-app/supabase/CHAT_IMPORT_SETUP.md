# チャットから予定を自動登録（Claude連携）セットアップ

Claudeとのチャットに投げた予定を、そのままクラウド版のカレンダーに登録する機能です。
**クラウド版（ログインあり）専用**。

## 一度だけの準備

1. **テーブル作成**: Supabase → SQL Editor で `supabase/add_chat_import.sql` を実行。
2. **関数デプロイ**（JWT検証オフが必須。トークンで本人を判定するため）:
   ```bash
   supabase functions deploy import-entries --no-verify-jwt
   ```
   （ダッシュボードからなら「Verify JWT」をオフに）
   - Secretの追加設定は不要（`SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` は自動）。
3. **トークン発行**: アプリ右上の歯車 → 設定 → 「💬 チャットから登録」→「トークンを発行」。
4. 「**📋 Claudeに伝える文をコピー**」で、API URL とトークンをコピーして **Claudeに貼る**。

以降は、チャットに「10/5 19時 打ち上げ」のように投げると、Claudeがその予定を
登録APIに送り、アプリを開くと入っています。

## 仕様

- `POST https://<PROJECT_REF>.functions.supabase.co/import-entries`
- ヘッダー: `x-import-token: <トークン>`、`content-type: application/json`
- ボディ:
  ```json
  {
    "events": [
      { "title": "打ち上げ", "starts_at": "2026-10-05T19:00:00+09:00" },
      { "title": "リアルセミナー", "starts_at": "2026-10-06T14:00:00+09:00", "ends_at": "2026-10-06T15:00:00+09:00" },
      { "title": "資源ごみ", "starts_at": "2026-10-07T00:00:00+09:00", "all_day": true, "kind": "task" }
    ]
  }
  ```
  - `ends_at` 省略時: 時刻ありは+1時間、`all_day`は翌0:00。
  - `kind` は `event`（既定）/`task`。1回につき最大100件。

## 安全性

- トークンは「予定の書き込みができる合言葉」です。SNS等に貼らないでください。
- 漏れたと思ったら、設定画面の「トークンを作り直す」で無効化＋再発行できます。
- 「この連携を有効にする」をオフにすると、外部からの登録を一時停止できます。
