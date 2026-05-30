import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/require-admin';
import { getDatabase } from '@/lib/db/client';
import { createNote } from '@/lib/db/notes';
import { renderMarkdown } from '@/lib/markdown/render';
import { summarizeMarkdown } from '@/lib/markdown/summarize';
import { noteInputSchema } from '@/lib/validation';

export async function POST(request: Request) {
  await requireAdmin();

  const form = await request.formData();
  const result = noteInputSchema.safeParse(readNoteForm(form));

  if (!result.success) {
    return new NextResponse(result.error.issues.map((issue) => issue.message).join('\n'), { status: 400 });
  }

  const input = result.data;
  const contentHtml = await renderMarkdown(input.contentMarkdown);
  const note = createNote(getDatabase(), {
    sourceType: 'local',
    title: input.title,
    summary: input.summary || summarizeMarkdown(input.contentMarkdown),
    contentMarkdown: input.contentMarkdown,
    contentHtml,
    status: input.status,
    tags: input.tags,
  });

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
