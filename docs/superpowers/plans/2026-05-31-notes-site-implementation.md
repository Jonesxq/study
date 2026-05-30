# 中文个人笔记网站 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and deploy a Chinese personal notes website at `weixianmanbu.shop` with public reading pages, single-admin Markdown editing, local SQLite storage, scheduled Feishu Wiki sync, and Docker Compose deployment.

**Architecture:** Use one Next.js App Router application for public pages, admin pages, API routes, and server-side jobs. Store notes, tags, sessions, settings, and sync logs in SQLite; store synced images and uploads on disk. Run the app behind Caddy in Docker Compose, with persistent `data/`, `uploads/`, and `backups/` volumes.

**Tech Stack:** Next.js, TypeScript, React, Tailwind CSS, SQLite, `better-sqlite3`, Vitest, Playwright, Caddy, Docker Compose, Feishu OpenAPI.

---

## Scope Check

The spec contains several connected subsystems: public reading, admin editing, authentication, Feishu sync, deployment, and backup. They are not independent products because each subsystem depends on the same note model and deployment target. Keep one implementation plan, but make every task independently testable and commit after each task.

## Official References To Check During Implementation

- Feishu custom app tenant token endpoint: `https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal`
- Feishu API call guide: `https://open.feishu.cn/document/server-docs/api-call-guide/calling-process/get-`
- Feishu Wiki overview: `https://open.feishu.cn/document/ukTMukTMukTM/uUDN04SN0QjL1QDN/wiki-overview`
- Feishu docx block list endpoint: `https://open.feishu.cn/open-apis/docx/v1/documents/:document_id/blocks`
- Feishu docx block list docs note the app rate limit for that endpoint is 5 requests per second. Implement retry with backoff when Feishu returns a rate-limit error.

## File Structure

Create this structure as the project grows:

```text
E:/code/2work/
  src/
    app/
      (public)/
        page.tsx
        notes/page.tsx
        notes/[id]/page.tsx
        tags/page.tsx
        tags/[slug]/page.tsx
        search/page.tsx
        about/page.tsx
      admin/
        layout.tsx
        login/page.tsx
        page.tsx
        notes/page.tsx
        notes/new/page.tsx
        notes/[id]/edit/page.tsx
        sync/page.tsx
        settings/page.tsx
      api/
        admin/
          login/route.ts
          logout/route.ts
          notes/route.ts
          notes/[id]/route.ts
          sync/route.ts
          settings/route.ts
        health/route.ts
      layout.tsx
      globals.css
    components/
      admin/
        AdminNav.tsx
        MarkdownEditor.tsx
        NoteForm.tsx
        SyncStatusPanel.tsx
      public/
        SiteHeader.tsx
        NoteCard.tsx
        TagPill.tsx
        MarkdownView.tsx
    lib/
      auth/
        password.ts
        session.ts
        require-admin.ts
      db/
        client.ts
        migrate.ts
        schema.sql
        notes.ts
        settings.ts
        sync-runs.ts
      feishu/
        client.ts
        blocks-to-markdown.ts
        sync.ts
        types.ts
      markdown/
        render.ts
        summarize.ts
      paths.ts
      time.ts
      validation.ts
    middleware.ts
  tests/
    unit/
      auth.test.ts
      db.test.ts
      markdown.test.ts
      notes-repository.test.ts
      feishu-sync.test.ts
    e2e/
      public.spec.ts
      admin.spec.ts
  scripts/
    migrate.ts
    seed-admin.ts
    sync-feishu.ts
    backup.ts
  docker/
    Caddyfile
  docs/
    deployment.md
  Dockerfile
  docker-compose.yml
  .env.example
  package.json
  tsconfig.json
  vitest.config.ts
  playwright.config.ts
```

## Task 1: Project Scaffold And Tooling

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `next.config.mjs`
- Create: `postcss.config.mjs`
- Create: `tailwind.config.ts`
- Create: `vitest.config.ts`
- Create: `playwright.config.ts`
- Create: `src/app/layout.tsx`
- Create: `src/app/globals.css`
- Create: `src/app/(public)/page.tsx`
- Modify: `.gitignore`

- [ ] **Step 1: Write package and config files**

Create `package.json` with these scripts:

```json
{
  "name": "weixianmanbu-notes",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "e2e": "playwright test",
    "db:migrate": "tsx scripts/migrate.ts",
    "seed:admin": "tsx scripts/seed-admin.ts",
    "sync:feishu": "tsx scripts/sync-feishu.ts",
    "backup": "tsx scripts/backup.ts",
    "verify": "npm run typecheck && npm run test && npm run build"
  },
  "dependencies": {
    "bcryptjs": "latest",
    "better-sqlite3": "latest",
    "clsx": "latest",
    "next": "latest",
    "react": "latest",
    "react-dom": "latest",
    "rehype-sanitize": "latest",
    "rehype-stringify": "latest",
    "remark-gfm": "latest",
    "remark-parse": "latest",
    "remark-rehype": "latest",
    "unified": "latest",
    "zod": "latest"
  },
  "devDependencies": {
    "@playwright/test": "latest",
    "@tailwindcss/typography": "latest",
    "@testing-library/jest-dom": "latest",
    "@testing-library/react": "latest",
    "@types/better-sqlite3": "latest",
    "@types/node": "latest",
    "@types/react": "latest",
    "@types/react-dom": "latest",
    "autoprefixer": "latest",
    "jsdom": "latest",
    "postcss": "latest",
    "tailwindcss": "^3.4.17",
    "tsx": "latest",
    "typescript": "latest",
    "vitest": "latest"
  }
}
```

Create `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "es2022"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    },
    "plugins": [{ "name": "next" }]
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

Create `postcss.config.mjs`:

```js
const config = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {}
  }
};

export default config;
```

Create `tailwind.config.ts`:

```ts
import type { Config } from 'tailwindcss';
import typography from '@tailwindcss/typography';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {}
  },
  plugins: [typography]
};

export default config;
```

Create `next.config.mjs`:

```js
/** @type {import('next').NextConfig} */
const nextConfig = {
};

export default nextConfig;
```

Create `vitest.config.ts`:

```ts
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['tests/unit/**/*.test.ts'],
    globals: true
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  }
});
```

Create `playwright.config.ts`:

```ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  use: {
    baseURL: 'http://127.0.0.1:3000',
    trace: 'retain-on-failure'
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://127.0.0.1:3000',
    reuseExistingServer: true,
    timeout: 120_000
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } }
  ]
});
```

- [ ] **Step 2: Create the first Chinese public shell**

Create `src/app/layout.tsx`:

```tsx
import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '未闲漫步',
  description: '一个记录阅读、技术、生活观察和长期问题的中文笔记库。'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
```

Create `src/app/globals.css`:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  color-scheme: light;
  --bg: #f7f5ef;
  --surface: #fffdf8;
  --text: #202124;
  --muted: #667085;
  --line: #d9d4c8;
  --accent: #2f6f73;
}

body {
  margin: 0;
  background: var(--bg);
  color: var(--text);
  font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

a {
  color: inherit;
  text-decoration: none;
}
```

Create `src/app/(public)/page.tsx`:

```tsx
export default function HomePage() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <header className="flex items-center justify-between border-b border-[var(--line)] pb-5">
        <span className="text-lg font-semibold">未闲漫步</span>
        <nav className="flex gap-5 text-sm text-[var(--muted)]">
          <a href="/notes">笔记</a>
          <a href="/tags">标签</a>
          <a href="/search">搜索</a>
          <a href="/about">关于</a>
        </nav>
      </header>
      <section className="py-16">
        <h1 className="text-4xl font-semibold tracking-normal">最近在想什么</h1>
        <p className="mt-4 max-w-2xl text-lg leading-8 text-[var(--muted)]">
          一个记录阅读、技术、生活观察和长期问题的中文笔记库。
        </p>
      </section>
    </main>
  );
}
```

- [ ] **Step 3: Install dependencies and verify scaffold**

Run:

```powershell
npm install
npm run typecheck
npm run test
npm run build
```

Expected:

```text
typecheck exits 0
vitest reports no test files or all tests pass
next build exits 0
```

- [ ] **Step 4: Commit scaffold**

```powershell
git add package.json package-lock.json tsconfig.json next.config.mjs postcss.config.mjs tailwind.config.ts vitest.config.ts playwright.config.ts .env.example src/app
git commit -m "chore: scaffold next notes app"
```

## Task 2: Database Schema, Migrations, And Repositories

**Files:**
- Create: `src/lib/db/schema.sql`
- Create: `src/lib/db/client.ts`
- Create: `src/lib/db/migrate.ts`
- Create: `src/lib/db/notes.ts`
- Create: `src/lib/db/settings.ts`
- Create: `src/lib/db/sync-runs.ts`
- Create: `scripts/migrate.ts`
- Test: `tests/unit/db.test.ts`
- Test: `tests/unit/notes-repository.test.ts`

- [ ] **Step 1: Write failing database migration test**

Create `tests/unit/db.test.ts`:

```ts
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import { runMigrations } from '@/lib/db/migrate';

describe('database migrations', () => {
  it('creates the required tables and seed settings', () => {
    const dir = mkdtempSync(join(tmpdir(), 'notes-db-'));
    const dbPath = join(dir, 'test.sqlite');
    const db = new Database(dbPath);

    runMigrations(db);

    const tables = db
      .prepare("select name from sqlite_master where type = 'table' order by name")
      .all()
      .map((row) => (row as { name: string }).name);

    expect(tables).toContain('notes');
    expect(tables).toContain('tags');
    expect(tables).toContain('note_tags');
    expect(tables).toContain('settings');
    expect(tables).toContain('sessions');
    expect(tables).toContain('sync_runs');

    const siteName = db.prepare("select value from settings where key = 'site_name'").get() as { value: string };
    expect(siteName.value).toBe('未闲漫步');

    db.close();
    rmSync(dir, { recursive: true, force: true });
  });
});
```

- [ ] **Step 2: Run the failing database test**

Run:

```powershell
npm test -- tests/unit/db.test.ts
```

Expected:

```text
FAIL tests/unit/db.test.ts
Cannot find module '@/lib/db/migrate'
```

- [ ] **Step 3: Create migration implementation**

Create `src/lib/db/schema.sql`:

```sql
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
```

Create `src/lib/db/migrate.ts`:

```ts
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type Database from 'better-sqlite3';

export function runMigrations(db: Database.Database) {
  const schema = readFileSync(join(process.cwd(), 'src/lib/db/schema.sql'), 'utf8');
  db.exec(schema);
  const now = new Date().toISOString();
  const insertSetting = db.prepare(`
    insert into settings (key, value, updated_at)
    values (@key, @value, @updated_at)
    on conflict(key) do nothing
  `);
  insertSetting.run({ key: 'site_name', value: '未闲漫步', updated_at: now });
  insertSetting.run({
    key: 'site_description',
    value: '一个记录阅读、技术、生活观察和长期问题的中文笔记库。',
    updated_at: now
  });
  insertSetting.run({ key: 'feishu_sync_source', value: '', updated_at: now });
}
```

Create `src/lib/db/client.ts`:

```ts
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import Database from 'better-sqlite3';
import { runMigrations } from './migrate';

let singleton: Database.Database | undefined;

export function getDatabase() {
  if (singleton) return singleton;
  const dbPath = process.env.DATABASE_PATH ?? './data/notes.sqlite';
  mkdirSync(dirname(dbPath), { recursive: true });
  singleton = new Database(dbPath);
  singleton.pragma('foreign_keys = ON');
  runMigrations(singleton);
  return singleton;
}
```

Create `scripts/migrate.ts`:

```ts
import { getDatabase } from '../src/lib/db/client';

getDatabase();
console.log('Database migrated');
```

- [ ] **Step 4: Run migration test until it passes**

Run:

```powershell
npm test -- tests/unit/db.test.ts
```

Expected:

```text
PASS tests/unit/db.test.ts
```

- [ ] **Step 5: Write failing note repository test**

Create `tests/unit/notes-repository.test.ts`:

```ts
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import { runMigrations } from '@/lib/db/migrate';
import { createNote, findPublicNotes, getNoteById, markMissingFeishuNotesRemoved } from '@/lib/db/notes';

function makeDb() {
  const dir = mkdtempSync(join(tmpdir(), 'notes-repo-'));
  const db = new Database(join(dir, 'test.sqlite'));
  runMigrations(db);
  return { db, cleanup: () => { db.close(); rmSync(dir, { recursive: true, force: true }); } };
}

describe('notes repository', () => {
  it('creates a local public note with tags and finds it for the public site', () => {
    const { db, cleanup } = makeDb();

    const note = createNote(db, {
      sourceType: 'local',
      title: '第一篇本地笔记',
      summary: '摘要',
      contentMarkdown: '# 第一篇本地笔记',
      contentHtml: '<h1>第一篇本地笔记</h1>',
      status: 'public',
      tags: ['阅读', '工具']
    });

    expect(note.slug).toBe(note.id);
    expect(getNoteById(db, note.id)?.title).toBe('第一篇本地笔记');
    expect(findPublicNotes(db, { query: '本地', tagSlug: null })).toHaveLength(1);

    cleanup();
  });

  it('marks Feishu notes outside the latest sync scope as removed', () => {
    const { db, cleanup } = makeDb();
    const kept = createNote(db, {
      sourceType: 'feishu',
      sourceId: 'doc-kept',
      title: '保留',
      summary: '',
      contentMarkdown: '保留',
      contentHtml: '<p>保留</p>',
      status: 'public',
      tags: []
    });
    const removed = createNote(db, {
      sourceType: 'feishu',
      sourceId: 'doc-removed',
      title: '移出范围',
      summary: '',
      contentMarkdown: '移出范围',
      contentHtml: '<p>移出范围</p>',
      status: 'public',
      tags: []
    });

    markMissingFeishuNotesRemoved(db, ['doc-kept']);

    expect(getNoteById(db, kept.id)?.status).toBe('public');
    expect(getNoteById(db, removed.id)?.status).toBe('removed');
    cleanup();
  });
});
```

- [ ] **Step 6: Run failing repository test**

Run:

```powershell
npm test -- tests/unit/notes-repository.test.ts
```

Expected:

```text
FAIL tests/unit/notes-repository.test.ts
Cannot find module '@/lib/db/notes'
```

- [ ] **Step 7: Implement note repository**

Create `src/lib/db/notes.ts` with these exported names:

```ts
import type Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';

export type NoteStatus = 'public' | 'draft' | 'archived' | 'removed';
export type SourceType = 'feishu' | 'local';

export type NoteRecord = {
  id: string;
  source_type: SourceType;
  source_id: string | null;
  title: string;
  slug: string;
  summary: string;
  content_markdown: string;
  content_html: string;
  status: NoteStatus;
  parent_id: string | null;
  source_updated_at: string | null;
  synced_at: string | null;
  created_at: string;
  updated_at: string;
};

export type CreateNoteInput = {
  sourceType: SourceType;
  sourceId?: string;
  title: string;
  summary: string;
  contentMarkdown: string;
  contentHtml: string;
  status: NoteStatus;
  tags: string[];
  parentId?: string | null;
  sourceUpdatedAt?: string | null;
};

function tagSlug(name: string) {
  return encodeURIComponent(name.trim().toLowerCase());
}

function upsertTags(db: Database.Database, noteId: string, tags: string[]) {
  db.prepare('delete from note_tags where note_id = ?').run(noteId);
  const insertTag = db.prepare(`
    insert into tags (id, name, slug)
    values (@id, @name, @slug)
    on conflict(name) do update set slug = excluded.slug
  `);
  const findTag = db.prepare('select id from tags where name = ?');
  const link = db.prepare('insert or ignore into note_tags (note_id, tag_id) values (?, ?)');
  for (const raw of tags) {
    const name = raw.trim();
    if (!name) continue;
    insertTag.run({ id: randomUUID(), name, slug: tagSlug(name) });
    const row = findTag.get(name) as { id: string };
    link.run(noteId, row.id);
  }
}

export function createNote(db: Database.Database, input: CreateNoteInput) {
  const now = new Date().toISOString();
  const id = randomUUID();
  const slug = id;
  db.prepare(`
    insert into notes (
      id, source_type, source_id, title, slug, summary, content_markdown, content_html,
      status, parent_id, source_updated_at, synced_at, created_at, updated_at
    )
    values (
      @id, @source_type, @source_id, @title, @slug, @summary, @content_markdown, @content_html,
      @status, @parent_id, @source_updated_at, @synced_at, @created_at, @updated_at
    )
  `).run({
    id,
    source_type: input.sourceType,
    source_id: input.sourceId ?? null,
    title: input.title,
    slug,
    summary: input.summary,
    content_markdown: input.contentMarkdown,
    content_html: input.contentHtml,
    status: input.status,
    parent_id: input.parentId ?? null,
    source_updated_at: input.sourceUpdatedAt ?? null,
    synced_at: input.sourceType === 'feishu' ? now : null,
    created_at: now,
    updated_at: now
  });
  upsertTags(db, id, input.tags);
  return getNoteById(db, id)!;
}

export function getNoteById(db: Database.Database, id: string) {
  return db.prepare('select * from notes where id = ?').get(id) as NoteRecord | undefined;
}

export function findPublicNotes(db: Database.Database, input: { query: string | null; tagSlug: string | null }) {
  const query = `%${input.query ?? ''}%`;
  if (input.tagSlug) {
    return db.prepare(`
      select distinct n.* from notes n
      join note_tags nt on nt.note_id = n.id
      join tags t on t.id = nt.tag_id
      where n.status = 'public' and t.slug = @tagSlug
        and (n.title like @query or n.summary like @query or n.content_markdown like @query)
      order by n.updated_at desc
    `).all({ tagSlug: input.tagSlug, query }) as NoteRecord[];
  }
  return db.prepare(`
    select * from notes
    where status = 'public'
      and (title like @query or summary like @query or content_markdown like @query)
    order by updated_at desc
  `).all({ query }) as NoteRecord[];
}

export function markMissingFeishuNotesRemoved(db: Database.Database, activeSourceIds: string[]) {
  const active = new Set(activeSourceIds);
  const rows = db.prepare("select source_id from notes where source_type = 'feishu' and source_id is not null").all() as { source_id: string }[];
  const update = db.prepare("update notes set status = 'removed', updated_at = ? where source_type = 'feishu' and source_id = ?");
  const now = new Date().toISOString();
  for (const row of rows) {
    if (!active.has(row.source_id)) update.run(now, row.source_id);
  }
}
```

- [ ] **Step 8: Run repository tests**

Run:

```powershell
npm test -- tests/unit/db.test.ts tests/unit/notes-repository.test.ts
```

Expected:

```text
PASS tests/unit/db.test.ts
PASS tests/unit/notes-repository.test.ts
```

- [ ] **Step 9: Commit database layer**

```powershell
git add src/lib/db scripts/migrate.ts tests/unit/db.test.ts tests/unit/notes-repository.test.ts
git commit -m "feat: add sqlite note storage"
```

## Task 3: Markdown Rendering And Summaries

**Files:**
- Create: `src/lib/markdown/render.ts`
- Create: `src/lib/markdown/summarize.ts`
- Create: `src/components/public/MarkdownView.tsx`
- Test: `tests/unit/markdown.test.ts`

- [ ] **Step 1: Write failing Markdown tests**

Create `tests/unit/markdown.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { renderMarkdown } from '@/lib/markdown/render';
import { summarizeMarkdown } from '@/lib/markdown/summarize';

describe('markdown rendering', () => {
  it('renders Chinese Markdown and removes unsafe html', async () => {
    const html = await renderMarkdown('# 标题\n\n正文 **重点**\n\n<script>alert(1)</script>');
    expect(html).toContain('<h1>标题</h1>');
    expect(html).toContain('<strong>重点</strong>');
    expect(html).not.toContain('<script>');
  });

  it('creates a short plain Chinese summary', () => {
    expect(summarizeMarkdown('# 标题\n\n这是第一段内容，用来生成摘要。', 12)).toBe('这是第一段内容，用来生成...');
  });
});
```

- [ ] **Step 2: Run failing Markdown tests**

Run:

```powershell
npm test -- tests/unit/markdown.test.ts
```

Expected:

```text
FAIL tests/unit/markdown.test.ts
Cannot find module '@/lib/markdown/render'
```

- [ ] **Step 3: Implement Markdown utilities**

Create `src/lib/markdown/render.ts`:

```ts
import rehypeSanitize from 'rehype-sanitize';
import rehypeStringify from 'rehype-stringify';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import { unified } from 'unified';

export async function renderMarkdown(markdown: string) {
  const file = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkRehype)
    .use(rehypeSanitize)
    .use(rehypeStringify)
    .process(markdown);
  return String(file);
}
```

Create `src/lib/markdown/summarize.ts`:

```ts
export function summarizeMarkdown(markdown: string, maxLength = 80) {
  const plain = markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^#+\s+/gm, '')
    .replace(/!\[[^\]]*]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)]\([^)]*\)/g, '$1')
    .replace(/[*_>#-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (plain.length <= maxLength) return plain;
  return `${plain.slice(0, maxLength)}...`;
}
```

Create `src/components/public/MarkdownView.tsx`:

```tsx
export function MarkdownView({ html }: { html: string }) {
  return (
    <div
      className="prose prose-neutral max-w-none prose-headings:tracking-normal prose-p:leading-8 prose-li:leading-8"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
```

- [ ] **Step 4: Run Markdown tests**

Run:

```powershell
npm test -- tests/unit/markdown.test.ts
```

Expected:

```text
PASS tests/unit/markdown.test.ts
```

- [ ] **Step 5: Commit Markdown layer**

```powershell
git add src/lib/markdown src/components/public/MarkdownView.tsx tests/unit/markdown.test.ts
git commit -m "feat: add markdown rendering"
```

## Task 4: Public Chinese Reading Pages

**Files:**
- Create: `src/components/public/SiteHeader.tsx`
- Create: `src/components/public/NoteCard.tsx`
- Create: `src/components/public/TagPill.tsx`
- Create: `src/app/(public)/notes/page.tsx`
- Create: `src/app/(public)/notes/[id]/page.tsx`
- Create: `src/app/(public)/tags/page.tsx`
- Create: `src/app/(public)/tags/[slug]/page.tsx`
- Create: `src/app/(public)/search/page.tsx`
- Create: `src/app/(public)/about/page.tsx`
- Modify: `src/app/(public)/page.tsx`
- Test: `tests/unit/public-pages.test.tsx`

- [ ] **Step 1: Write public component tests**

Create `tests/unit/public-pages.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { NoteCard } from '@/components/public/NoteCard';

describe('public reading components', () => {
  it('renders Chinese note card content', () => {
    render(
      <NoteCard
        note={{
          id: 'n1',
          title: '第一篇公开笔记',
          summary: '这是一段中文摘要',
          updatedAt: '2026-05-31T00:00:00.000Z',
          tags: ['阅读', '工具']
        }}
      />
    );

    expect(screen.getByText('第一篇公开笔记')).toBeTruthy();
    expect(screen.getByText('这是一段中文摘要')).toBeTruthy();
    expect(screen.getByText('阅读')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run failing public component test**

Run:

```powershell
npm test -- tests/unit/public-pages.test.tsx
```

Expected:

```text
FAIL tests/unit/public-pages.test.tsx
Cannot find module '@/components/public/NoteCard'
```

- [ ] **Step 3: Implement public components**

Create `src/components/public/TagPill.tsx`:

```tsx
export function TagPill({ name }: { name: string }) {
  return (
    <span className="rounded-full border border-[var(--line)] px-3 py-1 text-xs text-[var(--muted)]">
      {name}
    </span>
  );
}
```

Create `src/components/public/NoteCard.tsx`:

```tsx
import { TagPill } from './TagPill';

export type NoteCardData = {
  id: string;
  title: string;
  summary: string;
  updatedAt: string;
  tags: string[];
};

export function NoteCard({ note }: { note: NoteCardData }) {
  return (
    <article className="border-b border-[var(--line)] py-6">
      <a href={`/notes/${note.id}`} className="block">
        <h2 className="text-xl font-semibold tracking-normal">{note.title}</h2>
        <p className="mt-2 leading-7 text-[var(--muted)]">{note.summary}</p>
      </a>
      <div className="mt-4 flex flex-wrap gap-2">
        {note.tags.map((tag) => (
          <TagPill key={tag} name={tag} />
        ))}
      </div>
    </article>
  );
}
```

Create `src/components/public/SiteHeader.tsx`:

```tsx
export function SiteHeader() {
  return (
    <header className="flex items-center justify-between border-b border-[var(--line)] pb-5">
      <a href="/" className="text-lg font-semibold">未闲漫步</a>
      <nav className="flex gap-5 text-sm text-[var(--muted)]">
        <a href="/notes">笔记</a>
        <a href="/tags">标签</a>
        <a href="/search">搜索</a>
        <a href="/about">关于</a>
      </nav>
    </header>
  );
}
```

- [ ] **Step 4: Run public component test**

Run:

```powershell
npm test -- tests/unit/public-pages.test.tsx
```

Expected:

```text
PASS tests/unit/public-pages.test.tsx
```

- [ ] **Step 5: Implement server-rendered public routes**

Use `getDatabase()`, `findPublicNotes()`, and `getNoteById()` in public routes. Make each empty state Chinese:

```tsx
// src/app/(public)/notes/page.tsx
import { NoteCard } from '@/components/public/NoteCard';
import { SiteHeader } from '@/components/public/SiteHeader';
import { getDatabase } from '@/lib/db/client';
import { findPublicNotes } from '@/lib/db/notes';

export default function NotesPage() {
  const notes = findPublicNotes(getDatabase(), { query: null, tagSlug: null });
  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <SiteHeader />
      <h1 className="mt-12 text-3xl font-semibold tracking-normal">全部笔记</h1>
      <section className="mt-6">
        {notes.length === 0 ? <p className="text-[var(--muted)]">还没有公开笔记。</p> : notes.map((note) => (
          <NoteCard key={note.id} note={{ id: note.id, title: note.title, summary: note.summary, updatedAt: note.updated_at, tags: [] }} />
        ))}
      </section>
    </main>
  );
}
```

Implement the other routes with the same layout:

- `/notes/[id]`: render title, date, tags, and `MarkdownView`; call `notFound()` unless the note exists and `status === 'public'`.
- `/search`: read `searchParams.q`, pass it to `findPublicNotes()`, show `搜索结果` and Chinese empty state.
- `/tags`: list tags from a new `listTags()` function in `src/lib/db/notes.ts`.
- `/tags/[slug]`: pass slug into `findPublicNotes()`.
- `/about`: load the first public local note with slug `about`, or show `关于页面还没有发布。`.
- `/`: show site intro and the newest public notes.

- [ ] **Step 6: Verify public pages**

Run:

```powershell
npm run typecheck
npm test -- tests/unit/public-pages.test.tsx
npm run build
```

Expected:

```text
typecheck exits 0
PASS tests/unit/public-pages.test.tsx
next build exits 0
```

- [ ] **Step 7: Commit public pages**

```powershell
git add src/app src/components/public src/lib/db/notes.ts tests/unit/public-pages.test.tsx
git commit -m "feat: add public Chinese reading pages"
```

## Task 5: Admin Authentication

**Files:**
- Create: `src/lib/auth/password.ts`
- Create: `src/lib/auth/session.ts`
- Create: `src/lib/auth/require-admin.ts`
- Create: `src/middleware.ts`
- Create: `src/app/admin/login/page.tsx`
- Create: `src/app/api/admin/login/route.ts`
- Create: `src/app/api/admin/logout/route.ts`
- Create: `scripts/seed-admin.ts`
- Modify: `src/lib/db/schema.sql`
- Test: `tests/unit/auth.test.ts`

- [ ] **Step 1: Add admin table migration**

Add this table to `src/lib/db/schema.sql`:

```sql
create table if not exists admin_users (
  id text primary key,
  username text not null unique,
  password_hash text not null,
  created_at text not null,
  updated_at text not null
);
```

- [ ] **Step 2: Write failing auth tests**

Create `tests/unit/auth.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from '@/lib/auth/password';
import { hashSessionToken } from '@/lib/auth/session';

describe('admin auth', () => {
  it('hashes and verifies passwords', async () => {
    const hash = await hashPassword('strong-password');
    expect(hash).not.toBe('strong-password');
    await expect(verifyPassword('strong-password', hash)).resolves.toBe(true);
    await expect(verifyPassword('wrong-password', hash)).resolves.toBe(false);
  });

  it('hashes session tokens with sha256 hex', () => {
    const hash = hashSessionToken('session-token');
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });
});
```

- [ ] **Step 3: Run failing auth tests**

Run:

```powershell
npm test -- tests/unit/auth.test.ts
```

Expected:

```text
FAIL tests/unit/auth.test.ts
Cannot find module '@/lib/auth/password'
```

- [ ] **Step 4: Implement password and session helpers**

Create `src/lib/auth/password.ts`:

```ts
import bcrypt from 'bcryptjs';

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}
```

Create `src/lib/auth/session.ts`:

```ts
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type Database from 'better-sqlite3';

export const SESSION_COOKIE = 'notes_admin_session';

export function createSessionToken() {
  return randomBytes(32).toString('base64url');
}

export function hashSessionToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

export function createSession(db: Database.Database, token: string) {
  const now = new Date();
  const expires = new Date(now.getTime() + 1000 * 60 * 60 * 24 * 14);
  db.prepare(`
    insert into sessions (id, token_hash, expires_at, created_at)
    values (@id, @token_hash, @expires_at, @created_at)
  `).run({
    id: randomUUID(),
    token_hash: hashSessionToken(token),
    expires_at: expires.toISOString(),
    created_at: now.toISOString()
  });
  return expires;
}

export function getSession(db: Database.Database, token: string) {
  return db.prepare('select * from sessions where token_hash = ? and expires_at > ?')
    .get(hashSessionToken(token), new Date().toISOString());
}
```

- [ ] **Step 5: Run auth tests**

Run:

```powershell
npm test -- tests/unit/auth.test.ts
```

Expected:

```text
PASS tests/unit/auth.test.ts
```

- [ ] **Step 6: Implement login route and page**

Create login page and route with Chinese messages:

```tsx
// src/app/admin/login/page.tsx
export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <h1 className="text-2xl font-semibold tracking-normal">登录后台</h1>
      <form action="/api/admin/login" method="post" className="mt-8 space-y-4">
        <label className="block">
          <span className="mb-2 block text-sm text-[var(--muted)]">用户名</span>
          <input className="w-full border border-[var(--line)] px-4 py-3" name="username" />
        </label>
        <label className="block">
          <span className="mb-2 block text-sm text-[var(--muted)]">密码</span>
          <input className="w-full border border-[var(--line)] px-4 py-3" name="password" type="password" />
        </label>
        <button className="w-full bg-[var(--accent)] px-4 py-3 text-white" type="submit">登录</button>
      </form>
    </main>
  );
}
```

```ts
// src/app/api/admin/login/route.ts
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { getDatabase } from '@/lib/db/client';
import { verifyPassword } from '@/lib/auth/password';
import { createSession, createSessionToken, SESSION_COOKIE } from '@/lib/auth/session';

export async function POST(request: Request) {
  const form = await request.formData();
  const username = String(form.get('username') ?? '');
  const password = String(form.get('password') ?? '');
  const db = getDatabase();
  const user = db.prepare('select * from admin_users where username = ?').get(username) as { password_hash: string } | undefined;
  if (!user || !(await verifyPassword(password, user.password_hash))) {
    redirect('/admin/login?error=1');
  }
  const token = createSessionToken();
  const expires = createSession(db, token);
  cookies().set(SESSION_COOKIE, token, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', expires, path: '/' });
  redirect('/admin');
}
```

Create logout route that deletes the cookie and redirects to `/admin/login`.

- [ ] **Step 7: Implement middleware protection**

Create `src/middleware.ts`:

```ts
import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE } from '@/lib/auth/session';

export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  if (!path.startsWith('/admin') || path === '/admin/login') return NextResponse.next();
  if (request.cookies.get(SESSION_COOKIE)?.value) return NextResponse.next();
  return NextResponse.redirect(new URL('/admin/login', request.url));
}

export const config = {
  matcher: ['/admin/:path*']
};
```

- [ ] **Step 8: Add admin seed script**

Create `scripts/seed-admin.ts`:

```ts
import { randomUUID } from 'node:crypto';
import { hashPassword } from '../src/lib/auth/password';
import { getDatabase } from '../src/lib/db/client';

const username = process.env.ADMIN_USERNAME;
const password = process.env.ADMIN_PASSWORD;

if (!username || !password) {
  console.error('ADMIN_USERNAME and ADMIN_PASSWORD are required');
  process.exit(1);
}

const db = getDatabase();
const now = new Date().toISOString();
const passwordHash = await hashPassword(password);
db.prepare(`
  insert into admin_users (id, username, password_hash, created_at, updated_at)
  values (@id, @username, @password_hash, @created_at, @updated_at)
  on conflict(username) do update set password_hash = excluded.password_hash, updated_at = excluded.updated_at
`).run({ id: randomUUID(), username, password_hash: passwordHash, created_at: now, updated_at: now });
console.log(`Admin user seeded: ${username}`);
```

- [ ] **Step 9: Verify auth**

Run:

```powershell
npm run typecheck
npm test -- tests/unit/auth.test.ts tests/unit/db.test.ts
npm run build
```

Expected:

```text
typecheck exits 0
PASS tests/unit/auth.test.ts
PASS tests/unit/db.test.ts
next build exits 0
```

- [ ] **Step 10: Commit auth**

```powershell
git add src/lib/auth src/middleware.ts src/app/admin/login src/app/api/admin/login src/app/api/admin/logout scripts/seed-admin.ts src/lib/db/schema.sql tests/unit/auth.test.ts
git commit -m "feat: add single admin authentication"
```

## Task 6: Admin Notes CRUD And Markdown Editor

**Files:**
- Create: `src/components/admin/AdminNav.tsx`
- Create: `src/components/admin/MarkdownEditor.tsx`
- Create: `src/components/admin/NoteForm.tsx`
- Create: `src/app/admin/layout.tsx`
- Create: `src/app/admin/page.tsx`
- Create: `src/app/admin/notes/page.tsx`
- Create: `src/app/admin/notes/new/page.tsx`
- Create: `src/app/admin/notes/[id]/edit/page.tsx`
- Create: `src/app/api/admin/notes/route.ts`
- Create: `src/app/api/admin/notes/[id]/route.ts`
- Modify: `src/lib/db/notes.ts`
- Test: `tests/unit/admin-note-validation.test.ts`

- [ ] **Step 1: Add validation schema test**

Create `tests/unit/admin-note-validation.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { noteInputSchema } from '@/lib/validation';

describe('admin note validation', () => {
  it('accepts a valid Markdown note', () => {
    const result = noteInputSchema.parse({
      title: '本地笔记',
      summary: '摘要',
      contentMarkdown: '# 本地笔记',
      status: 'public',
      tags: '阅读, 工具'
    });
    expect(result.title).toBe('本地笔记');
  });

  it('rejects an empty title', () => {
    expect(() => noteInputSchema.parse({
      title: '',
      summary: '',
      contentMarkdown: '正文',
      status: 'draft',
      tags: ''
    })).toThrow();
  });
});
```

- [ ] **Step 2: Implement validation**

Create `src/lib/validation.ts`:

```ts
import { z } from 'zod';

export const noteInputSchema = z.object({
  title: z.string().trim().min(1, '标题不能为空'),
  summary: z.string().trim().max(240, '摘要不能超过 240 个字符'),
  contentMarkdown: z.string().trim().min(1, '正文不能为空'),
  status: z.enum(['public', 'draft', 'archived']),
  tags: z.string().transform((value) => value.split(',').map((item) => item.trim()).filter(Boolean))
});
```

- [ ] **Step 3: Extend note repository with update and admin list**

Add these exports to `src/lib/db/notes.ts`:

```ts
export function listAdminNotes(db: Database.Database) {
  return db.prepare('select * from notes order by updated_at desc').all() as NoteRecord[];
}

export function updateLocalNote(db: Database.Database, id: string, input: Omit<CreateNoteInput, 'sourceType' | 'sourceId'>) {
  const existing = getNoteById(db, id);
  if (!existing || existing.source_type !== 'local') return undefined;
  const now = new Date().toISOString();
  db.prepare(`
    update notes
    set title = @title,
        summary = @summary,
        content_markdown = @content_markdown,
        content_html = @content_html,
        status = @status,
        updated_at = @updated_at
    where id = @id and source_type = 'local'
  `).run({
    id,
    title: input.title,
    summary: input.summary,
    content_markdown: input.contentMarkdown,
    content_html: input.contentHtml,
    status: input.status,
    updated_at: now
  });
  upsertTags(db, id, input.tags);
  return getNoteById(db, id);
}
```

- [ ] **Step 4: Create admin UI components**

Create `src/components/admin/AdminNav.tsx`:

```tsx
export function AdminNav() {
  return (
    <nav className="flex min-h-screen w-56 flex-col gap-2 border-r border-[var(--line)] bg-[var(--surface)] p-5 text-sm">
      <a href="/admin">总览</a>
      <a href="/admin/notes">全部笔记</a>
      <a href="/admin/notes/new">新建笔记</a>
      <a href="/admin/sync">飞书同步</a>
      <a href="/admin/settings">站点设置</a>
      <form action="/api/admin/logout" method="post" className="mt-auto">
        <button type="submit">退出登录</button>
      </form>
    </nav>
  );
}
```

Create `src/components/admin/MarkdownEditor.tsx` as a textarea and preview pane:

```tsx
'use client';

import { useMemo, useState } from 'react';

export function MarkdownEditor({ defaultValue }: { defaultValue?: string }) {
  const [value, setValue] = useState(defaultValue ?? '');
  const preview = useMemo(() => value.replace(/^# (.+)$/gm, '<h1>$1</h1>').replace(/\n/g, '<br>'), [value]);
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <textarea
        name="contentMarkdown"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        className="min-h-96 w-full border border-[var(--line)] bg-white p-4 font-mono text-sm"
      />
      <div className="min-h-96 border border-[var(--line)] bg-[var(--surface)] p-4" dangerouslySetInnerHTML={{ __html: preview }} />
    </div>
  );
}
```

Create `NoteForm` that posts `title`, `summary`, `tags`, `status`, and `contentMarkdown` to the supplied action URL.

- [ ] **Step 5: Create admin pages and note API routes**

Implement:

- `/admin`: dashboard counts using `listAdminNotes()`.
- `/admin/notes`: table with title, source, status, updated time, edit link.
- `/admin/notes/new`: `NoteForm` with action `/api/admin/notes`.
- `/admin/notes/[id]/edit`: allow editing only local notes; show Chinese message for Feishu-synced notes: `飞书同步笔记不能在网站后台编辑正文。`
- `POST /api/admin/notes`: validate form, render Markdown, create local note, redirect to edit page.
- `POST /api/admin/notes/[id]`: validate form, render Markdown, update local note, redirect back.

- [ ] **Step 6: Verify admin CRUD**

Run:

```powershell
npm run typecheck
npm test -- tests/unit/admin-note-validation.test.ts tests/unit/notes-repository.test.ts
npm run build
```

Expected:

```text
typecheck exits 0
PASS tests/unit/admin-note-validation.test.ts
PASS tests/unit/notes-repository.test.ts
next build exits 0
```

- [ ] **Step 7: Commit admin CRUD**

```powershell
git add src/app/admin src/app/api/admin/notes src/components/admin src/lib/validation.ts src/lib/db/notes.ts tests/unit/admin-note-validation.test.ts
git commit -m "feat: add admin markdown note management"
```

## Task 7: Tags And Chinese Search

**Files:**
- Modify: `src/lib/db/notes.ts`
- Modify: `src/app/(public)/search/page.tsx`
- Modify: `src/app/(public)/tags/page.tsx`
- Modify: `src/app/(public)/tags/[slug]/page.tsx`
- Test: `tests/unit/search.test.ts`

- [ ] **Step 1: Write failing search tests**

Create `tests/unit/search.test.ts`:

```ts
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import { runMigrations } from '@/lib/db/migrate';
import { createNote, findPublicNotes, listTags } from '@/lib/db/notes';

describe('Chinese search and tags', () => {
  it('matches Chinese query in title, summary, and body', () => {
    const dir = mkdtempSync(join(tmpdir(), 'notes-search-'));
    const db = new Database(join(dir, 'test.sqlite'));
    runMigrations(db);
    createNote(db, {
      sourceType: 'local',
      title: '阅读系统',
      summary: '关于长期问题',
      contentMarkdown: '这里讨论工具选择',
      contentHtml: '<p>这里讨论工具选择</p>',
      status: 'public',
      tags: ['阅读']
    });

    expect(findPublicNotes(db, { query: '长期', tagSlug: null })).toHaveLength(1);
    expect(findPublicNotes(db, { query: '工具', tagSlug: null })).toHaveLength(1);
    expect(listTags(db)[0].name).toBe('阅读');

    db.close();
    rmSync(dir, { recursive: true, force: true });
  });
});
```

- [ ] **Step 2: Implement `listTags` and ensure search path uses it**

Add to `src/lib/db/notes.ts`:

```ts
export function listTags(db: Database.Database) {
  return db.prepare(`
    select t.id, t.name, t.slug, count(nt.note_id) as note_count
    from tags t
    left join note_tags nt on nt.tag_id = t.id
    left join notes n on n.id = nt.note_id and n.status = 'public'
    group by t.id, t.name, t.slug
    order by t.name asc
  `).all() as { id: string; name: string; slug: string; note_count: number }[];
}
```

- [ ] **Step 3: Wire public search and tag pages**

Use query param `q` on `/search`. Keep Chinese labels:

```tsx
<label>
  <span>搜索标题、摘要或正文</span>
  <input name="q" defaultValue={query} />
</label>
<button type="submit">搜索</button>
```

For `/tags`, render all tag names with counts. For `/tags/[slug]`, show `标签：{name}` when the tag exists and `没有找到这个标签。` when absent.

- [ ] **Step 4: Verify search**

Run:

```powershell
npm run typecheck
npm test -- tests/unit/search.test.ts
npm run build
```

Expected:

```text
typecheck exits 0
PASS tests/unit/search.test.ts
next build exits 0
```

- [ ] **Step 5: Commit search and tags**

```powershell
git add src/lib/db/notes.ts src/app/(public)/search src/app/(public)/tags tests/unit/search.test.ts
git commit -m "feat: add Chinese search and tag browsing"
```

## Task 8: Feishu Sync Domain And API Client

**Files:**
- Create: `src/lib/feishu/types.ts`
- Create: `src/lib/feishu/client.ts`
- Create: `src/lib/feishu/blocks-to-markdown.ts`
- Create: `src/lib/feishu/sync.ts`
- Create: `scripts/sync-feishu.ts`
- Modify: `src/lib/db/notes.ts`
- Modify: `src/lib/db/sync-runs.ts`
- Test: `tests/unit/feishu-sync.test.ts`

- [ ] **Step 1: Write failing sync test with fake client**

Create `tests/unit/feishu-sync.test.ts`:

```ts
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import { runMigrations } from '@/lib/db/migrate';
import { getNoteById } from '@/lib/db/notes';
import { syncFeishuPages } from '@/lib/feishu/sync';
import type { FeishuClient } from '@/lib/feishu/types';

describe('Feishu sync', () => {
  it('creates public notes from Feishu pages and records sync stats', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'notes-feishu-'));
    const db = new Database(join(dir, 'test.sqlite'));
    runMigrations(db);

    const client: FeishuClient = {
      async listWikiPages() {
        return [{ sourceId: 'doc-1', title: '飞书公开笔记', parentSourceId: null, updatedAt: '2026-05-31T00:00:00.000Z' }];
      },
      async getDocumentBlocks() {
        return [{ type: 'text', text: '飞书正文', level: 0 }];
      },
      async downloadAsset() {
        return null;
      }
    };

    const result = await syncFeishuPages({ db, client, uploadDir: join(dir, 'uploads') });

    expect(result.status).toBe('success');
    expect(result.stats.created).toBe(1);
    const note = getNoteById(db, result.noteIds[0]);
    expect(note?.title).toBe('飞书公开笔记');
    expect(note?.status).toBe('public');

    db.close();
    rmSync(dir, { recursive: true, force: true });
  });
});
```

- [ ] **Step 2: Define Feishu interfaces**

Create `src/lib/feishu/types.ts`:

```ts
export type FeishuWikiPage = {
  sourceId: string;
  title: string;
  parentSourceId: string | null;
  updatedAt: string;
};

export type FeishuBlock =
  | { type: 'text'; text: string; level: number }
  | { type: 'heading'; text: string; level: 1 | 2 | 3 }
  | { type: 'bullet'; text: string; level: number }
  | { type: 'image'; token: string; alt: string };

export type FeishuClient = {
  listWikiPages(): Promise<FeishuWikiPage[]>;
  getDocumentBlocks(documentId: string): Promise<FeishuBlock[]>;
  downloadAsset(token: string, targetPath: string): Promise<string | null>;
};
```

- [ ] **Step 3: Implement block conversion**

Create `src/lib/feishu/blocks-to-markdown.ts`:

```ts
import type { FeishuBlock } from './types';

export function blocksToMarkdown(blocks: FeishuBlock[]) {
  return blocks.map((block) => {
    if (block.type === 'heading') return `${'#'.repeat(block.level)} ${block.text}`;
    if (block.type === 'bullet') return `${'  '.repeat(block.level)}- ${block.text}`;
    if (block.type === 'image') return `![${block.alt}](/uploads/feishu/${block.token})`;
    return block.text;
  }).join('\n\n');
}
```

- [ ] **Step 4: Add sync run repository**

Create `src/lib/db/sync-runs.ts`:

```ts
import { randomUUID } from 'node:crypto';
import type Database from 'better-sqlite3';

export function startSyncRun(db: Database.Database) {
  const id = randomUUID();
  db.prepare(`
    insert into sync_runs (id, status, started_at, message, stats_json)
    values (?, 'running', ?, '', '{}')
  `).run(id, new Date().toISOString());
  return id;
}

export function finishSyncRun(db: Database.Database, id: string, input: { status: 'success' | 'failed' | 'partial'; message: string; stats: unknown }) {
  db.prepare(`
    update sync_runs
    set status = ?, finished_at = ?, message = ?, stats_json = ?
    where id = ?
  `).run(input.status, new Date().toISOString(), input.message, JSON.stringify(input.stats), id);
}

export function latestSyncRun(db: Database.Database) {
  return db.prepare('select * from sync_runs order by started_at desc limit 1').get();
}
```

- [ ] **Step 5: Implement sync orchestration**

Create `src/lib/feishu/sync.ts`:

```ts
import type Database from 'better-sqlite3';
import { createNote, markMissingFeishuNotesRemoved } from '@/lib/db/notes';
import { finishSyncRun, startSyncRun } from '@/lib/db/sync-runs';
import { renderMarkdown } from '@/lib/markdown/render';
import { summarizeMarkdown } from '@/lib/markdown/summarize';
import { blocksToMarkdown } from './blocks-to-markdown';
import type { FeishuClient } from './types';

export async function syncFeishuPages(input: { db: Database.Database; client: FeishuClient; uploadDir: string }) {
  const runId = startSyncRun(input.db);
  const stats = { created: 0, updated: 0, removed: 0, failed: 0 };
  const noteIds: string[] = [];
  try {
    const pages = await input.client.listWikiPages();
    for (const page of pages) {
      const blocks = await input.client.getDocumentBlocks(page.sourceId);
      const markdown = blocksToMarkdown(blocks);
      const html = await renderMarkdown(markdown);
      const note = createNote(input.db, {
        sourceType: 'feishu',
        sourceId: page.sourceId,
        title: page.title,
        summary: summarizeMarkdown(markdown),
        contentMarkdown: markdown,
        contentHtml: html,
        status: 'public',
        tags: [],
        parentId: page.parentSourceId,
        sourceUpdatedAt: page.updatedAt
      });
      stats.created += 1;
      noteIds.push(note.id);
    }
    markMissingFeishuNotesRemoved(input.db, pages.map((page) => page.sourceId));
    finishSyncRun(input.db, runId, { status: 'success', message: '同步成功', stats });
    return { status: 'success' as const, stats, noteIds };
  } catch (error) {
    stats.failed += 1;
    finishSyncRun(input.db, runId, { status: 'failed', message: error instanceof Error ? error.message : '同步失败', stats });
    return { status: 'failed' as const, stats, noteIds };
  }
}
```

- [ ] **Step 6: Run failing sync test and fix repository upsert**

Run:

```powershell
npm test -- tests/unit/feishu-sync.test.ts
```

Expected first result:

```text
FAIL because Feishu notes with the same source_id need upsert behavior
```

Modify `src/lib/db/notes.ts` by adding `upsertFeishuNote()` and making sync call it instead of `createNote()` for Feishu pages. The function must update existing `source_type = 'feishu'` rows by `source_id`, preserve the same `id`, set `status = 'public'`, update `synced_at`, and update tags.

- [ ] **Step 7: Implement live Feishu client**

Create `src/lib/feishu/client.ts` with:

```ts
const FEISHU_BASE = 'https://open.feishu.cn/open-apis';

export class HttpFeishuClient {
  constructor(
    private readonly appId: string,
    private readonly appSecret: string,
    private readonly source: string
  ) {}

  async tenantToken() {
    const response = await fetch(`${FEISHU_BASE}/auth/v3/tenant_access_token/internal`, {
      method: 'POST',
      headers: { 'content-type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ app_id: this.appId, app_secret: this.appSecret })
    });
    const json = await response.json() as { code: number; msg?: string; tenant_access_token?: string };
    if (json.code !== 0 || !json.tenant_access_token) throw new Error(json.msg ?? '获取飞书访问凭证失败');
    return json.tenant_access_token;
  }

  async request<T>(path: string) {
    const token = await this.tenantToken();
    const response = await fetch(`${FEISHU_BASE}${path}`, {
      headers: { authorization: `Bearer ${token}` }
    });
    if (!response.ok) throw new Error(`飞书接口请求失败：${response.status}`);
    return response.json() as Promise<T>;
  }
}
```

Extend the class to implement `FeishuClient`. Use official Wiki and Docx docs to map Wiki nodes to document IDs and block payloads to `FeishuBlock`. Add exponential backoff for HTTP 400 with Feishu rate-limit code `99991400`.

- [ ] **Step 8: Create CLI sync script**

Create `scripts/sync-feishu.ts`:

```ts
import { getDatabase } from '../src/lib/db/client';
import { HttpFeishuClient } from '../src/lib/feishu/client';
import { syncFeishuPages } from '../src/lib/feishu/sync';

const appId = process.env.FEISHU_APP_ID;
const appSecret = process.env.FEISHU_APP_SECRET;
const source = process.env.FEISHU_SYNC_SOURCE;
const uploadDir = process.env.UPLOAD_DIR ?? './uploads';

if (!appId || !appSecret || !source) {
  console.error('FEISHU_APP_ID, FEISHU_APP_SECRET, and FEISHU_SYNC_SOURCE are required');
  process.exit(1);
}

const result = await syncFeishuPages({
  db: getDatabase(),
  client: new HttpFeishuClient(appId, appSecret, source),
  uploadDir
});

console.log(JSON.stringify(result, null, 2));
process.exit(result.status === 'failed' ? 1 : 0);
```

- [ ] **Step 9: Verify sync domain**

Run:

```powershell
npm run typecheck
npm test -- tests/unit/feishu-sync.test.ts
```

Expected:

```text
typecheck exits 0
PASS tests/unit/feishu-sync.test.ts
```

- [ ] **Step 10: Commit Feishu sync domain**

```powershell
git add src/lib/feishu src/lib/db/notes.ts src/lib/db/sync-runs.ts scripts/sync-feishu.ts tests/unit/feishu-sync.test.ts
git commit -m "feat: add Feishu sync service"
```

## Task 9: Sync Dashboard And Settings

**Files:**
- Create: `src/components/admin/SyncStatusPanel.tsx`
- Create: `src/app/admin/sync/page.tsx`
- Create: `src/app/admin/settings/page.tsx`
- Create: `src/app/api/admin/sync/route.ts`
- Create: `src/app/api/admin/settings/route.ts`
- Modify: `src/lib/db/settings.ts`
- Test: `tests/unit/settings.test.ts`

- [ ] **Step 1: Implement settings repository with test**

Create `tests/unit/settings.test.ts` verifying `getSetting()` and `setSetting()` for `site_name`, `site_description`, and `feishu_sync_source`.

Create `src/lib/db/settings.ts`:

```ts
import type Database from 'better-sqlite3';

export function getSetting(db: Database.Database, key: string) {
  const row = db.prepare('select value from settings where key = ?').get(key) as { value: string } | undefined;
  return row?.value ?? '';
}

export function setSetting(db: Database.Database, key: string, value: string) {
  db.prepare(`
    insert into settings (key, value, updated_at)
    values (?, ?, ?)
    on conflict(key) do update set value = excluded.value, updated_at = excluded.updated_at
  `).run(key, value, new Date().toISOString());
}
```

- [ ] **Step 2: Build Chinese settings page**

Create `/admin/settings` with fields:

- `站点名称`
- `站点简介`
- `飞书同步源`

Submit to `POST /api/admin/settings`, validate non-empty site name, save values, redirect back with `?saved=1`.

- [ ] **Step 3: Build sync dashboard**

Create `/admin/sync` showing:

- 上次同步状态。
- 开始时间和结束时间。
- 新增、更新、下架、失败数量.
- 失败原因.
- Button `立即同步`.

`POST /api/admin/sync` runs `syncFeishuPages()` using env credentials and returns to `/admin/sync`.

- [ ] **Step 4: Verify dashboard and settings**

Run:

```powershell
npm run typecheck
npm test -- tests/unit/settings.test.ts tests/unit/feishu-sync.test.ts
npm run build
```

Expected:

```text
typecheck exits 0
PASS tests/unit/settings.test.ts
PASS tests/unit/feishu-sync.test.ts
next build exits 0
```

- [ ] **Step 5: Commit sync dashboard**

```powershell
git add src/components/admin/SyncStatusPanel.tsx src/app/admin/sync src/app/admin/settings src/app/api/admin/sync src/app/api/admin/settings src/lib/db/settings.ts tests/unit/settings.test.ts
git commit -m "feat: add sync dashboard and site settings"
```

## Task 10: Assets, Backup, And Health Check

**Files:**
- Create: `src/app/api/health/route.ts`
- Create: `scripts/backup.ts`
- Modify: `src/lib/feishu/client.ts`
- Modify: `src/lib/feishu/sync.ts`
- Test: `tests/unit/backup.test.ts`

- [ ] **Step 1: Add health endpoint**

Create `src/app/api/health/route.ts`:

```ts
import { NextResponse } from 'next/server';
import { getDatabase } from '@/lib/db/client';

export function GET() {
  getDatabase().prepare('select 1').get();
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Implement backup script**

Create `scripts/backup.ts`:

```ts
import { copyFileSync, cpSync, mkdirSync } from 'node:fs';
import { basename, join } from 'node:path';

const databasePath = process.env.DATABASE_PATH ?? './data/notes.sqlite';
const uploadDir = process.env.UPLOAD_DIR ?? './uploads';
const backupDir = process.env.BACKUP_DIR ?? './backups';
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const target = join(backupDir, stamp);

mkdirSync(target, { recursive: true });
copyFileSync(databasePath, join(target, basename(databasePath)));
cpSync(uploadDir, join(target, 'uploads'), { recursive: true, force: true });
console.log(`Backup created: ${target}`);
```

- [ ] **Step 3: Wire asset download behavior**

In `HttpFeishuClient.downloadAsset()`, write downloaded bytes to `uploads/feishu/<token>` and return `/uploads/feishu/<token>`. If a download fails, return `null`. In `syncFeishuPages()`, keep the note body and write a Chinese warning into the sync run message when an asset returns `null`.

- [ ] **Step 4: Verify backup and health code**

Run:

```powershell
npm run typecheck
npm test
npm run build
```

Expected:

```text
typecheck exits 0
all Vitest tests pass
next build exits 0
```

- [ ] **Step 5: Commit assets and backup**

```powershell
git add src/app/api/health scripts/backup.ts src/lib/feishu
git commit -m "feat: add assets backup and health check"
```

## Task 11: Docker Compose And Deployment Docs

**Files:**
- Create: `Dockerfile`
- Create: `docker-compose.yml`
- Create: `docker/Caddyfile`
- Create: `docs/deployment.md`
- Modify: `.env.example`

- [ ] **Step 1: Create environment example**

Create `.env.example`:

```dotenv
NODE_ENV=production
DATABASE_PATH=/app/data/notes.sqlite
UPLOAD_DIR=/app/uploads
BACKUP_DIR=/app/backups
ADMIN_USERNAME=admin
ADMIN_PASSWORD=change-this-password
FEISHU_APP_ID=cli_xxx
FEISHU_APP_SECRET=xxx
FEISHU_SYNC_SOURCE=wiki_space_or_parent_token
NEXT_PUBLIC_SITE_URL=https://weixianmanbu.shop
```

- [ ] **Step 2: Create Dockerfile**

Create `Dockerfile`:

```dockerfile
FROM node:22-bookworm-slim AS deps
WORKDIR /app
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci

FROM deps AS builder
WORKDIR /app
COPY . .
RUN npm run build

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/package-lock.json ./package-lock.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/src ./src
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/next.config.mjs ./next.config.mjs
RUN mkdir -p /app/data /app/uploads /app/backups
EXPOSE 3000
CMD ["npm", "run", "start"]
```

- [ ] **Step 3: Create Docker Compose**

Create `docker-compose.yml`:

```yaml
services:
  app:
    build: .
    restart: unless-stopped
    env_file:
      - .env
    volumes:
      - ./data:/app/data
      - ./uploads:/app/uploads
      - ./backups:/app/backups
    healthcheck:
      test: ["CMD", "node", "-e", "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
      interval: 30s
      timeout: 5s
      retries: 3

  proxy:
    image: caddy:2
    restart: unless-stopped
    depends_on:
      app:
        condition: service_healthy
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./docker/Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy_data:/data
      - caddy_config:/config

volumes:
  caddy_data:
  caddy_config:
```

- [ ] **Step 4: Create Caddyfile**

Create `docker/Caddyfile`:

```caddyfile
weixianmanbu.shop {
  encode zstd gzip
  reverse_proxy app:3000
}
```

- [ ] **Step 5: Write deployment docs**

Create `docs/deployment.md` with exact commands:

```markdown
# 部署说明

1. 在域名 DNS 控制台中添加 A 记录：`weixianmanbu.shop -> 115.29.175.216`。
2. 在服务器开放 80 和 443 端口。
3. 安装 Docker 和 Docker Compose。
4. 上传代码到服务器。
5. 复制环境变量文件：

```bash
cp .env.example .env
```

6. 编辑 `.env`，填写管理员密码和飞书应用凭证。
7. 启动服务：

```bash
docker compose up -d --build
```

8. 创建管理员：

```bash
docker compose exec app npm run seed:admin
```

9. 查看健康检查：

```bash
curl https://weixianmanbu.shop/api/health
```

10. 手动同步飞书：

```bash
docker compose exec app npm run sync:feishu
```
```

- [ ] **Step 6: Verify Docker assets**

Run:

```powershell
npm run build
docker compose config
```

Expected:

```text
next build exits 0
docker compose config exits 0 and prints normalized services
```

- [ ] **Step 7: Commit deployment files**

```powershell
git add Dockerfile docker-compose.yml docker/Caddyfile docs/deployment.md .env.example
git commit -m "chore: add Docker deployment"
```

## Task 12: End-To-End Tests And Final Verification

**Files:**
- Create: `tests/e2e/public.spec.ts`
- Create: `tests/e2e/admin.spec.ts`
- Modify: `package.json`

- [ ] **Step 1: Install Playwright browsers**

Run:

```powershell
npx playwright install chromium
```

Expected:

```text
Chromium browser installed
```

- [ ] **Step 2: Create public E2E test**

Create `tests/e2e/public.spec.ts`:

```ts
import { expect, test } from '@playwright/test';

test('public home is a Chinese notes site', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('未闲漫步')).toBeVisible();
  await expect(page.getByText('最近在想什么')).toBeVisible();
  await expect(page.getByRole('link', { name: '笔记' })).toBeVisible();
  await expect(page.getByRole('link', { name: '标签' })).toBeVisible();
});
```

- [ ] **Step 3: Create admin login E2E test**

Create `tests/e2e/admin.spec.ts`:

```ts
import { expect, test } from '@playwright/test';

test('admin area redirects to Chinese login page', async ({ page }) => {
  await page.goto('/admin');
  await expect(page).toHaveURL(/\/admin\/login/);
  await expect(page.getByRole('heading', { name: '登录后台' })).toBeVisible();
});
```

- [ ] **Step 4: Run full verification**

Run:

```powershell
npm run typecheck
npm test
npm run build
npm run e2e
docker compose config
```

Expected:

```text
typecheck exits 0
all Vitest tests pass
next build exits 0
Playwright tests pass on desktop and mobile projects
docker compose config exits 0
```

- [ ] **Step 5: Commit E2E tests**

```powershell
git add tests/e2e package.json package-lock.json playwright.config.ts
git commit -m "test: add notes site end-to-end coverage"
```

## Task 13: Server Deployment Runbook

**Files:**
- Modify: `docs/deployment.md`

- [ ] **Step 1: Add server preparation commands**

Append to `docs/deployment.md`:

```markdown
## 服务器准备

```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl gnupg
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo systemctl enable docker
sudo systemctl start docker
```
```

- [ ] **Step 2: Add release checklist**

Append:

```markdown
## 发布检查

- DNS A 记录已经指向 `115.29.175.216`。
- 服务器 80 和 443 端口已开放。
- `.env` 已填写强密码和飞书凭证。
- `docker compose up -d --build` 成功。
- `docker compose ps` 显示 `app` 和 `proxy` 都在运行。
- `curl https://weixianmanbu.shop/api/health` 返回 `{"ok":true}`。
- 后台 `/admin/login` 可以打开。
- 首次手动飞书同步已成功或后台能看到中文失败原因。
```

- [ ] **Step 3: Commit runbook**

```powershell
git add docs/deployment.md
git commit -m "docs: add deployment runbook"
```

## Final Verification Checklist

Before reporting implementation completion, run:

```powershell
git status --short
npm run typecheck
npm test
npm run build
npm run e2e
docker compose config
```

Expected:

```text
git status --short is empty
typecheck exits 0
all Vitest tests pass
next build exits 0
all Playwright tests pass
docker compose config exits 0
```

## Spec Coverage Review

- 中文前台：首页、列表、详情、标签、搜索、关于页 covered by Tasks 4 and 7.
- 单管理员后台：login, dashboard, notes, sync, settings covered by Tasks 5, 6, and 9.
- Markdown editor and local notes covered by Task 6.
- Feishu Wiki sync, local storage, removed notes, and failure logging covered by Task 8 and Task 9.
- SQLite persistence covered by Task 2.
- Local images, backup, and health check covered by Task 10.
- Docker Compose, Caddy, HTTPS, and deployment runbook covered by Tasks 11 and 13.
- Tests for login, notes, public rendering, search, sync, image failure logging, and Docker configuration covered throughout Tasks 2 through 12.

## Plan Self-Review

- Completeness scan: no unresolved markers or vague file names are intentionally present in this plan.
- Type consistency: note status values are `public`, `draft`, `archived`, and `removed`; source values are `feishu` and `local`; these names match the spec and schema.
- Scope fit: the plan produces one working deployable site and defers only extensions listed in the approved spec.
