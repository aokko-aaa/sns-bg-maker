-- 外部取り込み（タイムツリー等）用: entries に外部IDとカレンダー名の列を追加。
-- 既存データは両列NULL（＝手入力の予定には一切影響しない）。

alter table entries add column ext_id text;
alter table entries add column calendar text;

-- 同じ source＋ext_id は1件だけ（二重取り込み防止・upsertの土台）。
create unique index if not exists entries_src_ext
  on entries(user_id, source, ext_id) where ext_id is not null;
