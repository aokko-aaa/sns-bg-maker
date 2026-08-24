# スケジュール管理アプリ

仕事・家族・個人の予定を1つで横断管理する個人用スケジュールアプリ。
要件定義は親フォルダの要件定義書を参照。

## 現在の到達点: Phase 0（土台）

- Vite + React 18 + TypeScript + Tailwind CSS
- React Router（下部タブで 日 / 週 / 月 / 受信箱 を切替）
- TanStack Query セットアップ
- Supabase クライアント（`src/lib/supabase.ts`、anon key のみ使用）
- PWA 化（`vite-plugin-pwa` / manifest / service worker / アイコン一式）
- モバイルファーストのシェル（下部ナビ・44pxタップ領域・セーフエリア対応）
- group_key（仕事/家族/個人）フィルタの状態をアプリ全体で共有

各ビューの中身はプレースホルダ。実装は後続フェーズ（下記）で差し替える。

## セットアップ

```bash
npm install
cp .env.example .env   # VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY を記入
npm run dev
```

`.env` を設定しなくても起動はします（画面に「Supabase 未設定」と表示）。

### PWA の実機確認（Phase 0 のゴール）

```bash
npm run build && npm run preview
```

スマホの Safari / Chrome で preview の URL を開き、「ホーム画面に追加」→
アイコンから起動できることを確認する。

## セキュリティ上の約束

- **Anthropic API キーはフロントに置かない**（設計原則 2-3）。
  `VITE_` 変数はブラウザにバンドルされる。API 呼び出しは Supabase Edge Function
  経由で行い、キーは `supabase secrets set ANTHROPIC_API_KEY=...` で設定する。
- 全テーブルに RLS を設定し `user_id = auth.uid()` のみ許可（`supabase/schema.sql`）。

## スクリプト

| コマンド | 内容 |
|---|---|
| `npm run dev` | 開発サーバ |
| `npm run build` | 型チェック + 本番ビルド（PWA生成込み） |
| `npm run preview` | ビルド成果物のプレビュー |
| `npm run typecheck` | 型チェックのみ |
| `node scripts/gen-icons.mjs` | PWA アイコン再生成（依存なし） |
| `npm run cf:whoami` | Cloudflare の認証状態を確認 |
| `npm run cf:login` | Cloudflare に OAuth ログイン（ブラウザが開けるローカル環境のみ） |
| `npm run cf:dev` | ビルド済み `dist` を Workers ランタイムでローカル配信 |
| `npm run cf:deploy` | ビルド + Cloudflare Workers へデプロイ |

## Cloudflare へのデプロイ

静的アセット配信の Workers（`wrangler.jsonc`）として配信する。SPA なので
存在しないパスは `index.html` にフォールバックする設定にしてある。

### 1. 認証

**ローカル PC（ブラウザが開ける環境）**

```bash
npm run cf:login    # wrangler login。ブラウザで OAuth 承認
npm run cf:whoami   # アカウントが表示されれば成功
```

**CI / リモートコンテナ（ブラウザが開けない環境）**

`wrangler login` は localhost へのコールバックを待つため使えない。
API トークンを環境変数で渡す。

1. https://dash.cloudflare.com/profile/api-tokens → **Create Token**
2. テンプレート **Edit Cloudflare Workers** を選択（必要な権限が揃う）
3. 発行されたトークンを環境変数に設定する

```bash
export CLOUDFLARE_API_TOKEN=<発行したトークン>
export CLOUDFLARE_ACCOUNT_ID=<アカウントID>   # 複数アカウント所属時のみ必須
npx wrangler whoami
```

トークンはリポジトリにコミットしない（`.env*` は `.gitignore` 済み）。
GitHub Actions で使う場合は Repository secrets に登録する。

### 2. デプロイ

```bash
npm run cf:deploy
```

初回はワーカー名 `schedule-app` で `*.workers.dev` のサブドメインが払い出される。
独自ドメインを使う場合は `wrangler.jsonc` に `routes` を追加する。

### 3. 環境変数について

`VITE_` 変数はビルド時にバンドルへ埋め込まれるため、Cloudflare 側ではなく
**ビルドを実行する環境の `.env`** に設定しておく必要がある。
ローカルの `.env` を残したまま本番ビルドすると、その値が焼き込まれる点に注意。

### つまずきどころ

- **push しただけでは本番は変わらない**。Vercel と違い、Workers は `wrangler deploy`
  を叩いたときにだけ更新される。push → build → deploy → 疎通確認 を一続きにする
- **デプロイ直後の1回目で判定しない**。世界中の配達拠点に行き渡るまで数秒〜十数秒の
  ずれがある。404 が出ても数秒待って再確認する
- **認証が切れたら `wrangler login` を人手で**。ブラウザ承認が要るので、対話のない
  環境（CI・リモートコンテナ）では API トークン方式に切り替える
- **ログは `wrangler tail --format json > tail.log`** で。見やすい形式をパイプに繋ぐと
  溜め込まれて何も出てこない

## 実装フェーズ

- **Phase 0** ✅ 土台（このコミット）
- Phase 1: データ基盤 + デイリービュー（`supabase/schema.sql` 適用、CRUD）
- Phase 2: マンスリービュー
- Phase 3: 受信箱（テキスト）+ Edge Function
- Phase 4: 音声入力（Web Speech API）
- Phase 5: ウィークリーガント（自前描画・ドラッグ）
