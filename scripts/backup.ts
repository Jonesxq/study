import { randomUUID } from 'node:crypto';
import { cp, mkdir, stat, copyFile, rename, rm } from 'node:fs/promises';
import { basename, isAbsolute, join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export type CreateBackupInput = {
  databasePath: string;
  uploadDir: string;
  backupDir: string;
  now?: Date;
};

export type CreateBackupResult = {
  backupPath: string;
  databaseBackupPath: string;
  uploadsBackupPath: string;
  warnings: string[];
};

export type BackupEnvironment = Record<string, string | undefined> &
  Partial<Record<'DATABASE_PATH' | 'UPLOAD_DIR' | 'BACKUP_DIR', string>>;

export function getDefaultBackupOptions(env: BackupEnvironment): CreateBackupInput {
  return {
    databasePath: env.DATABASE_PATH ?? './data/notes.sqlite',
    uploadDir: env.UPLOAD_DIR ?? './public/uploads/feishu',
    backupDir: env.BACKUP_DIR ?? './backups',
  };
}

export async function createBackup(input: CreateBackupInput): Promise<CreateBackupResult> {
  const now = input.now ?? new Date();
  const timestamp = now.toISOString().replace(/[:.]/g, '-');
  const backupPath = join(input.backupDir, timestamp);
  const uploadsBackupPath = join(backupPath, 'uploads');
  const databaseBackupPath = join(backupPath, basename(input.databasePath));
  const stagingPath = join(input.backupDir, `.tmp-${timestamp}-${randomUUID()}`);
  const warnings: string[] = [];

  assertBackupIsOutsideUploads(input.backupDir, input.uploadDir);
  await assertFileExists(input.databasePath, `Database file not found: ${input.databasePath}`);
  await assertPathMissing(backupPath, `Backup already exists: ${backupPath}`);
  await mkdir(input.backupDir, { recursive: true });
  await mkdir(stagingPath);

  try {
    await copyFile(input.databasePath, join(stagingPath, basename(input.databasePath)));

    if (await directoryExists(input.uploadDir)) {
      await cp(input.uploadDir, join(stagingPath, 'uploads'), { recursive: true });
    } else {
      await mkdir(join(stagingPath, 'uploads'), { recursive: true });
      warnings.push('Uploads directory not found; created an empty uploads backup.');
    }

    await rename(stagingPath, backupPath);
  } catch (error) {
    await rm(stagingPath, { recursive: true, force: true });

    if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
      throw new Error(`Backup already exists: ${backupPath}`);
    }

    throw error;
  }

  return {
    backupPath,
    databaseBackupPath,
    uploadsBackupPath,
    warnings,
  };
}

function assertBackupIsOutsideUploads(backupDir: string, uploadDir: string) {
  if (isSameOrChildPath(backupDir, uploadDir)) {
    throw new Error(`Backup directory cannot be inside uploads directory: ${backupDir}`);
  }
}

async function assertPathMissing(path: string, message: string) {
  try {
    await stat(path);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return;
    }

    throw error;
  }

  throw new Error(message);
}

function isSameOrChildPath(child: string, parent: string) {
  const resolvedChild = normalizeForPlatform(resolve(child));
  const resolvedParent = normalizeForPlatform(resolve(parent));
  const childRelativeToParent = relative(resolvedParent, resolvedChild);

  return childRelativeToParent === '' || (!childRelativeToParent.startsWith('..') && !isAbsolute(childRelativeToParent));
}

function normalizeForPlatform(path: string) {
  return process.platform === 'win32' ? path.toLowerCase() : path;
}

async function assertFileExists(path: string, message: string) {
  try {
    const stats = await stat(path);
    if (!stats.isFile()) {
      throw new Error(message);
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new Error(message);
    }

    throw error;
  }
}

async function directoryExists(path: string) {
  try {
    return (await stat(path)).isDirectory();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return false;
    }

    throw error;
  }
}

async function main() {
  try {
    const result = await createBackup(getDefaultBackupOptions(process.env));

    for (const warning of result.warnings) {
      console.warn(warning);
    }

    console.log(`Backup created: ${result.backupPath}`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void main();
}
