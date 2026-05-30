import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Database as DatabaseConnection } from 'better-sqlite3';

const seedSettings = [
  ['site_name', '未闲漫步'],
  ['site_description', '一个记录阅读、技术、生活观察和长期问题的中文笔记库。'],
  ['feishu_sync_source', ''],
] as const;

export function runMigrations(db: DatabaseConnection): void {
  const schemaPath = join(process.cwd(), 'src', 'lib', 'db', 'schema.sql');
  const schema = readFileSync(schemaPath, 'utf8');

  db.exec(schema);

  const now = new Date().toISOString();
  const insertSetting = db.prepare(`
    insert into settings (key, value, updated_at)
    values (@key, @value, @updatedAt)
    on conflict(key) do nothing
  `);

  const seed = db.transaction(() => {
    for (const [key, value] of seedSettings) {
      insertSetting.run({ key, value, updatedAt: now });
    }
  });

  seed();
}
