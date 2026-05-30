import { NoteCard } from '@/components/public/NoteCard';
import { SiteHeader } from '@/components/public/SiteHeader';
import { getDatabase } from '@/lib/db/client';
import { findPublicNotes, getNoteTags } from '@/lib/db/notes';

export const dynamic = 'force-dynamic';

type SearchPageProps = {
  searchParams: Promise<{ q?: string | string[] }>;
};

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const params = await searchParams;
  const rawQuery = Array.isArray(params.q) ? params.q[0] : params.q;
  const query = rawQuery?.trim() ?? '';
  const db = getDatabase();
  const notes = query ? findPublicNotes(db, { query }) : [];

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <SiteHeader />
      <section className="py-12">
        <h1 className="text-3xl font-semibold">搜索</h1>
        <form className="mt-8 flex max-w-2xl flex-col gap-3 sm:flex-row">
          <label className="sr-only" htmlFor="search-query">
            搜索标题、摘要或正文
          </label>
          <input
            className="min-h-11 flex-1 border border-[var(--line)] bg-[var(--surface)] px-4 text-base"
            defaultValue={query}
            id="search-query"
            name="q"
            placeholder="搜索标题、摘要或正文"
            type="search"
          />
          <button className="min-h-11 border border-[var(--accent)] px-5 text-sm font-medium text-[var(--accent)]" type="submit">
            搜索
          </button>
        </form>
        {query ? (
          notes.length > 0 ? (
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
            <p className="mt-8 text-[var(--muted)]">没有找到相关笔记。</p>
          )
        ) : null}
      </section>
    </main>
  );
}
