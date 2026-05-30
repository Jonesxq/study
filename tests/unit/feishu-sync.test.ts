import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { afterEach, describe, expect, it } from 'vitest';
import { blocksToMarkdown } from '@/lib/feishu/blocks-to-markdown';
import { HttpFeishuClient } from '@/lib/feishu/client';
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
  downloadCalls: Array<{ token: string; targetPath: string }> = [];

  constructor(
    public pages: FeishuWikiPage[],
    public blocksByDocumentId: Map<string, FeishuBlock[]>,
    private readonly downloadHandler?: (token: string, targetPath: string) => Promise<string | undefined>,
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

  async downloadAsset(token: string, targetPath: string) {
    this.downloadCalls.push({ token, targetPath });
    return this.downloadHandler?.(token, targetPath);
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

  it('downloads image blocks and rewrites successful downloads to public image URLs', async () => {
    const db = createTestDatabase();
    const client = new FakeFeishuClient(
      [{ sourceId: 'image-doc', documentId: 'image-doc', title: '图片笔记' }],
      new Map([['image-doc', [{ type: 'text', text: '配图如下' }, { type: 'image', token: 'image/token 1', alt: '图一' }]]]),
      async (_token, targetPath) => targetPath,
    );

    const result = await syncFeishuPages({ db, client, uploadDir: join(currentDir!, 'public', 'uploads', 'feishu') });

    const note = getNoteById(db, result.noteIds[0]!);
    const safeName = safeTestAssetName('image/token 1');
    expect(client.downloadCalls).toEqual([
      {
        token: 'image/token 1',
        targetPath: join(currentDir!, 'public', 'uploads', 'feishu', safeName),
      },
    ]);
    expect(note?.contentMarkdown).toContain(`![图一](/uploads/feishu/${safeName})`);
    expect(note?.contentHtml).toContain(`<img src="/uploads/feishu/${safeName}" alt="图一">`);
  });

  it('uses hashed image asset names that cannot escape the upload directory or collide by punctuation', async () => {
    const db = createTestDatabase();
    const client = new FakeFeishuClient(
      [{ sourceId: 'image-doc', documentId: 'image-doc', title: '图片笔记' }],
      new Map([
        [
          'image-doc',
          [
            { type: 'image', token: '..', alt: 'dotdot' },
            { type: 'image', token: 'a/b', alt: 'slash' },
            { type: 'image', token: 'a:b', alt: 'colon' },
          ],
        ],
      ]),
      async (_token, targetPath) => targetPath,
    );
    const uploadDir = join(currentDir!, 'public', 'uploads', 'feishu');

    await syncFeishuPages({ db, client, uploadDir });

    const targetPaths = client.downloadCalls.map((call) => call.targetPath);
    expect(targetPaths).toContain(join(uploadDir, safeTestAssetName('..')));
    expect(targetPaths).toContain(join(uploadDir, safeTestAssetName('a/b')));
    expect(targetPaths).toContain(join(uploadDir, safeTestAssetName('a:b')));
    expect(new Set(targetPaths).size).toBe(3);
    expect(targetPaths.every((targetPath) => targetPath.startsWith(uploadDir))).toBe(true);
  });

  it('records a Chinese warning and avoids missing image links when an image download fails', async () => {
    const db = createTestDatabase();
    const client = new FakeFeishuClient(
      [{ sourceId: 'image-doc', documentId: 'image-doc', title: '图片笔记' }],
      new Map([['image-doc', [{ type: 'image', token: 'missing-image', alt: '丢失图' }]]]),
      async () => undefined,
    );

    const result = await syncFeishuPages({ db, client, uploadDir: join(currentDir!, 'public', 'uploads', 'feishu') });
    const note = getNoteById(db, result.noteIds[0]!);
    const run = latestSyncRun(db);

    expect(result.status).toBe('success');
    expect(note?.contentMarkdown).not.toContain('![丢失图]');
    expect(note?.contentMarkdown).toContain('图片未同步：丢失图');
    expect(run?.message).toContain('图片未同步');
    expect(run?.message).toContain('missing-image');
  });
});

describe('HttpFeishuClient', () => {
  it('caches tenant tokens across requests', async () => {
    const fetchImpl = queuedFetch([
      tokenResponse('cached-token'),
      jsonResponse({ code: 0, data: { items: [], has_more: false } }),
      jsonResponse({ code: 0, data: { items: [], has_more: false } }),
    ]);
    const client = new HttpFeishuClient({
      appId: 'app',
      appSecret: 'secret',
      source: 'space',
      fetchImpl,
    });

    await client.listWikiPages();
    await client.listWikiPages();

    const tokenCalls = fetchImpl.calls.filter((call) => call.url.endsWith('/tenant_access_token/internal'));
    expect(tokenCalls).toHaveLength(1);
  });

  it('throws on Feishu business code errors', async () => {
    const client = new HttpFeishuClient({
      appId: 'app',
      appSecret: 'secret',
      source: 'space',
      fetchImpl: queuedFetch([tokenResponse('token'), jsonResponse({ code: 12_345, msg: '业务失败' })]),
    });

    await expect(client.listWikiPages()).rejects.toThrow('Feishu API 12345: 业务失败');
  });

  it('paginates docx blocks and maps common raw block fields', async () => {
    const client = new HttpFeishuClient({
      appId: 'app',
      appSecret: 'secret',
      source: 'space',
      fetchImpl: queuedFetch([
        tokenResponse('token'),
        jsonResponse({
          code: 0,
          data: {
            items: [{ block_type: 2, text: { elements: [{ text_run: { content: '第一页' } }] } }],
            has_more: true,
            page_token: 'next-blocks',
          },
        }),
        jsonResponse({
          code: 0,
          data: {
            items: [{ block_type: 3, heading1: { elements: [{ text_run: { content: '标题' } }] } }],
            has_more: false,
          },
        }),
      ]),
    });

    await expect(client.getDocumentBlocks('docx-token')).resolves.toEqual([
      { type: 'text', text: '第一页' },
      { type: 'heading', level: 1, text: '标题' },
    ]);
  });

  it('paginates and recurses Wiki nodes while returning only unique docx pages', async () => {
    const fetchImpl = queuedFetch([
      tokenResponse('token'),
      jsonResponse({
        code: 0,
        data: {
          items: [
            {
              node_token: 'node-docx-1',
              obj_token: 'docx-1',
              obj_type: 'docx',
              parent_node_token: 'root',
              title: '新版文档',
              obj_edit_time: '1770000000',
            },
            { node_token: 'node-doc-old', obj_token: 'doc-old', obj_type: 'doc', title: '旧版文档' },
            { node_token: 'child-folder', obj_type: 'wiki', title: '文件夹', has_child: true },
          ],
          has_more: true,
          page_token: 'root-page-2',
        },
      }),
      jsonResponse({
        code: 0,
        data: {
          items: [{ node_token: 'node-duplicate', obj_token: 'docx-1', obj_type: 'docx', title: '重复文档' }],
          has_more: false,
        },
      }),
      jsonResponse({
        code: 0,
        data: {
          items: [{ node_token: 'node-child-docx', obj_token: 'docx-child', obj_type: 'docx', title: '子文档' }],
          has_more: false,
        },
      }),
    ]);
    const client = new HttpFeishuClient({ appId: 'app', appSecret: 'secret', source: 'space', fetchImpl });

    await expect(client.listWikiPages()).resolves.toEqual([
      {
        sourceId: 'docx-1',
        documentId: 'docx-1',
        title: '新版文档',
        parentId: 'root',
        updatedAt: '2026-02-02T02:40:00.000Z',
      },
      {
        sourceId: 'docx-child',
        documentId: 'docx-child',
        title: '子文档',
        parentId: undefined,
        updatedAt: undefined,
      },
    ]);
  });

  it('retries Wiki node list rate-limit responses before returning pages', async () => {
    const fetchImpl = queuedFetch([
      tokenResponse('token'),
      jsonResponse({ code: 99_991_400, msg: 'rate limited' }, 400),
      jsonResponse({
        code: 0,
        data: {
          items: [{ node_token: 'node-docx', obj_token: 'docx-1', obj_type: 'docx', title: '可重试文档' }],
          has_more: false,
        },
      }),
    ]);
    const client = new HttpFeishuClient({ appId: 'app', appSecret: 'secret', source: 'space', fetchImpl });

    await expect(client.listWikiPages()).resolves.toMatchObject([{ sourceId: 'docx-1' }]);
    expect(fetchImpl.calls.filter((call) => call.url.includes('/wiki/v2/spaces/space/nodes'))).toHaveLength(2);
  });

  it('retries docx block rate-limit responses before returning blocks', async () => {
    const fetchImpl = queuedFetch([
      tokenResponse('token'),
      jsonResponse({ code: 99_991_400, msg: 'rate limited' }, 400),
      jsonResponse({
        code: 0,
        data: {
          items: [{ block_type: 2, text: { elements: [{ text_run: { content: '重试成功' } }] } }],
          has_more: false,
        },
      }),
    ]);
    const client = new HttpFeishuClient({ appId: 'app', appSecret: 'secret', source: 'space', fetchImpl });

    await expect(client.getDocumentBlocks('docx-1')).resolves.toEqual([{ type: 'text', text: '重试成功' }]);
    expect(fetchImpl.calls.filter((call) => call.url.includes('/docx/v1/documents/docx-1/blocks'))).toHaveLength(2);
  });

  it('rejects repeated docx page tokens instead of looping forever', async () => {
    const client = new HttpFeishuClient({
      appId: 'app',
      appSecret: 'secret',
      source: 'space',
      fetchImpl: queuedFetch([
        tokenResponse('token'),
        jsonResponse({ code: 0, data: { items: [], has_more: true, page_token: 'same-token' } }),
        jsonResponse({ code: 0, data: { items: [], has_more: true, page_token: 'same-token' } }),
      ]),
    });

    await expect(client.getDocumentBlocks('docx-1')).rejects.toThrow('Repeated Feishu page_token: same-token');
  });

  it('rejects repeated Wiki page tokens instead of looping forever', async () => {
    const client = new HttpFeishuClient({
      appId: 'app',
      appSecret: 'secret',
      source: 'space',
      fetchImpl: queuedFetch([
        tokenResponse('token'),
        jsonResponse({ code: 0, data: { items: [], has_more: true, page_token: 'same-token' } }),
        jsonResponse({ code: 0, data: { items: [], has_more: true, page_token: 'same-token' } }),
      ]),
    });

    await expect(client.listWikiPages()).rejects.toThrow('Repeated Feishu page_token: same-token');
  });

  it('rejects sync sources with more than one colon', async () => {
    const client = new HttpFeishuClient({
      appId: 'app',
      appSecret: 'secret',
      source: 'space:parent:extra',
      fetchImpl: queuedFetch([]),
    });

    await expect(client.listWikiPages()).rejects.toThrow('FEISHU_SYNC_SOURCE');
  });

  it('writes downloaded asset bytes and returns the target path', async () => {
    const root = mkdtempSync(join(tmpdir(), 'feishu-download-'));
    try {
      const targetPath = join(root, 'uploads', 'feishu', safeTestAssetName('image-token'));
      const client = new HttpFeishuClient({
        appId: 'app',
        appSecret: 'secret',
        source: 'space',
        fetchImpl: queuedFetch([tokenResponse('token'), new Response('image-bytes', { status: 200 })]),
      });

      await expect(client.downloadAsset('image-token', targetPath)).resolves.toBe(targetPath);
      expect(readFileSync(targetPath, 'utf8')).toBe('image-bytes');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('returns undefined instead of throwing when an asset download fails', async () => {
    const root = mkdtempSync(join(tmpdir(), 'feishu-download-'));
    try {
      const targetPath = join(root, 'uploads', 'feishu', safeTestAssetName('missing-token'));
      const client = new HttpFeishuClient({
        appId: 'app',
        appSecret: 'secret',
        source: 'space',
        fetchImpl: queuedFetch([tokenResponse('token'), new Response('missing', { status: 404 })]),
      });

      await expect(client.downloadAsset('missing-token', targetPath)).resolves.toBeUndefined();
      expect(existsSync(targetPath)).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('throws local file write errors instead of returning undefined', async () => {
    const root = mkdtempSync(join(tmpdir(), 'feishu-download-'));
    try {
      const client = new HttpFeishuClient({
        appId: 'app',
        appSecret: 'secret',
        source: 'space',
        fetchImpl: queuedFetch([tokenResponse('token'), new Response('image-bytes', { status: 200 })]),
      });

      await expect(client.downloadAsset('image-token', root)).rejects.toThrow();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

function tokenResponse(token: string) {
  return jsonResponse({
    code: 0,
    tenant_access_token: token,
    expire: 7200,
  });
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function queuedFetch(responses: Response[]) {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(input), init });
    const response = responses.shift();

    if (!response) {
      throw new Error(`Unexpected fetch: ${String(input)}`);
    }

    return response;
  }) as typeof fetch & { calls: Array<{ url: string; init?: RequestInit }> };

  fetchImpl.calls = calls;
  return fetchImpl;
}

function safeTestAssetName(token: string) {
  return createHash('sha256').update(token).digest('hex').slice(0, 32);
}
