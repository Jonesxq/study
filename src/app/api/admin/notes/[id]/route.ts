import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/require-admin';
import { getDatabase } from '@/lib/db/client';
import { updateLocalNote } from '@/lib/db/notes';
import { renderMarkdown } from '@/lib/markdown/render';
import { summarizeMarkdown } from '@/lib/markdown/summarize';
import { noteInputSchema } from '@/lib/validation';

type UpdateAdminNoteRouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function POST(request: Request, context: UpdateAdminNoteRouteContext) {
  await requireAdmin();

  const { id } = await context.params;
  const form = await request.formData();
  const result = noteInputSchema.safeParse(readNoteForm(form));

  if (!result.success) {
    return new NextResponse(result.error.issues.map((issue) => issue.message).join('\n'), { status: 400 });
  }

  const input = result.data;
  const contentHtml = await renderMarkdown(input.contentMarkdown);
  const note = updateLocalNote(getDatabase(), id, {
    title: input.title,
    summary: input.summary || summarizeMarkdown(input.contentMarkdown),
    contentMarkdown: input.contentMarkdown,
    contentHtml,
    status: input.status,
    tags: input.tags,
  });

  if (!note) {
    return new NextResponse('笔记不存在，或飞书同步笔记不能在网站后台编辑。', { status: 404 });
  }

  return NextResponse.redirect(new URL(`/admin/notes/${note.id}/edit`, request.url), { status: 303 });
}

function readNoteForm(form: FormData) {
  return {
    title: String(form.get('title') ?? ''),
    summary: String(form.get('summary') ?? ''),
    contentMarkdown: String(form.get('contentMarkdown') ?? ''),
    status: String(form.get('status') ?? ''),
    tags: String(form.get('tags') ?? ''),
  };
}
