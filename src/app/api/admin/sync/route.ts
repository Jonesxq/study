import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/require-admin';
import { getDatabase } from '@/lib/db/client';
import { getSetting } from '@/lib/db/settings';
import { HttpFeishuClient } from '@/lib/feishu/client';
import { syncFeishuPages } from '@/lib/feishu/sync';

export async function POST(request: Request) {
  await requireAdmin();

  const appId = process.env.FEISHU_APP_ID?.trim();
  const appSecret = process.env.FEISHU_APP_SECRET?.trim();
  const db = getDatabase();
  const source = getSetting(db, 'feishu_sync_source').trim() || process.env.FEISHU_SYNC_SOURCE?.trim();

  if (!appId || !appSecret || !source) {
    return NextResponse.redirect(new URL('/admin/sync?error=missing_config', request.url), { status: 303 });
  }

  const uploadDir = process.env.UPLOAD_DIR ?? './public/uploads/feishu';
  const result = await syncFeishuPages({
    db,
    client: new HttpFeishuClient({ appId, appSecret, source }),
    uploadDir,
  });

  return NextResponse.redirect(new URL(`/admin/sync?status=${encodeURIComponent(result.status)}`, request.url), {
    status: 303,
  });
}
