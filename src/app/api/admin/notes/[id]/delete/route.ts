import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/require-admin';
import { getDatabase } from '@/lib/db/client';
import { deleteLocalNote } from '@/lib/db/notes';

type DeleteAdminNoteRouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function POST(request: Request, context: DeleteAdminNoteRouteContext) {
  await requireAdmin();

  const { id } = await context.params;
  const deleted = deleteLocalNote(getDatabase(), id);

  if (!deleted) {
    return new NextResponse('笔记不存在，或飞书同步笔记不能在网站后台删除。', { status: 404 });
  }

  return NextResponse.redirect(new URL('/admin/notes?deleted=1', request.url), { status: 303 });
}
