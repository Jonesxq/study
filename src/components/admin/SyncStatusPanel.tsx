import type { SyncRunRecord } from '@/lib/db/sync-runs';
import type { FeishuSyncStats } from '@/lib/feishu/types';

type SyncStatusPanelProps = {
  run?: SyncRunRecord<Partial<FeishuSyncStats>>;
};

const statusLabels = {
  running: '同步中',
  success: '成功',
  failed: '失败',
  partial: '部分成功',
};

const statusClassNames = {
  running: 'border-sky-200 bg-sky-50 text-sky-800',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  failed: 'border-red-200 bg-red-50 text-red-800',
  partial: 'border-amber-200 bg-amber-50 text-amber-800',
};

export function SyncStatusPanel({ run }: SyncStatusPanelProps) {
  if (!run) {
    return (
      <section className="border border-[var(--line)] bg-[var(--surface)] px-4 py-6">
        <h2 className="text-base font-semibold">同步状态</h2>
        <p className="mt-2 text-sm text-[var(--muted)]">还没有同步记录。点击立即同步后，这里会显示同步结果。</p>
      </section>
    );
  }

  const stats = run.stats ?? {};
  const failed = numberValue(stats.failed);
  const message = run.message.trim();

  return (
    <section className="space-y-4 border border-[var(--line)] bg-[var(--surface)] px-4 py-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">同步状态</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">最近一次飞书同步运行记录。</p>
        </div>
        <span className={`border px-3 py-1 text-sm font-medium ${statusClassNames[run.status]}`}>
          {statusLabels[run.status]}
        </span>
      </div>

      <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="开始时间" value={formatDate(run.startedAt)} />
        <Metric label="结束时间" value={run.finishedAt ? formatDate(run.finishedAt) : '尚未结束'} />
        <Metric label="新增" value={numberValue(stats.created)} />
        <Metric label="更新" value={numberValue(stats.updated)} />
        <Metric label="下架" value={numberValue(stats.removed)} />
        <Metric label="失败" value={failed} />
      </dl>

      {message ? (
        <div className="border border-[var(--line)] bg-[var(--bg)] px-3 py-3">
          <h3 className="text-sm font-medium">失败原因</h3>
          <pre className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[var(--muted)]">{message}</pre>
        </div>
      ) : (
        <p className="text-sm text-[var(--muted)]">{failed > 0 ? '未记录具体失败原因。' : '没有失败原因。'}</p>
      )}
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="border border-[var(--line)] bg-white px-3 py-3">
      <dt className="text-xs text-[var(--muted)]">{label}</dt>
      <dd className="mt-1 text-sm font-semibold">{value}</dd>
    </div>
  );
}

function numberValue(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('zh-CN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}
