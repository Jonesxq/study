import { SiteHeader } from '@/components/public/SiteHeader';
import { getDatabase } from '@/lib/db/client';
import { listTags } from '@/lib/db/notes';

export const dynamic = 'force-dynamic';

export default function TagsPage() {
  const tags = listTags(getDatabase());

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <SiteHeader />
      <section className="py-12">
        <h1 className="text-3xl font-semibold">标签</h1>
        {tags.length > 0 ? (
          <div className="mt-8 flex flex-wrap gap-3">
            {tags.map((tag) => (
              <a
                className="inline-flex items-center gap-2 border border-[var(--line)] bg-[var(--surface)] px-4 py-2 text-sm hover:border-[var(--accent)]"
                href={`/tags/${tag.slug}`}
                key={tag.id}
              >
                <span>{tag.name}</span>
                <span className="text-[var(--muted)]">{tag.note_count}</span>
              </a>
            ))}
          </div>
        ) : (
          <p className="mt-8 text-[var(--muted)]">还没有标签。</p>
        )}
      </section>
    </main>
  );
}
