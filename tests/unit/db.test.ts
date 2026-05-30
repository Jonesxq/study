import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import { runMigrations } from '@/lib/db/migrate';

describe('database migrations', () => {
  it('creates the required tables and seed settings', () => {
    const dir = mkdtempSync(join(tmpdir(), 'notes-db-'));
    const dbPath = join(dir, 'test.sqlite');
    const db = new Database(dbPath);

    runMigrations(db);

    const tables = db
      .prepare("select name from sqlite_master where type = 'table' order by name")
      .all()
      .map((row) => (row as { name: string }).name);

    expect(tables).toContain('notes');
    expect(tables).toContain('tags');
    expect(tables).toContain('note_tags');
    expect(tables).toContain('settings');
    expect(tables).toContain('sessions');
    expect(tables).toContain('sync_runs');

    const siteName = db.prepare("select value from settings where key = 'site_name'").get() as { value: string };
    expect(siteName.value).toBe('未闲漫步');

    db.close();
    rmSync(dir, { recursive: true, force: true });
  });
});
