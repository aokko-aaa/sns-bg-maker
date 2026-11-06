-- MY SCHEDULE（アカウント＋同期版）D1スキーマ
-- 方針: 氏名・メール等の個人情報は保存しない(no-PII)。
--   users は「自分で決めたユーザー名」＋「ハッシュ化パスワード」だけ。
--   すべてのデータ行は user_id で分離。

-- ── 利用者（no-PII）────────────────────────────
create table if not exists users (
  id         text primary key,            -- uuid
  username   text not null unique,        -- 本人が決める表示用ID（メールではない）
  pass_salt  text not null,               -- hex
  pass_hash  text not null,               -- hex (PBKDF2-SHA256)
  created_at text not null
);

-- ── カテゴリ ───────────────────────────────────
create table if not exists categories (
  id         text primary key,
  user_id    text not null references users(id) on delete cascade,
  name       text not null,
  group_key  text not null,               -- 'work' | 'family' | 'personal'
  color      text not null,
  sort_order integer not null default 0,
  created_at text not null
);
create index if not exists categories_user on categories(user_id);

-- ── 受信箱（つぶやき）──────────────────────────
create table if not exists inbox_items (
  id         text primary key,
  user_id    text not null references users(id) on delete cascade,
  raw_text   text not null,
  input_type text not null default 'text',
  status     text not null default 'pending',
  parsed     text,                         -- JSON文字列
  parsed_at  text,
  created_at text not null
);
create index if not exists inbox_user on inbox_items(user_id);

-- ── 予定・タスク ───────────────────────────────
create table if not exists entries (
  id          text primary key,
  user_id     text not null references users(id) on delete cascade,
  title       text not null,
  category_id text,
  kind        text not null default 'event',   -- 'event' | 'task'
  starts_at   text not null,                   -- ISO8601
  ends_at     text not null,                   -- ISO8601（end未定は starts_at と同値）
  all_day     integer not null default 0,      -- 0/1
  progress    integer default 0,
  notes       text,
  source      text not null default 'manual',
  inbox_id    text,
  created_at  text not null,
  updated_at  text not null
);
create index if not exists entries_user_range on entries(user_id, starts_at, ends_at);
create index if not exists entries_user_kind on entries(user_id, kind);

-- ── 作業時間ログ ───────────────────────────────
create table if not exists time_logs (
  id          text primary key,
  user_id     text not null references users(id) on delete cascade,
  entry_id    text,
  category_id text,
  label       text not null,
  started_at  text not null,
  ended_at    text,                            -- null = 計測中
  created_at  text not null
);
create index if not exists time_logs_user on time_logs(user_id, started_at);

-- ── 月の目標 ───────────────────────────────────
create table if not exists monthly_goals (
  id         text primary key,
  user_id    text not null references users(id) on delete cascade,
  month      text not null,                   -- 'YYYY-MM'
  goal       text not null default '',
  created_at text not null,
  updated_at text not null,
  unique(user_id, month)
);

-- ── Web Push 購読（iOS通知の送り先）────────────
create table if not exists push_subscriptions (
  id         text primary key,
  user_id    text not null references users(id) on delete cascade,
  endpoint   text not null unique,
  p256dh     text not null,
  auth       text not null,
  created_at text not null
);
create index if not exists push_user on push_subscriptions(user_id);

-- ── リマインド設定（毎晩「明日のぶん」）─────────
create table if not exists reminder_prefs (
  user_id     text primary key references users(id) on delete cascade,
  enabled     integer not null default 1,
  notify_hour integer not null default 21,     -- JST 0-23
  created_at  text not null,
  updated_at  text not null
);
