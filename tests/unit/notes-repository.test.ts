import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { afterEach, describe, expect, it } from 'vitest';
import { runMigrations } from '@/lib/db/migrate';
import {
  createNote,
  findPublicNotes,
  getNoteById,
  getNoteTags,
  listAdminNotes,
  markMissingFeishuNotesRemoved,
  updateLocalNote,
} from '@/lib/db/notes';

let currentDb: Database.Database | undefined;
let currentDir: string | undefined;

function createTestDatabase() {
  currentDir = mkdtempSync(join(tmpdir(), 'notes-repo-'));
  currentDb = new Database(join(currentDir, 'test.sqlite'));
  runMigrations(currentDb);
  return currentDb;
}

afterEach(() => {
  currentDb?.close();
  currentDb = undefined;

  if (currentDir) {
    rmSync(currentDir, { recursive: true, force: true });
    currentDir = undefined;
  }
});

describe('notes repository', () => {
  it('creates a local public note with tags and finds it for the public site', () => {
    const db = createTestDatabase();

    const publicNote = createNote(db, {
      sourceType: 'local',
      title: '山路笔记',
      summary: '沿着小路散步时记录的灵感',
      contentMarkdown: '今天在山路上看到了新的页面结构。',
      contentHtml: '<p>今天在山路上看到了新的页面结构。</p>',
      status: 'public',
      tags: ['散步', 'Next.js'],
    });

    createNote(db, {
      sourceType: 'local',
      title: '草稿笔记',
      summary: '这条还不能被公开检索',
      contentMarkdown: '山路上的草稿',
      status: 'draft',
      tags: ['散步'],
    });

    expect(publicNote.id).toEqual(expect.any(String));
    expect(publicNote.slug).toBe(publicNote.id);

    const stored = getNoteById(db, publicNote.id);
    expect(stored?.title).toBe('山路笔记');

    const results = findPublicNotes(db, {
      query: '山路',
      tagSlug: encodeURIComponent('散步'),
    });

    expect(results).toHaveLength(1);
    expect(results[0]?.id).toBe(publicNote.id);
  });

  it('marks Feishu notes outside latest sync scope as removed', () => {
    const db = createTestDatabase();

    const active = createNote(db, {
      sourceType: 'feishu',
      sourceId: 'active-source',
      title: '仍在飞书里的笔记',
      status: 'public',
    });
    const stale = createNote(db, {
      sourceType: 'feishu',
      sourceId: 'stale-source',
      title: '已经不在飞书里的笔记',
      status: 'public',
    });
    const local = createNote(db, {
      sourceType: 'local',
      title: '本地笔记',
      status: 'public',
    });

    const removedCount = markMissingFeishuNotesRemoved(db, ['active-source']);

    expect(removedCount).toBe(1);
    expect(getNoteById(db, active.id)?.status).toBe('public');
    expect(getNoteById(db, stale.id)?.status).toBe('removed');
    expect(getNoteById(db, local.id)?.status).toBe('public');
  });

  it('finds public notes when query is empty or only a tag is provided', () => {
    const db = createTestDatabase();

    const first = createNote(db, {
      sourceType: 'local',
      title: '阅读札记',
      status: 'public',
      tags: ['阅读'],
    });
    const second = createNote(db, {
      sourceType: 'local',
      title: '技术观察',
      status: 'public',
      tags: ['技术'],
    });

    const allPublic = findPublicNotes(db, { query: '   ' });
    expect(allPublic.map((note) => note.id).sort()).toEqual([first.id, second.id].sort());

    const tagOnly = findPublicNotes(db, { tagSlug: encodeURIComponent('技术') });
    expect(tagOnly).toHaveLength(1);
    expect(tagOnly[0]?.id).toBe(second.id);
  });

  it('marks all Feishu notes removed for an empty latest sync scope', () => {
    const db = createTestDatabase();

    const firstFeishu = createNote(db, {
      sourceType: 'feishu',
      sourceId: 'first-feishu',
      title: '第一条飞书笔记',
      status: 'public',
    });
    const secondFeishu = createNote(db, {
      sourceType: 'feishu',
      sourceId: 'second-feishu',
      title: '第二条飞书笔记',
      status: 'draft',
    });
    const local = createNote(db, {
      sourceType: 'local',
      title: '本地笔记',
      status: 'public',
    });

    const removedCount = markMissingFeishuNotesRemoved(db, []);

    expect(removedCount).toBe(2);
    expect(getNoteById(db, firstFeishu.id)?.status).toBe('removed');
    expect(getNoteById(db, secondFeishu.id)?.status).toBe('removed');
    expect(getNoteById(db, local.id)?.status).toBe('public');
  });

  it('lists all admin notes by updated time and updates only local notes', () => {
    const db = createTestDatabase();

    const feishu = createNote(db, {
      sourceType: 'feishu',
      sourceId: 'feishu-source',
      title: '飞书笔记',
      status: 'public',
    });
    const local = createNote(db, {
      sourceType: 'local',
      title: '旧标题',
      summary: '旧摘要',
      contentMarkdown: '旧正文',
      contentHtml: '<p>旧正文</p>',
      status: 'draft',
      tags: ['旧标签'],
    });

    const updated = updateLocalNote(db, local.id, {
      title: '新标题',
      summary: '新摘要',
      contentMarkdown: '新正文',
      contentHtml: '<p>新正文</p>',
      status: 'public',
      tags: ['新标签', 'Next.js'],
    });
    const feishuUpdate = updateLocalNote(db, feishu.id, {
      title: '不应更新',
      summary: '',
      contentMarkdown: '不应更新',
      contentHtml: '<p>不应更新</p>',
      status: 'draft',
      tags: ['不应更新'],
    });

    expect(feishuUpdate).toBeUndefined();
    expect(updated?.title).toBe('新标题');
    expect(updated?.status).toBe('public');
    expect(getNoteTags(db, local.id)).toEqual(['新标签', 'Next.js']);
    expect(getNoteById(db, feishu.id)?.title).toBe('飞书笔记');

    const adminNotes = listAdminNotes(db);
    expect(adminNotes.map((note) => note.id)).toEqual([local.id, feishu.id]);
  });
});
