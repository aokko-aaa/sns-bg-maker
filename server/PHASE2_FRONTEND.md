# Phase 2: フロントのデータ層を Supabase → Cloudflare `/api` へ差し替え

Phase 1でバックエンド（`server/`）とフロント用クライアント（`schedule-app/src/lib/apiClient.ts`）、
iOS通知の購読ヘルパ（`webpushClient.ts`）まで用意済み。ここではフロントの各フックを差し替える。

> 原則: **ローカル版A（端末内だけ）はそのまま温存**する。
> `supabase.ts` の分岐を「ローカル(A) / API(B=Cloudflare)」に組み替えるのが安全。
> 既存の `localClient.ts`（localStorageシム）はA用として残す。

## 進め方（おすすめ順）
1. **動作モードの判定**（`src/lib/supabase.ts` 相当を整理）
   - A（配布・端末内）: 今まで通り `localClient`。
   - B（Cloudflare・同期）: `apiClient` を使う。
   - 判定: ビルド時フラグ `VITE_BACKEND=cf` などで切替。Workerが配信するB版では常にAPI。

2. **認証（`useAuth.tsx`）**
   - `supabase.auth.getSession` → `api.auth.me()`（nullなら未ログイン）。
   - `signIn(email,password)` → `api.auth.login(username,password)`。
   - 追加で `signUp(username,password)` = `api.auth.register`。
   - `signOut` → `api.auth.logout()`。
   - `onAuthStateChange` は不要（me()の結果で判定）。`session` の代わりに `user` を保持。
   - 用語を email → username に（no-PIIのため）。

3. **ログイン画面（`src/pages/Login.tsx`）**
   - メール欄 → ユーザー名欄。新規登録トグル（register）を追加。

4. **各フックの置き換え**（React Query はそのまま、queryFn/mutationFn だけ差し替え）
   | 既存フック | 置き換え先 |
   |---|---|
   | `useEntriesForDay` / `useEntriesForRange` | `api.entries.range(startIso, endIso)` |
   | `useOverdueTasks` | `api.entries.overdueTasks(todayStartIso)` |
   | `useSaveEntry`（id有無で分岐）| 無→`api.entries.create` / 有→`api.entries.update` |
   | `useAddEntries`（複製・繰り返し）| `api.entries.bulk` |
   | `useBulkAddEntries` | `api.entries.bulk` |
   | `useUpdateChecklist` / `useSetProgress` | `api.entries.patch(id,{notes,progress})` |
   | `useCarryOverToday` | `api.entries.update`（日付だけ差し替え）|
   | `useDeleteEntry` | `api.entries.remove` |
   | `useCategories` / upsert / delete | `api.categories.*` |
   | `useInboxItems` / add / status / delete | `api.inbox.*` |
   | `useAutoParseInbox` | 端末内 `parseNatural` のまま → 結果を `api.inbox.patch(id,{parsed})` |
   | `useMonthlyGoal` | `api.goals.get/put` |
   | `useTimeTracking`（running/start/stop/range）| `api.timeLogs.*` |

   - ⚠️ `all_day` はAPI側でboolean、`starts_at/ends_at` はISO文字列（既存Entry型と同じ）。
   - 返り値の型は `@/types/database` の Entry/Category/… と一致済み。

5. **リマインド（iOS通知）設定UI**（LINEセクションの置き換え）
   - 設定シートに「🔔 iPhoneに通知」を追加：
     - `enablePushNotifications()`（`webpushClient.ts`）でホーム追加→許可→購読。
     - `api.push.getPrefs/putPrefs` でオン/オフ・時刻（既定21時）。
   - 既存の `LineNotifySection` / `ChatImportSection` はB(Cloudflare)では非表示に。

6. **Service Worker に push ハンドラを追加**（通知表示に必須）
   - `vite-plugin-pwa` を `generateSW` → `injectManifest` に変更し、カスタムSWへ:
     ```js
     self.addEventListener('push', (e) => {
       const d = e.data?.json() ?? {}
       e.waitUntil(self.registration.showNotification(d.title ?? 'MY SCHEDULE', {
         body: d.body ?? '', data: { url: d.url ?? '/' }, icon: '/icon-192.png'
       }))
     })
     self.addEventListener('notificationclick', (e) => {
       e.notification.close()
       e.waitUntil(clients.openWindow(e.notification.data?.url ?? '/'))
     })
     ```
   - workbox の precache は injectManifest でも維持。

7. **ビルド & 配信**
   - `cd schedule-app && npm run build` → `server` の `[assets]` が `../schedule-app/dist` を配信。
   - `cd server && npx wrangler dev --local` で統合確認（ログイン→予定作成→表示）。

8. **デプロイ**（ここで初めてCloudflareトークン/ログイン）: `server/README.md` 参照。

## 検証チェックリスト（Phase 2完了条件）
- [ ] 新規登録・ログイン・ログアウトができる
- [ ] 予定/TODO/カテゴリ/計測/目標が作成・表示・編集・削除できる（同期）
- [ ] 期限切れTODOの持ち越し表示
- [ ] 一括取り込み（CSV/貼り付け）
- [ ] iPhone実機: ホーム追加→通知許可→毎晩「明日のぶん」が届く（webpush.ts の疎通確認込み）
- [ ] 配布版A（端末内＋パスコード）が従来通り動く
