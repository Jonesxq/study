import { TagPill } from './TagPill';

export type NoteCardData = {
  id: string;
  title: string;
  summary: string;
  updatedAt: string;
  tags: string[];
};

export function NoteCard({ note }: { note: NoteCardData }) {
  const formattedDate = new Intl.DateTimeFormat('zh-CN', {
    dateStyle: 'medium',
    timeZone: 'UTC',
  }).format(new Date(note.updatedAt));

  return (
    <article className="border-b border-[var(--line)] py-6">
      <div className="flex flex-col gap-2">
        <a className="text-xl font-semibold text-[var(--text)] hover:underline" href={`/notes/${note.id}`}>
          {note.title}
        </a>
        <time className="text-sm text-[var(--muted)]" dateTime={note.updatedAt}>
          更新于 {formattedDate}
        </time>
      </div>
      {note.summary ? <p className="mt-3 leading-7 text-[var(--muted)]">{note.summary}</p> : null}
      {note.tags.length > 0 ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {note.tags.map((tag) => (
            <TagPill key={tag} name={tag} />
          ))}
        </div>
      ) : null}
    </article>
  );
}
