-- 「今月の目標」を保存するテーブルを追加する（Supabase SQL Editor に貼り付けて実行）。
-- 1回だけ実行すればOK。既存データには影響しません。

create table if not exists monthly_goals (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id),
  month       text not null,          -- 'YYYY-MM'
  goal        text not null default '',
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

create unique index if not exists monthly_goals_user_month
  on monthly_goals (user_id, month);

alter table monthly_goals enable row level security;

create policy monthly_goals_owner on monthly_goals
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- 念のため（既に付与済みなら無害）
grant select, insert, update, delete on monthly_goals to anon, authenticated;
