import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/require-admin';
import { getDatabase } from '@/lib/db/client';
import { setSiteSettings } from '@/lib/db/settings';

export async function POST(request: Request) {
  await requireAdmin();

  const form = await request.formData();
  const siteName = String(form.get('site_name') ?? '').trim();
  const siteDescription = String(form.get('site_description') ?? '').trim();
  const feishuSyncSource = String(form.get('feishu_sync_source') ?? '').trim();

  if (!siteName) {
    return new NextResponse('站点名称不能为空。', { status: 400 });
  }

  setSiteSettings(getDatabase(), {
    siteName,
    siteDescription,
    feishuSyncSource,
  });

  return NextResponse.redirect(new URL('/admin/settings?saved=1', request.url), { status: 303 });
}
