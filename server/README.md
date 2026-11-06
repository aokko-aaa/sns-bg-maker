# MY SCHEDULE – Cloudflare バックエンド（アカウント＋同期版 = B）

Supabaseをやめ、**Cloudflare Worker ＋ D1（SQLite）**で動かすための土台です。
- ログイン：**no-PII**（氏名・メールは取らない）。自分で決めたユーザー名＋パスワード（ハッシュ化）だけ。
- データはすべて `user_id` で分離。
- リマインドは **Web Push（iOS通知）**。毎時:40のCronで「JSTで各自の通知時刻か？」を判定し、翌日ぶんを送信。
- 画面（Viteのビルド成果物 `schedule-app/dist`）も同じWorkerから配信。

> 既存のVercel/ローカル版（`schedule-app`）はそのまま。これは新規の別物です。

## 構成
- `src/index.ts` … Hono アプリ（`/api/*`）＋ SPA配信 ＋ Cron（リマインド）
- `src/auth.ts` … パスワード(PBKDF2)・セッション(署名Cookie)・認証ミドルウェア
- `src/routes/*` … auth / categories / entries / time-logs / goals / inbox / push
- `src/webpush.ts` … Web Push送信（VAPID + aes128gcm）※実機疎通は未検証（下記）
- `migrations/0001_init.sql` … D1スキーマ

## ローカルで動かす
```bash
cd server
npm install
npx wrangler d1 migrations apply my-schedule --local
npx wrangler dev --local
# → http://127.0.0.1:8787  （/api/health で疎通確認）
```
※ このリポジトリで動作確認済み：登録→ログイン→カテゴリ/予定のCRUD→期間取得→未ログイン401。

## 本番デプロイ（トークンが要るのはここだけ）
```bash
# 1) D1を作成し、出力された database_id を wrangler.toml に記入
npx wrangler d1 create my-schedule
# 2) スキーマ適用
npx wrangler d1 migrations apply my-schedule --remote
# 3) 秘密情報を登録
npx wrangler secret put SESSION_SECRET        # 例: openssl rand -hex 32
npx wrangler secret put VAPID_PUBLIC_KEY       # 下の鍵生成を参照
npx wrangler secret put VAPID_PRIVATE_KEY
npx wrangler secret put VAPID_SUBJECT          # 例: mailto:you@example.com
# 4) フロントをビルドしてから（assetsが ../schedule-app/dist を配信）
(cd ../schedule-app && npm run build)
# 5) デプロイ
npx wrangler deploy
```
`wrangler login`（ブラウザ承認）でも、APIトークンでも可。

### VAPID鍵の作り方（Web Push用）
`web-push` CLI などで P-256 鍵ペアを作り、base64url の public/private を上の2つに設定します。
（Phase 2でこの鍵を使い、実機iPhoneで1通送って疎通確認します）

## まだ残っている作業（Phase 2以降）
- [ ] フロント（`schedule-app`）のデータ層を Supabase → この `/api` に差し替え（Phase 2）
- [ ] iOSのWeb Push実機確認（`webpush.ts` の暗号処理の最終検証）＋通知許可UI
- [ ] 配布用「ローカル版A（端末内＋パスコード施錠）」の仕上げ
- [ ] （任意）AI解釈 `parse-inbox` 相当・チャット取り込みの移植

## APIの概要
- 認証: `POST /api/auth/register|login|logout`, `GET /api/auth/me`
- カテゴリ: `GET/POST /api/categories`, `DELETE /api/categories/:id?reassignTo=`
- 予定/TODO: `GET /api/entries?start=&end=`, `POST`, `PUT/PATCH/DELETE /:id`, `POST /api/entries/bulk`, `GET /api/entries/overdue-tasks?before=`
- 計測: `GET /api/time-logs/running`, `GET /api/time-logs?start=&end=`, `POST /start`, `POST /:id/stop`
- 目標: `GET/PUT /api/goals/:month`
- 受信箱: `GET/POST /api/inbox`, `PATCH/DELETE /:id`
- 通知: `GET /api/push/public-key`, `POST /api/push/subscribe`, `GET/PUT /api/push/prefs`
