-- LINE通知（翌日のTODO/予定を毎晩自動送信）用のテーブル。
-- Supabase SQL Editor に貼り付けて実行する。クラウド版のみで使う機能。

create table if not exists line_links (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  line_user_id text unique,               -- 連携済みなら LINE の userId。未連携は null
  link_code    text unique,               -- 連携用の合言葉。連携後は null に戻す
  enabled      boolean not null default false,
  notify_hour  int not null default 21,   -- 毎日この時刻(JST 0-23)に翌日ぶんを送る
  linked_at    timestamptz,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

-- notify_hour は 0-23 に制限
alter table line_links
  drop constraint if exists line_links_notify_hour_chk;
alter table line_links
  add constraint line_links_notify_hour_chk check (notify_hour between 0 and 23);

-- RLS: 本人のみ自分の行を読み書きできる（Edgeの通知/連携処理は service_role で回避）
alter table line_links enable row level security;
drop policy if exists line_links_owner on line_links;
create policy line_links_owner on line_links
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ─────────────────────────────────────────────────────────────
-- 毎晩の自動送信スケジュール（pg_cron + pg_net）。
-- Supabase では Dashboard → Database → Extensions で pg_cron / pg_net を有効化してから、
-- 下の <...> を自分の値に置き換えて実行する。
--   <PROJECT_REF>  … 例: yshnutsgkoxadwjhhtlp（Supabaseの Project ref）
--   <CRON_SECRET>  … line-notify 関数に設定したのと同じ秘密の文字列
-- 毎正時(UTC)に line-notify を叩き、関数側が「JSTで各ユーザーの通知時刻か？」を判定する。
-- ─────────────────────────────────────────────────────────────
-- create extension if not exists pg_cron;
-- create extension if not exists pg_net;
--
-- select cron.schedule(
--   'line-notify-hourly',
--   '0 * * * *',
--   $$
--     select net.http_post(
--       url     := 'https://<PROJECT_REF>.functions.supabase.co/line-notify',
--       headers := jsonb_build_object(
--         'Content-Type', 'application/json',
--         'x-cron-secret', '<CRON_SECRET>'
--       ),
--       body    := '{}'::jsonb
--     );
--   $$
-- );
--
-- 解除したいとき: select cron.unschedule('line-notify-hourly');
