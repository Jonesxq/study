import { SyncStatusPanel } from '@/components/admin/SyncStatusPanel';
import { getDatabase } from '@/lib/db/client';
import { latestSyncRun } from '@/lib/db/sync-runs';
import type { FeishuSyncStats } from '@/lib/feishu/types';

export const dynamic = 'force-dynamic';

type SyncPageProps = {
  searchParams?: Promise<{
    status?: string;
    error?: string;
  }>;
};

const statusMessages: Record<string, string> = {
  success: '同步完成。',
  partial: '同步完成，但有部分内容失败。',
  failed: '同步失败，请查看下方失败原因。',
};

const errorMessages: Record<string, string> = {
  missing_config: '飞书同步配置不完整，未启动同步。',
};

export default async function AdminSyncPage({ searchParams }: SyncPageProps) {
  const params = await searchParams;
  const run = latestSyncRun<Partial<FeishuSyncStats>>(getDatabase());
  const message = params?.error ? errorMessages[params.error] : params?.status ? statusMessages[params.status] : undefined;

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-normal">飞书同步</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">从飞书知识库同步公开笔记内容。</p>
        </div>
        <form action="/api/admin/sync" method="post">
          <button type="submit" className="bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white">
            立即同步
          </button>
        </form>
      </div>

      {message ? (
        <p className="border border-[var(--line)] bg-[var(--surface)] px-4 py-3 text-sm text-[var(--muted)]">{message}</p>
      ) : null}

      <SyncStatusPanel run={run} />
    </section>
  );
}
