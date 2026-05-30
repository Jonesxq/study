import { createHash } from 'node:crypto';
import { extname, isAbsolute, join, relative, resolve } from 'node:path';
import type { Database as DatabaseConnection } from 'better-sqlite3';
import { markMissingFeishuNotesRemoved, upsertFeishuNote } from '@/lib/db/notes';
import { finishSyncRun, startSyncRun } from '@/lib/db/sync-runs';
import { renderMarkdown } from '@/lib/markdown/render';
import { summarizeMarkdown } from '@/lib/markdown/summarize';
import { blocksToMarkdown } from './blocks-to-markdown';
import type { FeishuBlock, FeishuClient, FeishuSyncStats, FeishuSyncStatus } from './types';

export type SyncFeishuPagesInput = {
  db: DatabaseConnection;
  client: FeishuClient;
  uploadDir?: string;
};

export type SyncFeishuPagesResult = {
  status: FeishuSyncStatus;
  stats: FeishuSyncStats;
  noteIds: string[];
  runId: string;
};

export async function syncFeishuPages(input: SyncFeishuPagesInput): Promise<SyncFeishuPagesResult> {
  const run = startSyncRun(input.db);
  const stats: FeishuSyncStats = {
    created: 0,
    updated: 0,
    removed: 0,
    failed: 0,
    scanned: 0,
  };
  const noteIds: string[] = [];
  const messages: string[] = [];

  try {
    const pages = await input.client.listWikiPages();
    const activeSourceIds = pages.map((page) => page.sourceId);
    stats.scanned = pages.length;

    for (const page of pages) {
      try {
        const blocks = await input.client.getDocumentBlocks(page.documentId);
        const preparedBlocks = await prepareImageBlocks({
          blocks,
          client: input.client,
          uploadDir: input.uploadDir,
          pageTitle: page.title,
          warnings: messages,
        });
        const markdown = blocksToMarkdown(preparedBlocks);
        const html = await renderMarkdown(markdown);
        const summary = summarizeMarkdown(markdown) || page.title;
        const result = upsertFeishuNote(input.db, {
          sourceId: page.sourceId,
          title: page.title,
          summary,
          contentMarkdown: markdown,
          contentHtml: html,
          parentId: page.parentId,
          sourceUpdatedAt: page.updatedAt,
          syncedAt: new Date().toISOString(),
          tags: ['飞书'],
        });

        noteIds.push(result.note.id);

        if (result.created) {
          stats.created += 1;
        } else {
          stats.updated += 1;
        }
      } catch (error) {
        stats.failed += 1;
        messages.push(`${page.title}: ${errorMessage(error)}`);
      }
    }

    stats.removed = markMissingFeishuNotesRemoved(input.db, activeSourceIds);

    const status: FeishuSyncStatus = stats.failed > 0 ? 'partial' : 'success';
    finishSyncRun(input.db, run.id, {
      status,
      message: messages.join('\n'),
      stats: stats as unknown as Record<string, unknown>,
    });

    return {
      status,
      stats,
      noteIds,
      runId: run.id,
    };
  } catch (error) {
    stats.failed += 1;
    const message = errorMessage(error);

    finishSyncRun(input.db, run.id, {
      status: 'failed',
      message,
      stats: stats as unknown as Record<string, unknown>,
    });

    return {
      status: 'failed',
      stats,
      noteIds,
      runId: run.id,
    };
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function prepareImageBlocks(input: {
  blocks: FeishuBlock[];
  client: FeishuClient;
  uploadDir?: string;
  pageTitle: string;
  warnings: string[];
}): Promise<FeishuBlock[]> {
  const uploadDir = input.uploadDir ?? './public/uploads/feishu';
  const prepared: FeishuBlock[] = [];

  for (const block of input.blocks) {
    if (block.type !== 'image' || !block.token) {
      prepared.push(block);
      continue;
    }

    const safeToken = safeAssetName(block.token);
    const targetPath = safeUploadPath(uploadDir, safeToken);

    try {
      const downloaded = await input.client.downloadAsset(block.token, targetPath);

      if (downloaded) {
        prepared.push({
          ...block,
          path: `/uploads/feishu/${safeToken}`,
        });
        continue;
      }

      const warning = imageWarning(input.pageTitle, block, '下载未返回文件');
      input.warnings.push(warning);
      prepared.push({ type: 'text', text: `图片未同步：${block.alt || block.token}` });
    } catch (error) {
      const warning = imageWarning(input.pageTitle, block, errorMessage(error));
      input.warnings.push(warning);
      prepared.push({ type: 'text', text: `图片未同步：${block.alt || block.token}` });
    }
  }

  return prepared;
}

function imageWarning(pageTitle: string, block: Extract<FeishuBlock, { type: 'image' }>, reason: string): string {
  return `图片未同步：${pageTitle} / ${block.alt || '未命名图片'} / ${block.token ?? '无 token'} / ${reason}`;
}

function safeAssetName(token: string): string {
  const hash = createHash('sha256').update(token).digest('hex').slice(0, 32);
  const extension = safeExtension(token);

  return `${hash}${extension}`;
}

function safeExtension(token: string): string {
  const extension = extname(token.trim()).toLowerCase();

  if (/^\.[a-z0-9]{1,8}$/.test(extension)) {
    return extension;
  }

  return '';
}

function safeUploadPath(uploadDir: string, fileName: string): string {
  const root = resolve(uploadDir);
  const target = resolve(root, fileName);
  const relativeTarget = relative(root, target);

  if (relativeTarget.startsWith('..') || isAbsolute(relativeTarget)) {
    throw new Error(`Asset path escapes upload directory: ${fileName}`);
  }

  return target;
}
