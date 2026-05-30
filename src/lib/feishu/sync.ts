import type { Database as DatabaseConnection } from 'better-sqlite3';
import { markMissingFeishuNotesRemoved, upsertFeishuNote } from '@/lib/db/notes';
import { finishSyncRun, startSyncRun } from '@/lib/db/sync-runs';
import { renderMarkdown } from '@/lib/markdown/render';
import { summarizeMarkdown } from '@/lib/markdown/summarize';
import { blocksToMarkdown } from './blocks-to-markdown';
import type { FeishuClient, FeishuSyncStats, FeishuSyncStatus } from './types';

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
        const markdown = blocksToMarkdown(blocks);
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
