import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Database as DatabaseConnection } from 'better-sqlite3';

const oldSiteDescription = '散步时写下的笔记';
const currentSiteDescription = '一个记录阅读、技术、生活观察和长期问题的中文笔记库。';
const projectRootAtImport = process.cwd();

const seedSettings = [
  ['site_name', '未闲漫步'],
  ['site_description', currentSiteDescription],
  ['feishu_sync_source', ''],
] as const;

export function runMigrations(db: DatabaseConnection): void {
  const schemaUrl = new URL('./schema.sql', import.meta.url);
  const moduleRelativeSchemaPath =
    schemaUrl.protocol === 'file:'
      ? fileURLToPath(schemaUrl)
      : decodeURIComponent(schemaUrl.pathname).replace(/^\/([A-Za-z]:)/, '$1');
  const schemaPath = existsSync(moduleRelativeSchemaPath)
    ? moduleRelativeSchemaPath
    : join(projectRootAtImport, 'src', 'lib', 'db', 'schema.sql');
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

    db.prepare(`
      update settings
      set value = @currentSiteDescription, updated_at = @updatedAt
      where key = 'site_description' and value = @oldSiteDescription
    `).run({
      currentSiteDescription,
      oldSiteDescription,
      updatedAt: now,
    });

    db.prepare(`
      insert into schema_migrations (version, applied_at)
      values (1, @appliedAt)
      on conflict(version) do nothing
    `).run({ appliedAt: now });
  });

  seed();
}
