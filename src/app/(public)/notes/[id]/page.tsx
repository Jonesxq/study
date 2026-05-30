import { notFound } from 'next/navigation';
import { MarkdownView } from '@/components/public/MarkdownView';
import { SiteHeader } from '@/components/public/SiteHeader';
import { TagPill } from '@/components/public/TagPill';
import { getDatabase } from '@/lib/db/client';
import { getNoteTags, getPublicNoteById } from '@/lib/db/notes';

type NoteDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function NoteDetailPage({ params }: NoteDetailPageProps) {
  const { id } = await params;
  const db = getDatabase();
  const note = getPublicNoteById(db, id);

  if (!note) {
    notFound();
  }

  const tags = getNoteTags(db, note.id);
  const sourceLabel = note.sourceType === 'feishu' ? '飞书同步' : '本地笔记';
  const formattedDate = new Intl.DateTimeFormat('zh-CN', {
    dateStyle: 'long',
    timeZone: 'UTC',
  }).format(new Date(note.updatedAt));

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <SiteHeader />
      <article className="py-12">
        <header className="border-b border-[var(--line)] pb-8">
          <h1 className="text-4xl font-semibold tracking-normal">{note.title}</h1>
          <div className="mt-4 flex flex-wrap gap-3 text-sm text-[var(--muted)]">
            <time dateTime={note.updatedAt}>更新于 {formattedDate}</time>
            <span>{sourceLabel}</span>
          </div>
          {tags.length > 0 ? (
            <div className="mt-5 flex flex-wrap gap-2">
              {tags.map((tag) => (
                <TagPill key={tag} name={tag} />
              ))}
            </div>
          ) : null}
        </header>
        <div className="mt-10">
          <MarkdownView sanitizedHtml={note.contentHtml} />
        </div>
      </article>
    </main>
  );
}
