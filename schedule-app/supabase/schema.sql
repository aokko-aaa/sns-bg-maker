-- 要件定義書 4. データモデル / RLS。
-- Phase 1 で Supabase SQL Editor に貼り付けて実行する。
-- 注意: inbox_items が entries より先に必要（entries.inbox_id が参照するため）。

-- ── inbox_items（受信箱）────────────────────────────────
create table if not exists inbox_items (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id),
  raw_text    text not null,          -- つぶやきの原文。加工前を必ず残す（上書き厳禁）
  input_type  text not null,          -- 'text' | 'voice'
  status      text not null default 'pending',
    -- 'pending' | 'converted' | 'memo' | 'held' | 'dismissed'
  parsed      jsonb,                  -- AI解釈結果
  parsed_at   timestamptz,
  created_at  timestamptz default now()
);

-- ── categories（カテゴリマスタ）──────────────────────────
create table if not exists categories (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id),
  name        text not null,
  group_key   text not null,          -- 'work' | 'family' | 'personal'
  color       text not null,          -- hex 例: '#4F86F7'
  sort_order  int  not null default 0,
  created_at  timestamptz default now()
);

-- ── entries（予定・タスク統合テーブル）──────────────────
create table if not exists entries (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id),
  title       text not null,
  category_id uuid references categories(id),
  kind        text not null default 'event',  -- 'event' | 'task'
  starts_at   timestamptz not null,
  ends_at     timestamptz not null,
  all_day     boolean not null default false,
  progress    int default 0,                  -- 0-100 (kind='task' のみ)
  notes       text,
  source      text not null default 'manual', -- 'manual' | 'inbox'
  inbox_id    uuid references inbox_items(id),
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

create index if not exists entries_range_idx on entries (user_id, starts_at, ends_at);

-- ── time_logs（作業時間の計測ログ）──────────────────────
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

-- ── monthly_goals（月ごとの目標）──────────────────────
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

-- ── RLS: 全テーブルで user_id = auth.uid() のみ許可 ──────
alter table inbox_items   enable row level security;
alter table categories    enable row level security;
alter table entries       enable row level security;
alter table time_logs     enable row level security;
alter table monthly_goals enable row level security;

create policy inbox_owner on inbox_items
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy categories_owner on categories
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy entries_owner on entries
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy time_logs_owner on time_logs
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy monthly_goals_owner on monthly_goals
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
