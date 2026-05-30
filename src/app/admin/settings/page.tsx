import { getDatabase } from '@/lib/db/client';
import { getSiteSettings } from '@/lib/db/settings';

export const dynamic = 'force-dynamic';

type SettingsPageProps = {
  searchParams?: Promise<{
    saved?: string;
  }>;
};

export default async function AdminSettingsPage({ searchParams }: SettingsPageProps) {
  const params = await searchParams;
  const settings = getSiteSettings(getDatabase());

  return (
    <section className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-normal">站点设置</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">配置公开站点信息和飞书同步来源。</p>
      </div>

      {params?.saved === '1' ? (
        <p className="border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">设置已保存。</p>
      ) : null}

      <form action="/api/admin/settings" method="post" className="max-w-3xl space-y-5 border border-[var(--line)] bg-[var(--surface)] px-4 py-5">
        <label className="block">
          <span className="text-sm font-medium">站点名称</span>
          <input
            name="site_name"
            required
            defaultValue={settings.siteName}
            className="mt-2 w-full border border-[var(--line)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium">站点简介</span>
          <textarea
            name="site_description"
            rows={4}
            defaultValue={settings.siteDescription}
            className="mt-2 w-full resize-y border border-[var(--line)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium">飞书同步源</span>
          <input
            name="feishu_sync_source"
            defaultValue={settings.feishuSyncSource}
            placeholder="space_id 或 space_id:parent_node_token"
            className="mt-2 w-full border border-[var(--line)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
          />
        </label>

        <div className="flex justify-end border-t border-[var(--line)] pt-4">
          <button type="submit" className="bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white">
            保存设置
          </button>
        </div>
      </form>
    </section>
  );
}
