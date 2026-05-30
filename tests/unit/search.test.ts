import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import { runMigrations } from '@/lib/db/migrate';
import {
  createNote,
  findPublicNotes,
  findTagBySlug,
  listTags,
} from '@/lib/db/notes';

function createTestDatabase() {
  const db = new Database(':memory:');
  runMigrations(db);
  return db;
}

describe('Chinese public search and tags', () => {
  it('matches Chinese queries against public note titles, summaries, and markdown content', () => {
    const db = createTestDatabase();

    const titleMatch = createNote(db, {
      sourceType: 'local',
      title: '山路上的清晨',
      summary: '不包含关键词',
      contentMarkdown: '正文也没有目标词',
      status: 'public',
    });
    const summaryMatch = createNote(db, {
      sourceType: 'local',
      title: '普通标题',
      summary: '这里写着山路的气味',
      contentMarkdown: '正文也没有目标词',
      status: 'public',
    });
    const contentMatch = createNote(db, {
      sourceType: 'local',
      title: '另一篇',
      summary: '普通摘要',
      contentMarkdown: '真正的山路藏在正文里。',
      status: 'public',
    });
    createNote(db, {
      sourceType: 'local',
      title: '无关公开笔记',
      summary: '普通摘要',
      contentMarkdown: '普通正文',
      status: 'public',
    });

    const resultIds = findPublicNotes(db, { query: '山路' }).map((note) => note.id);

    expect(resultIds).toEqual(expect.arrayContaining([titleMatch.id, summaryMatch.id, contentMatch.id]));
    expect(resultIds).toHaveLength(3);
  });

  it('excludes draft, archived, and removed notes from search results', () => {
    const db = createTestDatabase();

    const publicNote = createNote(db, {
      sourceType: 'local',
      title: '公开山路',
      status: 'public',
    });

    for (const status of ['draft', 'archived', 'removed'] as const) {
      createNote(db, {
        sourceType: 'local',
        title: `${status} 山路`,
        status,
      });
    }

    expect(findPublicNotes(db, { query: '山路' }).map((note) => note.id)).toEqual([publicNote.id]);
  });

  it('treats SQL LIKE wildcard characters in search text as literal user input', () => {
    const db = createTestDatabase();

    const literalPercentNote = createNote(db, {
      sourceType: 'local',
      title: '百分号笔记',
      summary: '增长 100% 的小实验',
      status: 'public',
    });
    createNote(db, {
      sourceType: 'local',
      title: '普通公开笔记',
      summary: '没有特殊字符',
      status: 'public',
    });

    expect(findPublicNotes(db, { query: '%' }).map((note) => note.id)).toEqual([literalPercentNote.id]);
  });

  it('counts only tags attached to public notes and hides draft-only tags', () => {
    const db = createTestDatabase();

    createNote(db, {
      sourceType: 'local',
      title: '公开技术笔记',
      status: 'public',
      tags: ['技术', '阅读'],
    });
    createNote(db, {
      sourceType: 'local',
      title: '公开技术复盘',
      status: 'public',
      tags: ['技术'],
    });
    createNote(db, {
      sourceType: 'local',
      title: '草稿里的标签',
      status: 'draft',
      tags: ['技术', '私密'],
    });

    expect(listTags(db)).toEqual([
      { id: expect.any(String), name: '技术', slug: encodeURIComponent('技术'), note_count: 2 },
      { id: expect.any(String), name: '阅读', slug: encodeURIComponent('阅读'), note_count: 1 },
    ]);
  });

  it('returns undefined for draft-only tag slugs', () => {
    const db = createTestDatabase();

    createNote(db, {
      sourceType: 'local',
      title: '草稿',
      status: 'draft',
      tags: ['私密'],
    });

    expect(findTagBySlug(db, encodeURIComponent('私密'))).toBeUndefined();
  });

  it('filters tag detail results to public notes under that public tag', () => {
    const db = createTestDatabase();

    const publicTagged = createNote(db, {
      sourceType: 'local',
      title: '公开技术笔记',
      status: 'public',
      tags: ['技术'],
    });
    createNote(db, {
      sourceType: 'local',
      title: '公开阅读笔记',
      status: 'public',
      tags: ['阅读'],
    });
    createNote(db, {
      sourceType: 'local',
      title: '草稿技术笔记',
      status: 'draft',
      tags: ['技术'],
    });

    expect(findPublicNotes(db, { tagSlug: encodeURIComponent('技术') }).map((note) => note.id)).toEqual([
      publicTagged.id,
    ]);
  });

  it('finds Chinese tag slugs encoded with encodeURIComponent', () => {
    const db = createTestDatabase();

    createNote(db, {
      sourceType: 'local',
      title: '中文标签笔记',
      status: 'public',
      tags: ['技术'],
    });

    expect(findTagBySlug(db, encodeURIComponent('技术'))?.name).toBe('技术');
    expect(findPublicNotes(db, { tagSlug: encodeURIComponent('技术') })).toHaveLength(1);
  });
});
