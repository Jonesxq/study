import { randomUUID } from 'node:crypto';
import type { Database as DatabaseConnection } from 'better-sqlite3';

export type SyncRunStatus = 'running' | 'success' | 'failed' | 'partial';

export type SyncRunRecord<TStats extends Record<string, unknown> = Record<string, unknown>> = {
  id: string;
  status: SyncRunStatus;
  startedAt: string;
  finishedAt?: string;
  message: string;
  stats: TStats;
};

type SyncRunRow = {
  id: string;
  status: SyncRunStatus;
  started_at: string;
  finished_at: string | null;
  message: string;
  stats_json: string;
};

export function startSyncRun(db: DatabaseConnection): SyncRunRecord {
  const now = new Date().toISOString();
  const id = randomUUID();

  db.prepare(
    `
      insert into sync_runs (id, status, started_at, message, stats_json)
      values (?, 'running', ?, '', '{}')
    `,
  ).run(id, now);

  return {
    id,
    status: 'running',
    startedAt: now,
    message: '',
    stats: {},
  };
}

export function finishSyncRun<TStats extends Record<string, unknown>>(
  db: DatabaseConnection,
  id: string,
  input: {
    status: Exclude<SyncRunStatus, 'running'>;
    message?: string;
    stats: TStats;
  },
): SyncRunRecord<TStats> {
  const finishedAt = new Date().toISOString();

  db.prepare(
    `
      update sync_runs
      set status = ?,
          finished_at = ?,
          message = ?,
          stats_json = ?
      where id = ?
    `,
  ).run(input.status, finishedAt, input.message ?? '', JSON.stringify(input.stats), id);

  const run = getSyncRun<TStats>(db, id);

  if (!run) {
    throw new Error(`Sync run could not be loaded: ${id}`);
  }

  return run;
}

export function latestSyncRun<TStats extends Record<string, unknown> = Record<string, unknown>>(
  db: DatabaseConnection,
): SyncRunRecord<TStats> | undefined {
  const row = db
    .prepare('select * from sync_runs order by started_at desc, rowid desc limit 1')
    .get() as SyncRunRow | undefined;

  return row ? mapSyncRunRow<TStats>(row) : undefined;
}

function getSyncRun<TStats extends Record<string, unknown>>(
  db: DatabaseConnection,
  id: string,
): SyncRunRecord<TStats> | undefined {
  const row = db.prepare('select * from sync_runs where id = ?').get(id) as SyncRunRow | undefined;
  return row ? mapSyncRunRow<TStats>(row) : undefined;
}

function mapSyncRunRow<TStats extends Record<string, unknown>>(row: SyncRunRow): SyncRunRecord<TStats> {
  return {
    id: row.id,
    status: row.status,
    startedAt: row.started_at,
    finishedAt: row.finished_at ?? undefined,
    message: row.message,
    stats: parseStats<TStats>(row.stats_json),
  };
}

function parseStats<TStats extends Record<string, unknown>>(value: string): TStats {
  try {
    return JSON.parse(value) as TStats;
  } catch {
    return {} as TStats;
  }
}
