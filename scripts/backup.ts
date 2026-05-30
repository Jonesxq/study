import { cp, mkdir, stat, copyFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
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

export async function createBackup(input: CreateBackupInput): Promise<CreateBackupResult> {
  const now = input.now ?? new Date();
  const timestamp = now.toISOString().replace(/[:.]/g, '-');
  const backupPath = join(input.backupDir, timestamp);
  const uploadsBackupPath = join(backupPath, 'uploads');
  const databaseBackupPath = join(backupPath, basename(input.databasePath));
  const warnings: string[] = [];

  await assertFileExists(input.databasePath, `Database file not found: ${input.databasePath}`);
  await mkdir(backupPath, { recursive: true });
  await copyFile(input.databasePath, databaseBackupPath);

  if (await directoryExists(input.uploadDir)) {
    await cp(input.uploadDir, uploadsBackupPath, { recursive: true });
  } else {
    await mkdir(uploadsBackupPath, { recursive: true });
    warnings.push('Uploads directory not found; created an empty uploads backup.');
  }

  return {
    backupPath,
    databaseBackupPath,
    uploadsBackupPath,
    warnings,
  };
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
    const result = await createBackup({
      databasePath: process.env.DATABASE_PATH ?? './data/notes.sqlite',
      uploadDir: process.env.UPLOAD_DIR ?? './uploads',
      backupDir: process.env.BACKUP_DIR ?? './backups',
    });

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
