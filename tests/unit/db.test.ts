import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import { runMigrations } from '@/lib/db/migrate';

describe('database migrations', () => {
  function createDatabase() {
    const dir = mkdtempSync(join(tmpdir(), 'notes-db-'));
    const dbPath = join(dir, 'test.sqlite');
    const db = new Database(dbPath);

    return { db, dir };
  }

  it('creates the required tables and seed settings', () => {
    const { db, dir } = createDatabase();

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
    expect(tables).toContain('admin_users');
    expect(tables).toContain('sync_runs');
    expect(tables).toContain('schema_migrations');

    const siteName = db.prepare("select value from settings where key = 'site_name'").get() as { value: string };
    expect(siteName.value).toBe('未闲漫步');

    const siteDescription = db.prepare("select value from settings where key = 'site_description'").get() as {
      value: string;
    };
    expect(siteDescription.value).toBe('一个记录阅读、技术、生活观察和长期问题的中文笔记库。');

    db.close();
    rmSync(dir, { recursive: true, force: true });
  });

  it('repairs the old default site description without overwriting custom descriptions', () => {
    const oldDefault = '散步时写下的笔记';
    const requiredDefault = '一个记录阅读、技术、生活观察和长期问题的中文笔记库。';
    const { db, dir } = createDatabase();

    runMigrations(db);

    db.prepare("update settings set value = ? where key = 'site_description'").run(oldDefault);
    runMigrations(db);

    const repaired = db.prepare("select value from settings where key = 'site_description'").get() as {
      value: string;
    };
    expect(repaired.value).toBe(requiredDefault);

    db.prepare("update settings set value = ? where key = 'site_description'").run('我自己的站点描述');
    runMigrations(db);

    const preserved = db.prepare("select value from settings where key = 'site_description'").get() as {
      value: string;
    };
    expect(preserved.value).toBe('我自己的站点描述');

    db.close();
    rmSync(dir, { recursive: true, force: true });
  });

  it('records the seed repair migration version', () => {
    const { db, dir } = createDatabase();

    runMigrations(db);

    const migration = db.prepare('select version from schema_migrations where version = 1').get() as
      | { version: number }
      | undefined;

    expect(migration?.version).toBe(1);

    db.close();
    rmSync(dir, { recursive: true, force: true });
  });

  it('resolves schema relative to the migration module instead of process cwd', () => {
    const { db, dir } = createDatabase();
    const originalCwd = process.cwd();
    const otherCwd = mkdtempSync(join(tmpdir(), 'notes-other-cwd-'));

    try {
      process.chdir(otherCwd);
      runMigrations(db);

      const siteName = db.prepare("select value from settings where key = 'site_name'").get() as { value: string };
      expect(siteName.value).toBe('未闲漫步');
    } finally {
      process.chdir(originalCwd);
      db.close();
      rmSync(dir, { recursive: true, force: true });
      rmSync(otherCwd, { recursive: true, force: true });
    }
  });
});
