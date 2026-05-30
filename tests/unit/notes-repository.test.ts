import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { afterEach, describe, expect, it } from 'vitest';
import { runMigrations } from '@/lib/db/migrate';
import { createNote, findPublicNotes, getNoteById, markMissingFeishuNotesRemoved } from '@/lib/db/notes';

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
});
