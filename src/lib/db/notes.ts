import { randomUUID } from 'node:crypto';
import type { Database as DatabaseConnection } from 'better-sqlite3';

export type NoteStatus = 'public' | 'draft' | 'archived' | 'removed';
export type SourceType = 'feishu' | 'local';

export type NoteRecord = {
  id: string;
  sourceType: SourceType;
  sourceId?: string;
  title: string;
  slug: string;
  summary: string;
  contentMarkdown: string;
  contentHtml: string;
  status: NoteStatus;
  parentId?: string;
  sourceUpdatedAt?: string;
  syncedAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type CreateNoteInput = {
  sourceType: SourceType;
  sourceId?: string;
  title: string;
  summary?: string;
  contentMarkdown?: string;
  contentHtml?: string;
  status: NoteStatus;
  parentId?: string;
  sourceUpdatedAt?: string;
  syncedAt?: string;
  tags?: string[];
};

export type UpdateLocalNoteInput = {
  title: string;
  summary: string;
  contentMarkdown: string;
  contentHtml: string;
  status: Exclude<NoteStatus, 'removed'>;
  tags?: string[];
};

type NoteRow = {
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

type TagRow = {
  id: string;
  name?: string;
  slug?: string;
  note_count?: number;
};

export type TagRecord = {
  id: string;
  name: string;
  slug: string;
  note_count: number;
};

export function createNote(db: DatabaseConnection, input: CreateNoteInput): NoteRecord {
  const create = db.transaction(() => {
    const now = new Date().toISOString();
    const id = randomUUID();

    db.prepare(`
      insert into notes (
        id,
        source_type,
        source_id,
        title,
        slug,
        summary,
        content_markdown,
        content_html,
        status,
        parent_id,
        source_updated_at,
        synced_at,
        created_at,
        updated_at
      )
      values (
        @id,
        @sourceType,
        @sourceId,
        @title,
        @slug,
        @summary,
        @contentMarkdown,
        @contentHtml,
        @status,
        @parentId,
        @sourceUpdatedAt,
        @syncedAt,
        @createdAt,
        @updatedAt
      )
    `).run({
      id,
      sourceType: input.sourceType,
      sourceId: input.sourceId ?? null,
      title: input.title,
      slug: id,
      summary: input.summary ?? '',
      contentMarkdown: input.contentMarkdown ?? '',
      contentHtml: input.contentHtml ?? '',
      status: input.status,
      parentId: input.parentId ?? null,
      sourceUpdatedAt: input.sourceUpdatedAt ?? null,
      syncedAt: input.syncedAt ?? null,
      createdAt: now,
      updatedAt: now,
    });

    const tagIds = upsertTags(db, input.tags ?? []);
    const linkTag = db.prepare('insert or ignore into note_tags (note_id, tag_id) values (?, ?)');

    for (const tagId of tagIds) {
      linkTag.run(id, tagId);
    }

    return getNoteById(db, id);
  });

  const note = create();

  if (!note) {
    throw new Error('Created note could not be loaded');
  }

  return note;
}

export function getNoteById(db: DatabaseConnection, id: string): NoteRecord | undefined {
  const row = db.prepare('select * from notes where id = ?').get(id) as NoteRow | undefined;
  return row ? mapNoteRow(row) : undefined;
}

export function getPublicNoteById(db: DatabaseConnection, id: string): NoteRecord | undefined {
  const row = db.prepare("select * from notes where id = ? and status = 'public'").get(id) as NoteRow | undefined;
  return row ? mapNoteRow(row) : undefined;
}

export function listAdminNotes(db: DatabaseConnection): NoteRecord[] {
  const rows = db.prepare('select * from notes order by updated_at desc, rowid desc').all() as NoteRow[];
  return rows.map(mapNoteRow);
}

export function updateLocalNote(
  db: DatabaseConnection,
  id: string,
  input: UpdateLocalNoteInput,
): NoteRecord | undefined {
  const update = db.transaction(() => {
    const existing = getNoteById(db, id);

    if (!existing || existing.sourceType !== 'local') {
      return undefined;
    }

    const now = new Date().toISOString();

    db.prepare(
      `
        update notes
        set title = ?,
            summary = ?,
            content_markdown = ?,
            content_html = ?,
            status = ?,
            updated_at = ?
        where id = ? and source_type = 'local'
      `,
    ).run(input.title, input.summary, input.contentMarkdown, input.contentHtml, input.status, now, id);

    db.prepare('delete from note_tags where note_id = ?').run(id);

    const tagIds = upsertTags(db, input.tags ?? []);
    const linkTag = db.prepare('insert or ignore into note_tags (note_id, tag_id) values (?, ?)');

    for (const tagId of tagIds) {
      linkTag.run(id, tagId);
    }

    return getNoteById(db, id);
  });

  return update();
}

export function getNoteTags(db: DatabaseConnection, noteId: string): string[] {
  const rows = db
    .prepare(
      `
        select tags.name
        from tags
        join note_tags on note_tags.tag_id = tags.id
        where note_tags.note_id = ?
        order by note_tags.rowid asc
      `,
    )
    .all(noteId) as Array<{ name: string }>;

  return rows.map((row) => row.name);
}

export function listTags(db: DatabaseConnection): TagRecord[] {
  const rows = db
    .prepare(
      `
        select tags.id, tags.name, tags.slug, count(notes.id) as note_count
        from tags
        join note_tags on note_tags.tag_id = tags.id
        join notes on notes.id = note_tags.note_id and notes.status = 'public'
        group by tags.id, tags.name, tags.slug
        order by tags.name asc
      `,
    )
    .all() as TagRecord[];

  return rows;
}

export function findTagBySlug(db: DatabaseConnection, slug: string): TagRecord | undefined {
  const row = db
    .prepare(
      `
        select tags.id, tags.name, tags.slug, count(notes.id) as note_count
        from tags
        join note_tags on note_tags.tag_id = tags.id
        join notes on notes.id = note_tags.note_id and notes.status = 'public'
        where tags.slug = ?
        group by tags.id, tags.name, tags.slug
      `,
    )
    .get(slug) as TagRecord | undefined;

  return row;
}

export function getAboutNote(db: DatabaseConnection): NoteRecord | undefined {
  const row = db
    .prepare(
      `
        select *
        from notes
        where status = 'public'
          and source_type = 'local'
          and (slug = 'about' or id = 'about' or title = '关于')
        order by updated_at desc
        limit 1
      `,
    )
    .get() as NoteRow | undefined;

  return row ? mapNoteRow(row) : undefined;
}

export function findPublicNotes(
  db: DatabaseConnection,
  filters: { query?: string; tagSlug?: string } = {},
): NoteRecord[] {
  const where = ['notes.status = ?'];
  const params: unknown[] = ['public'];
  const query = filters.query?.trim();

  if (query) {
    where.push('(notes.title like ? or notes.summary like ? or notes.content_markdown like ?)');
    const likeQuery = `%${query}%`;
    params.push(likeQuery, likeQuery, likeQuery);
  }

  if (filters.tagSlug) {
    where.push(`
      exists (
        select 1
        from note_tags
        join tags on tags.id = note_tags.tag_id
        where note_tags.note_id = notes.id and tags.slug = ?
      )
    `);
    params.push(filters.tagSlug);
  }

  const rows = db
    .prepare(`select notes.* from notes where ${where.join(' and ')} order by notes.updated_at desc`)
    .all(...params) as NoteRow[];

  return rows.map(mapNoteRow);
}

export function markMissingFeishuNotesRemoved(db: DatabaseConnection, activeSourceIds: string[]): number {
  const now = new Date().toISOString();
  const sourceIds = [...new Set(activeSourceIds)];

  if (sourceIds.length === 0) {
    const result = db
      .prepare(`
        update notes
        set status = 'removed', updated_at = ?
        where source_type = 'feishu'
          and source_id is not null
          and status != 'removed'
      `)
      .run(now);

    return result.changes;
  }

  const placeholders = sourceIds.map(() => '?').join(', ');
  const result = db
    .prepare(`
      update notes
      set status = 'removed', updated_at = ?
      where source_type = 'feishu'
        and source_id is not null
        and source_id not in (${placeholders})
        and status != 'removed'
    `)
    .run(now, ...sourceIds);

  return result.changes;
}

function upsertTags(db: DatabaseConnection, names: string[]): string[] {
  const normalizedNames = [...new Set(names.map((name) => name.trim()).filter(Boolean))];
  const insertTag = db.prepare(`
    insert into tags (id, name, slug)
    values (?, ?, ?)
    on conflict(slug) do nothing
  `);
  const findTag = db.prepare('select id from tags where slug = ?');

  return normalizedNames.map((name) => {
    const slug = encodeURIComponent(name.toLowerCase());
    insertTag.run(randomUUID(), name, slug);
    const row = findTag.get(slug) as TagRow | undefined;

    if (!row) {
      throw new Error(`Tag could not be loaded: ${name}`);
    }

    return row.id;
  });
}

function mapNoteRow(row: NoteRow): NoteRecord {
  return {
    id: row.id,
    sourceType: row.source_type,
    sourceId: row.source_id ?? undefined,
    title: row.title,
    slug: row.slug,
    summary: row.summary,
    contentMarkdown: row.content_markdown,
    contentHtml: row.content_html,
    status: row.status,
    parentId: row.parent_id ?? undefined,
    sourceUpdatedAt: row.source_updated_at ?? undefined,
    syncedAt: row.synced_at ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
