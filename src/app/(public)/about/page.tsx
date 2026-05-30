import { MarkdownView } from '@/components/public/MarkdownView';
import { SiteHeader } from '@/components/public/SiteHeader';
import { getDatabase } from '@/lib/db/client';
import { getAboutNote } from '@/lib/db/notes';

export const dynamic = 'force-dynamic';

export default function AboutPage() {
  const note = getAboutNote(getDatabase());

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <SiteHeader />
      <section className="py-12">
        <h1 className="text-3xl font-semibold">关于</h1>
        {note ? (
          <div className="mt-8">
            <MarkdownView sanitizedHtml={note.contentHtml} />
          </div>
        ) : (
          <p className="mt-8 text-[var(--muted)]">关于页面还没有发布。</p>
        )}
      </section>
    </main>
  );
}
