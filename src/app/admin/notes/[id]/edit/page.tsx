import { notFound } from 'next/navigation';
import { NoteForm } from '@/components/admin/NoteForm';
import { getDatabase } from '@/lib/db/client';
import { getNoteById, getNoteTags } from '@/lib/db/notes';

type EditAdminNotePageProps = {
  params: Promise<{
    id: string;
  }>;
};

export const dynamic = 'force-dynamic';

export default async function EditAdminNotePage({ params }: EditAdminNotePageProps) {
  const { id } = await params;
  const db = getDatabase();
  const note = getNoteById(db, id);

  if (!note) {
    notFound();
  }

  if (note.sourceType === 'feishu') {
    return (
      <section className="space-y-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-normal">{note.title}</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">飞书同步笔记</p>
        </div>
        <p className="border border-[var(--line)] bg-[var(--surface)] px-4 py-3 text-sm">
          飞书同步笔记不能在网站后台编辑正文。
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-normal">编辑笔记</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">{note.title}</p>
      </div>
      <NoteForm
        action={`/api/admin/notes/${note.id}`}
        submitLabel="保存修改"
        note={{
          title: note.title,
          summary: note.summary,
          contentMarkdown: note.contentMarkdown,
          status: note.status,
          tags: getNoteTags(db, note.id),
        }}
      />
    </section>
  );
}
