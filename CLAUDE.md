# MY SCHEDULE — プロジェクト概要（新しいセッションはまずこれを読む）

個人向けの日本語スケジュール管理PWA（モバイル中心・Asia/Tokyo）。
「仕事・家族・自分」をレーンで分けて、予定・TODO・今月の目標・作業時間計測を1つで扱う。

## リポジトリ構成
- `schedule-app/` … フロント（React 18 + TS + Vite + Tailwind + React Router + TanStack Query, PWA）
- `server/` … Cloudflare Worker（Hono）＋ D1。アカウント＋同期版(B)のバックエンド。
  - `server/README.md` … ローカル実行・本番デプロイ手順
  - `server/PHASE2_FRONTEND.md` … フロントの差し替え状況と残作業
- `supabase/` … 旧クラウド版(Supabase)の名残（LINE通知・チャット取り込みの関数/SQL）。新CF版では未使用。
- `index.html` … リポジトリ直下のLP等の作業用（配布LPは `schedule-app/public/lp.html`）

## 3つの動作モード（`schedule-app/src/lib/supabase.ts`）
- **ローカル版A（配布用）**: `VITE_LOCAL_MODE=true`。端末内(localStorage)だけ・ログイン不要。※今も配布中なので壊さない。
- **Cloudflare版B（アカウント＋同期）**: `VITE_BACKEND=cf`。同一オリジンの `/api`（Worker＋D1）を使う。ログインはユーザー名＋パスワード（no-PII, `src/lib/apiClient.ts`）。
- （旧）Supabase版: フラグ無し。移行により実質引退。

## 現在の状況（重要）
- Supabase版をやめ、**全部Cloudflareに移行中**。
- バックエンド（server/）とフロントのCF対応（Phase 2）は**実装・ローカル検証まで完了**。
- 作業ブランチ: **`claude/new-session-mp2fhe`**（既存アプリを壊さないよう、ここで開発）。
- **デプロイは未完**。Cloudflare Workerとして公開予定（名前 `my-schedule`、`my-schedule.aokoworks.workers.dev`）。
  - Cloudflare Account ID: `45a03aa4b13669fe4c63034df0ee674c`
  - APIトークンは作業環境の「ネットワークシークレット(api.cloudflare.com, Bearer)」に登録済み → 新セッションから `wrangler` が使える（`CLOUDFLARE_API_TOKEN` にダミー値、`CLOUDFLARE_ACCOUNT_ID` を設定して実行）。
  - デプロイ手順は `server/README.md` 参照（D1作成→migrations→secrets(SESSION_SECRET/VAPID)→`VITE_BACKEND=cf` でフロントbuild→`wrangler deploy`）。
  - 通知はLINEをやめ **Web Push（iOS通知）**。VAPID鍵の生成＋実機確認が残タスク。

## 開発のお作法
- 開発は上記ブランチで。`schedule-app` は `npm install && npm run build` でビルド確認。`server` は `npm install && npx tsc --noEmit`、`npx wrangler dev --local` で動作確認。
- コミットは説明的に。pushはブランチへ（live配布に影響する `main` へのffは慎重に）。
- **ローカル版A（配布中）を壊さないこと。** CF対応は `VITE_BACKEND=cf` の分岐で入れており、既定ビルドは従来どおり。

## 変更を頼むとき（ユーザー向けメモ）
新しいチャットで「MY SCHEDULE（sns-bg-maker）の〇〇を直して。ブランチ claude/new-session-mp2fhe」と言えばOK。このファイルを読んで続きから進めます。
