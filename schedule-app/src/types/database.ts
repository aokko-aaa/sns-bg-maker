// 要件定義書 4. データモデルに対応する型。
// Phase 1 で Supabase の型自動生成に置き換えてもよいが、まずは手書きで土台を用意する。

export type GroupKey = 'work' | 'family' | 'personal'
export type EntryKind = 'event' | 'task'
export type EntrySource = 'manual' | 'inbox'
export type InputType = 'text' | 'voice'
export type InboxStatus =
  | 'pending'
  | 'converted'
  | 'memo'
  | 'held'
  | 'dismissed'

// NOTE: interface ではなく type alias にすること。
// Supabase の型は Row/Insert/Update が Record<string, unknown> に代入可能である必要があり、
// interface は暗黙のインデックスシグネチャを持たず代入不可 → 型が never に退化する。
export type Category = {
  id: string
  user_id: string
  name: string
  group_key: GroupKey
  color: string
  sort_order: number
  created_at: string
}

export type Entry = {
  id: string
  user_id: string
  title: string
  category_id: string | null
  kind: EntryKind
  starts_at: string
  ends_at: string
  all_day: boolean
  progress: number | null
  notes: string | null
  source: EntrySource
  inbox_id: string | null
  created_at: string
  updated_at: string
}

/** AI 解釈結果（仕様 6-3 の出力 JSON） */
export type ParsedInboxItem = {
  title: string
  kind: EntryKind
  starts_at: string
  ends_at: string
  all_day: boolean
  category_id: string | null
  confidence: number
  source_phrase: string
}

export type ParsedInbox = {
  classification: 'schedule' | 'memo' | 'unclear'
  items: ParsedInboxItem[]
  memo: string | null
  reason: string
}

export type InboxItem = {
  id: string
  user_id: string
  raw_text: string
  input_type: InputType
  status: InboxStatus
  parsed: ParsedInbox | null
  parsed_at: string | null
  created_at: string
}

// createClient<Database> に渡す最小限のスキーマ型。
// 生成型に差し替えるまでの土台。
export interface Database {
  public: {
    Tables: {
      categories: {
        Row: Category
        Insert: Omit<Category, 'id' | 'created_at'> &
          Partial<Pick<Category, 'id' | 'created_at'>>
        Update: Partial<Category>
        Relationships: []
      }
      entries: {
        Row: Entry
        Insert: Omit<Entry, 'id' | 'created_at' | 'updated_at'> &
          Partial<Pick<Entry, 'id' | 'created_at' | 'updated_at'>>
        Update: Partial<Entry>
        Relationships: []
      }
      inbox_items: {
        Row: InboxItem
        Insert: Omit<InboxItem, 'id' | 'created_at'> &
          Partial<Pick<InboxItem, 'id' | 'created_at'>>
        Update: Partial<InboxItem>
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
  }
}
