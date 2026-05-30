pragma journal_mode = WAL;
pragma foreign_keys = ON;

create table if not exists notes (
  id text primary key,
  source_type text not null check (source_type in ('feishu', 'local')),
  source_id text,
  title text not null,
  slug text not null unique,
  summary text not null default '',
  content_markdown text not null default '',
  content_html text not null default '',
  status text not null check (status in ('public', 'draft', 'archived', 'removed')),
  parent_id text,
  source_updated_at text,
  synced_at text,
  created_at text not null,
  updated_at text not null
);

create unique index if not exists notes_source_unique on notes(source_type, source_id) where source_id is not null;
create index if not exists notes_status_updated_idx on notes(status, updated_at desc);

create table if not exists tags (
  id text primary key,
  name text not null unique,
  slug text not null unique
);

create table if not exists note_tags (
  note_id text not null references notes(id) on delete cascade,
  tag_id text not null references tags(id) on delete cascade,
  primary key (note_id, tag_id)
);

create table if not exists settings (
  key text primary key,
  value text not null,
  updated_at text not null
);

create table if not exists sessions (
  id text primary key,
  token_hash text not null unique,
  expires_at text not null,
  created_at text not null
);

create table if not exists sync_runs (
  id text primary key,
  status text not null check (status in ('running', 'success', 'failed', 'partial')),
  started_at text not null,
  finished_at text,
  message text not null default '',
  stats_json text not null default '{}'
);
