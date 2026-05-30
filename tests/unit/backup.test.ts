import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createBackup, getDefaultBackupOptions } from '../../scripts/backup';

let currentDir: string | undefined;

async function createTempDir() {
  currentDir = await mkdtemp(join(tmpdir(), 'notes-backup-'));
  return currentDir;
}

afterEach(() => {
  if (currentDir) {
    rmSync(currentDir, { recursive: true, force: true });
    currentDir = undefined;
  }
});

describe('createBackup', () => {
  it('uses the Feishu public uploads directory as the default upload directory', () => {
    const options = getDefaultBackupOptions({});

    expect(options.uploadDir).toBe('./public/uploads/feishu');
  });

  it('keeps UPLOAD_DIR as an override for the default upload directory', () => {
    const options = getDefaultBackupOptions({ UPLOAD_DIR: './custom/uploads' });

    expect(options.uploadDir).toBe('./custom/uploads');
  });

  it('copies the SQLite database into a timestamped backup directory', async () => {
    const root = await createTempDir();
    const databasePath = join(root, 'data', 'notes.sqlite');
    const backupDir = join(root, 'backups');
    mkdirSync(join(root, 'data'), { recursive: true });
    writeFileSync(databasePath, 'sqlite-bytes');

    const result = await createBackup({
      databasePath,
      uploadDir: join(root, 'uploads'),
      backupDir,
      now: new Date('2026-05-31T01:02:03.004Z'),
    });

    expect(result.backupPath).toBe(join(backupDir, '2026-05-31T01-02-03-004Z'));
    expect(readFileSync(join(result.backupPath, 'notes.sqlite'), 'utf8')).toBe('sqlite-bytes');
  });

  it('copies uploaded files recursively', async () => {
    const root = await createTempDir();
    const databasePath = join(root, 'notes.sqlite');
    const uploadDir = join(root, 'uploads');
    writeFileSync(databasePath, 'sqlite-bytes');
    mkdirSync(join(uploadDir, 'feishu'), { recursive: true });
    writeFileSync(join(uploadDir, 'feishu', 'image.png'), 'image-bytes');

    const result = await createBackup({
      databasePath,
      uploadDir,
      backupDir: join(root, 'backups'),
      now: new Date('2026-05-31T01:02:03.004Z'),
    });

    expect(readFileSync(join(result.backupPath, 'uploads', 'feishu', 'image.png'), 'utf8')).toBe('image-bytes');
  });

  it('does not fail when uploads are missing', async () => {
    const root = await createTempDir();
    const databasePath = join(root, 'notes.sqlite');
    writeFileSync(databasePath, 'sqlite-bytes');

    const result = await createBackup({
      databasePath,
      uploadDir: join(root, 'missing-uploads'),
      backupDir: join(root, 'backups'),
      now: new Date('2026-05-31T01:02:03.004Z'),
    });

    expect(existsSync(join(result.backupPath, 'notes.sqlite'))).toBe(true);
    expect(result.warnings).toEqual(['Uploads directory not found; created an empty uploads backup.']);
    expect(existsSync(join(result.backupPath, 'uploads'))).toBe(true);
  });

  it('throws a clear error when the database file is missing', async () => {
    const root = await createTempDir();

    await expect(
      createBackup({
        databasePath: join(root, 'missing.sqlite'),
        uploadDir: join(root, 'uploads'),
        backupDir: join(root, 'backups'),
        now: new Date('2026-05-31T01:02:03.004Z'),
      }),
    ).rejects.toThrow('Database file not found');
  });

  it('does not overwrite or merge an existing timestamped backup', async () => {
    const root = await createTempDir();
    const databasePath = join(root, 'notes.sqlite');
    const uploadDir = join(root, 'uploads');
    const backupDir = join(root, 'backups');
    const now = new Date('2026-05-31T01:02:03.004Z');
    writeFileSync(databasePath, 'original-db');
    mkdirSync(uploadDir, { recursive: true });
    writeFileSync(join(uploadDir, 'original.txt'), 'original-upload');

    const first = await createBackup({ databasePath, uploadDir, backupDir, now });

    writeFileSync(databasePath, 'new-db');
    writeFileSync(join(uploadDir, 'new.txt'), 'new-upload');

    await expect(createBackup({ databasePath, uploadDir, backupDir, now })).rejects.toThrow(
      `Backup already exists: ${first.backupPath}`,
    );
    expect(readFileSync(join(first.backupPath, 'notes.sqlite'), 'utf8')).toBe('original-db');
    expect(readFileSync(join(first.backupPath, 'uploads', 'original.txt'), 'utf8')).toBe('original-upload');
    expect(existsSync(join(first.backupPath, 'uploads', 'new.txt'))).toBe(false);
  });

  it('rejects backup directories inside uploads before writing partial backup files', async () => {
    const root = await createTempDir();
    const databasePath = join(root, 'notes.sqlite');
    const uploadDir = join(root, 'uploads');
    const backupDir = join(uploadDir, 'backups');
    writeFileSync(databasePath, 'sqlite-bytes');
    mkdirSync(uploadDir, { recursive: true });
    writeFileSync(join(uploadDir, 'image.txt'), 'image-bytes');

    await expect(
      createBackup({
        databasePath,
        uploadDir,
        backupDir,
        now: new Date('2026-05-31T01:02:03.004Z'),
      }),
    ).rejects.toThrow('Backup directory cannot be inside uploads directory');
    expect(existsSync(backupDir)).toBe(false);
  });
});
