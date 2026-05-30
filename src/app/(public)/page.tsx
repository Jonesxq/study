import { NoteCard } from '@/components/public/NoteCard';
import { SiteHeader } from '@/components/public/SiteHeader';
import { getDatabase } from '@/lib/db/client';
import { findPublicNotes, getNoteTags } from '@/lib/db/notes';

export default function HomePage() {
  const db = getDatabase();
  const notes = findPublicNotes(db).slice(0, 5);

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <SiteHeader />
      <section className="py-16">
        <h1 className="text-4xl font-semibold tracking-normal">最近在想什么</h1>
        <p className="mt-4 max-w-2xl text-lg leading-8 text-[var(--muted)]">
          一个记录阅读、技术、生活观察和长期问题的中文笔记库。
        </p>
        <form action="/search" className="mt-8 flex max-w-xl flex-col gap-3 sm:flex-row">
          <label className="sr-only" htmlFor="home-search">
            搜索标题、摘要或正文
          </label>
          <input
            className="min-h-11 flex-1 border border-[var(--line)] bg-[var(--surface)] px-4 text-base"
            id="home-search"
            name="q"
            placeholder="搜索标题、摘要或正文"
            type="search"
          />
          <button className="min-h-11 border border-[var(--accent)] px-5 text-sm font-medium text-[var(--accent)]" type="submit">
            搜索
          </button>
        </form>
      </section>
      <section className="pb-14">
        <div className="flex items-end justify-between gap-4 border-b border-[var(--line)] pb-3">
          <h2 className="text-2xl font-semibold">最新笔记</h2>
          <a className="text-sm text-[var(--accent)] hover:underline" href="/notes">
            查看全部
          </a>
        </div>
        {notes.length > 0 ? (
          <div>
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
          <p className="py-8 text-[var(--muted)]">还没有公开笔记。</p>
        )}
      </section>
    </main>
  );
}
