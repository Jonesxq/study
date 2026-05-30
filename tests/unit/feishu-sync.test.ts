import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { afterEach, describe, expect, it } from 'vitest';
import { blocksToMarkdown } from '@/lib/feishu/blocks-to-markdown';
import { syncFeishuPages } from '@/lib/feishu/sync';
import type { FeishuBlock, FeishuClient, FeishuWikiPage } from '@/lib/feishu/types';
import { runMigrations } from '@/lib/db/migrate';
import { createNote, getNoteById } from '@/lib/db/notes';
import { latestSyncRun } from '@/lib/db/sync-runs';

let currentDb: Database.Database | undefined;
let currentDir: string | undefined;

function createTestDatabase() {
  currentDir = mkdtempSync(join(tmpdir(), 'feishu-sync-'));
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

class FakeFeishuClient implements FeishuClient {
  constructor(
    public pages: FeishuWikiPage[],
    public blocksByDocumentId: Map<string, FeishuBlock[]>,
  ) {}

  async listWikiPages() {
    return this.pages;
  }

  async getDocumentBlocks(documentId: string) {
    const blocks = this.blocksByDocumentId.get(documentId);

    if (!blocks) {
      throw new Error(`missing blocks for ${documentId}`);
    }

    return blocks;
  }

  async downloadAsset() {
    return undefined;
  }
}

describe('Feishu sync', () => {
  it('syncs one Feishu page into a public note and records a successful sync run', async () => {
    const db = createTestDatabase();
    const client = new FakeFeishuClient(
      [
        {
          sourceId: 'doc-1',
          documentId: 'doc-1',
          title: '飞书页面',
          parentId: 'wiki-parent',
          updatedAt: '2026-05-30T10:00:00.000Z',
        },
      ],
      new Map([
        [
          'doc-1',
          [
            { type: 'heading', level: 1, text: '飞书页面' },
            { type: 'text', text: '第一段来自飞书。' },
            { type: 'bullet', text: '一个要点' },
          ],
        ],
      ]),
    );

    const result = await syncFeishuPages({ db, client, uploadDir: join(currentDir!, 'uploads') });

    expect(result.status).toBe('success');
    expect(result.stats).toMatchObject({ created: 1, updated: 0, removed: 0, failed: 0 });
    expect(result.noteIds).toHaveLength(1);

    const note = getNoteById(db, result.noteIds[0]!);
    expect(note).toMatchObject({
      sourceType: 'feishu',
      sourceId: 'doc-1',
      title: '飞书页面',
      status: 'public',
      parentId: 'wiki-parent',
      sourceUpdatedAt: '2026-05-30T10:00:00.000Z',
    });
    expect(note?.contentMarkdown).toContain('# 飞书页面');
    expect(note?.contentMarkdown).toContain('- 一个要点');
    expect(note?.contentHtml).toContain('<h1>飞书页面</h1>');
    expect(note?.summary).toBe('第一段来自飞书。 一个要点');
    expect(note?.syncedAt).toEqual(expect.any(String));

    const run = latestSyncRun(db);
    expect(run).toMatchObject({
      id: result.runId,
      status: 'success',
      message: '',
    });
    expect(run?.stats).toMatchObject({ created: 1, updated: 0, removed: 0, failed: 0 });
    expect(run?.finishedAt).toEqual(expect.any(String));
  });

  it('upserts an existing Feishu note by source id on the second sync', async () => {
    const db = createTestDatabase();
    const pages: FeishuWikiPage[] = [
      {
        sourceId: 'doc-1',
        documentId: 'doc-1',
        title: '初始标题',
        updatedAt: '2026-05-30T10:00:00.000Z',
      },
    ];
    const blocks = new Map<string, FeishuBlock[]>([['doc-1', [{ type: 'text', text: '第一版内容' }]]]);
    const client = new FakeFeishuClient(pages, blocks);

    const first = await syncFeishuPages({ db, client });

    pages[0] = {
      sourceId: 'doc-1',
      documentId: 'doc-1',
      title: '更新标题',
      updatedAt: '2026-05-31T10:00:00.000Z',
    };
    blocks.set('doc-1', [{ type: 'text', text: '第二版内容' }]);

    const second = await syncFeishuPages({ db, client });

    expect(second.status).toBe('success');
    expect(second.noteIds).toEqual(first.noteIds);
    expect(second.stats).toMatchObject({ created: 0, updated: 1, removed: 0, failed: 0 });

    const note = getNoteById(db, first.noteIds[0]!);
    expect(note?.title).toBe('更新标题');
    expect(note?.contentMarkdown).toBe('第二版内容');
    expect(note?.createdAt).toEqual(expect.any(String));
  });

  it('marks Feishu notes missing from the source list as removed', async () => {
    const db = createTestDatabase();
    const stale = createNote(db, {
      sourceType: 'feishu',
      sourceId: 'stale-doc',
      title: '旧飞书笔记',
      status: 'public',
    });
    const client = new FakeFeishuClient(
      [{ sourceId: 'fresh-doc', documentId: 'fresh-doc', title: '新飞书笔记' }],
      new Map([['fresh-doc', [{ type: 'text', text: '新内容' }]]]),
    );

    const result = await syncFeishuPages({ db, client });

    expect(result.status).toBe('success');
    expect(result.stats).toMatchObject({ created: 1, removed: 1 });
    expect(getNoteById(db, stale.id)?.status).toBe('removed');
  });

  it('finishes as partial when one document fails and never leaves the sync run running', async () => {
    const db = createTestDatabase();
    const client = new FakeFeishuClient(
      [
        { sourceId: 'ok-doc', documentId: 'ok-doc', title: '可同步' },
        { sourceId: 'bad-doc', documentId: 'bad-doc', title: '会失败' },
      ],
      new Map([['ok-doc', [{ type: 'text', text: '保留下来的内容' }]]]),
    );

    const result = await syncFeishuPages({ db, client });

    expect(result.status).toBe('partial');
    expect(result.stats).toMatchObject({ created: 1, updated: 0, failed: 1 });
    expect(result.noteIds).toHaveLength(1);

    const run = latestSyncRun(db);
    expect(run?.status).toBe('partial');
    expect(run?.message).toContain('missing blocks for bad-doc');
    expect(run?.finishedAt).toEqual(expect.any(String));
  });

  it('converts common Feishu blocks to Markdown', () => {
    const markdown = blocksToMarkdown([
      { type: 'heading', level: 2, text: '标题 *需要转义*' },
      { type: 'text', text: '普通 [文本]' },
      { type: 'bullet', text: '项目' },
      { type: 'image', token: 'image-token', alt: '配图' },
      { type: 'divider' },
      { type: 'code', language: 'ts', text: 'const x = 1;' },
    ]);

    expect(markdown).toBe(
      [
        '## 标题 \\*需要转义\\*',
        '',
        '普通 \\[文本\\]',
        '',
        '- 项目',
        '',
        '![配图](/uploads/feishu/image-token)',
        '',
        '---',
        '',
        '```ts',
        'const x = 1;',
        '```',
      ].join('\n'),
    );
  });
});
