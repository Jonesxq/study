import type { Database as DatabaseConnection } from 'better-sqlite3';

export type SiteSettings = {
  siteName: string;
  siteDescription: string;
  feishuSyncSource: string;
};

type SettingRow = {
  value: string;
};

export function getSetting(db: DatabaseConnection, key: string): string {
  const row = db.prepare('select value from settings where key = ?').get(key) as SettingRow | undefined;
  return row?.value ?? '';
}

export function setSetting(db: DatabaseConnection, key: string, value: string): void {
  db.prepare(
    `
      insert into settings (key, value, updated_at)
      values (?, ?, ?)
      on conflict(key) do update set
        value = excluded.value,
        updated_at = excluded.updated_at
    `,
  ).run(key, value, new Date().toISOString());
}

export function getSiteSettings(db: DatabaseConnection): SiteSettings {
  return {
    siteName: getSetting(db, 'site_name'),
    siteDescription: getSetting(db, 'site_description'),
    feishuSyncSource: getSetting(db, 'feishu_sync_source'),
  };
}

export function setSiteSettings(db: DatabaseConnection, settings: SiteSettings): void {
  const save = db.transaction(() => {
    setSetting(db, 'site_name', settings.siteName);
    setSetting(db, 'site_description', settings.siteDescription);
    setSetting(db, 'feishu_sync_source', settings.feishuSyncSource);
  });

  save();
}
