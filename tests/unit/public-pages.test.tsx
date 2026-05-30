import { render, screen } from '@testing-library/react';
import Database from 'better-sqlite3';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NoteCard } from '@/components/public/NoteCard';
import { SiteHeader } from '@/components/public/SiteHeader';
import { runMigrations } from '@/lib/db/migrate';
import {
  createNote,
  findTagBySlug,
  getAboutNote,
  getNoteTags,
  getPublicNoteById,
  listTags,
} from '@/lib/db/notes';

afterEach(() => {
  vi.doUnmock('@/lib/db/client');
  vi.resetModules();
});

describe('public reading pages', () => {
  it('renders Chinese note card content', () => {
    render(
      <NoteCard
        note={{
          id: 'n1',
          title: '第一篇公开笔记',
          summary: '这是一段中文摘要',
          updatedAt: '2026-05-31T00:00:00.000Z',
          tags: ['阅读', '工具'],
        }}
      />,
    );

    expect(screen.getByText('第一篇公开笔记')).toBeTruthy();
    expect(screen.getByText('这是一段中文摘要')).toBeTruthy();
    expect(screen.getByText('阅读')).toBeTruthy();
  });

  it('renders Chinese public navigation', () => {
    render(<SiteHeader />);
    expect(screen.getByText('未闲漫步')).toBeTruthy();
    expect(screen.getByRole('link', { name: '笔记' })).toBeTruthy();
    expect(screen.getByRole('link', { name: '标签' })).toBeTruthy();
    expect(screen.getByRole('link', { name: '搜索' })).toBeTruthy();
    expect(screen.getByRole('link', { name: '关于' })).toBeTruthy();
  });

  it('loads only public notes and public tag counts for reading pages', () => {
    const db = new Database(':memory:');
    runMigrations(db);

    const publicNote = createNote(db, {
      sourceType: 'local',
      title: '公开阅读笔记',
      status: 'public',
      tags: ['阅读', '工具'],
    });
    const draftNote = createNote(db, {
      sourceType: 'local',
      title: '草稿阅读笔记',
      status: 'draft',
      tags: ['阅读', '草稿'],
    });

    expect(getPublicNoteById(db, publicNote.id)?.title).toBe('公开阅读笔记');
    expect(getPublicNoteById(db, draftNote.id)).toBeUndefined();
    expect(getNoteTags(db, publicNote.id)).toEqual(['阅读', '工具']);
    expect(listTags(db)).toEqual([
      { id: expect.any(String), name: '工具', slug: encodeURIComponent('工具'), note_count: 1 },
      { id: expect.any(String), name: '阅读', slug: encodeURIComponent('阅读'), note_count: 1 },
    ]);
  });

  it('finds tags by slug and an optional public about note', () => {
    const db = new Database(':memory:');
    runMigrations(db);

    createNote(db, {
      sourceType: 'local',
      title: '关于',
      summary: '站点说明',
      status: 'public',
      tags: ['站点'],
    });
    createNote(db, {
      sourceType: 'local',
      title: '技术笔记',
      status: 'public',
      tags: ['技术'],
    });

    expect(findTagBySlug(db, encodeURIComponent('技术'))?.name).toBe('技术');
    expect(getAboutNote(db)?.title).toBe('关于');
  });

  it('does not expose draft-only tags through public tag helpers', () => {
    const db = new Database(':memory:');
    runMigrations(db);

    createNote(db, {
      sourceType: 'local',
      title: '私密草稿',
      status: 'draft',
      tags: ['私密'],
    });
    createNote(db, {
      sourceType: 'local',
      title: '公开技术笔记',
      status: 'public',
      tags: ['技术'],
    });

    expect(findTagBySlug(db, encodeURIComponent('私密'))).toBeUndefined();
    expect(findTagBySlug(db, encodeURIComponent('技术'))?.name).toBe('技术');
    expect(listTags(db).map((tag) => tag.name)).toEqual(['技术']);
  });

  it('renders a Chinese missing state for unknown or draft-only tag pages', async () => {
    const db = new Database(':memory:');
    runMigrations(db);

    createNote(db, {
      sourceType: 'local',
      title: '私密草稿',
      status: 'draft',
      tags: ['私密'],
    });

    vi.doMock('@/lib/db/client', () => ({
      getDatabase: () => db,
    }));

    const { default: TagDetailPage } = await import('@/app/(public)/tags/[slug]/page');
    const page = await TagDetailPage({
      params: Promise.resolve({ slug: encodeURIComponent('私密') }),
    });

    render(page);

    expect(screen.getByText('没有找到这个标签。')).toBeTruthy();
    expect(screen.getByText('未闲漫步')).toBeTruthy();
    expect(screen.queryByText('404')).toBeNull();
  });

  it('marks SQLite-backed public pages as dynamic', async () => {
    const pages = await Promise.all([
      import('@/app/(public)/page'),
      import('@/app/(public)/notes/page'),
      import('@/app/(public)/notes/[id]/page'),
      import('@/app/(public)/tags/page'),
      import('@/app/(public)/tags/[slug]/page'),
      import('@/app/(public)/search/page'),
      import('@/app/(public)/about/page'),
    ]);

    for (const page of pages) {
      expect(page.dynamic).toBe('force-dynamic');
    }
  });
});
