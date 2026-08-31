-- 作業時間トラッカー用のテーブルを追加する（Supabase SQL Editor に貼り付けて実行）。
-- 1回だけ実行すればOK。既存データには影響しません。

create table if not exists time_logs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id),
  entry_id    uuid references entries(id) on delete set null, -- タスクから開始した場合
  category_id uuid references categories(id),                 -- 集計の分類
  label       text not null,                                  -- 作業内容
  started_at  timestamptz not null,
  ended_at    timestamptz,                                    -- null = 計測中
  created_at  timestamptz default now()
);

create index if not exists time_logs_range_idx on time_logs (user_id, started_at);

alter table time_logs enable row level security;

create policy time_logs_owner on time_logs
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- 念のため（既に付与済みなら無害）
grant select, insert, update, delete on time_logs to anon, authenticated;
