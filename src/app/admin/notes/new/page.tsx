import { NoteForm } from '@/components/admin/NoteForm';

export default function NewAdminNotePage() {
  return (
    <section className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-normal">新建笔记</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">创建一篇本地 Markdown 笔记。</p>
      </div>
      <NoteForm action="/api/admin/notes" submitLabel="创建笔记" />
    </section>
  );
}
