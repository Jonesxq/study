import { NoteCard } from '@/components/public/NoteCard';
import { SiteHeader } from '@/components/public/SiteHeader';
import { getDatabase } from '@/lib/db/client';
import { findPublicNotes, getNoteTags } from '@/lib/db/notes';

export const dynamic = 'force-dynamic';

export default function NotesPage() {
  const db = getDatabase();
  const notes = findPublicNotes(db);

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <SiteHeader />
      <section className="py-12">
        <h1 className="text-3xl font-semibold">全部笔记</h1>
        {notes.length > 0 ? (
          <div className="mt-4">
            {notes.map((note) => (
              <NoteCard
                key={note.id}
                note={{
                  id: note.id,
                  title: note.title,
                  summary: note.summary,
                  updatedAt: note.updatedAt,
                  tags: getNoteTags(db, note.id),
                }}
              />
            ))}
          </div>
        ) : (
          <p className="mt-8 text-[var(--muted)]">还没有公开笔记。</p>
        )}
      </section>
    </main>
  );
}
