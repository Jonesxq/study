import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { afterEach, describe, expect, it } from 'vitest';
import { runMigrations } from '@/lib/db/migrate';
import { getSetting, setSetting } from '@/lib/db/settings';

let currentDb: Database.Database | undefined;
let currentDir: string | undefined;

function createTestDatabase() {
  currentDir = mkdtempSync(join(tmpdir(), 'notes-settings-'));
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

describe('settings repository', () => {
  it('reads seeded site settings and returns an empty string for missing keys', () => {
    const db = createTestDatabase();

    expect(getSetting(db, 'site_name')).toBe('未闲漫步');
    expect(getSetting(db, 'site_description')).toBe('一个记录阅读、技术、生活观察和长期问题的中文笔记库。');
    expect(getSetting(db, 'feishu_sync_source')).toBe('');
    expect(getSetting(db, 'missing_key')).toBe('');
  });

  it('sets and upserts site settings', () => {
    const db = createTestDatabase();

    setSetting(db, 'site_name', '新的站点名');
    setSetting(db, 'site_description', '新的站点简介');
    setSetting(db, 'feishu_sync_source', 'space_a:node_b');

    expect(getSetting(db, 'site_name')).toBe('新的站点名');
    expect(getSetting(db, 'site_description')).toBe('新的站点简介');
    expect(getSetting(db, 'feishu_sync_source')).toBe('space_a:node_b');

    setSetting(db, 'site_name', '再次更新的站点名');
    setSetting(db, 'site_description', '');
    setSetting(db, 'feishu_sync_source', 'space_c');

    expect(getSetting(db, 'site_name')).toBe('再次更新的站点名');
    expect(getSetting(db, 'site_description')).toBe('');
    expect(getSetting(db, 'feishu_sync_source')).toBe('space_c');
  });
});
