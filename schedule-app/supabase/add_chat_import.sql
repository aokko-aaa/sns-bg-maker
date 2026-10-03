-- チャット(Claude)からの予定自動登録用のトークン置き場。
-- Supabase SQL Editor に貼り付けて実行する。クラウド版のみで使う。
--
-- 使い方: アプリの「設定」で合言葉トークンを発行 → そのトークンとURLをClaudeに伝えると、
-- Claudeが import-entries 関数を叩いて、あなたのカレンダーに直接予定を登録できる。

create table if not exists chat_import_tokens (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  token      text unique not null,           -- 書き込み用の合言葉（秘密）
  enabled    boolean not null default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- RLS: 本人のみ自分の行を読み書き（import-entries 関数は service_role で回避）
alter table chat_import_tokens enable row level security;
drop policy if exists chat_import_owner on chat_import_tokens;
create policy chat_import_owner on chat_import_tokens
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
