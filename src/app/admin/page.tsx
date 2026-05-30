import Link from 'next/link';
import { getDatabase } from '@/lib/db/client';
import { listAdminNotes } from '@/lib/db/notes';

export const dynamic = 'force-dynamic';

export default function AdminDashboardPage() {
  const notes = listAdminNotes(getDatabase());
  const counts = [
    { label: '总笔记', value: notes.length },
    { label: '公开', value: notes.filter((note) => note.status === 'public').length },
    { label: '草稿', value: notes.filter((note) => note.status === 'draft').length },
    { label: '本地', value: notes.filter((note) => note.sourceType === 'local').length },
    { label: '飞书', value: notes.filter((note) => note.sourceType === 'feishu').length },
  ];

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-normal">总览</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">查看笔记库状态和最近更新。</p>
        </div>
        <Link href="/admin/notes/new" className="bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white">
          新建笔记
        </Link>
      </div>
      <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {counts.map((count) => (
          <div key={count.label} className="border border-[var(--line)] bg-[var(--surface)] px-4 py-3">
            <dt className="text-sm text-[var(--muted)]">{count.label}</dt>
            <dd className="mt-2 text-2xl font-semibold">{count.value}</dd>
          </div>
        ))}
      </dl>
      <section>
        <h2 className="text-base font-semibold">最近更新</h2>
        <div className="mt-3 divide-y divide-[var(--line)] border border-[var(--line)] bg-[var(--surface)]">
          {notes.slice(0, 8).map((note) => (
            <Link key={note.id} href={`/admin/notes/${note.id}/edit`} className="grid gap-1 px-4 py-3 hover:bg-white">
              <span className="font-medium">{note.title}</span>
              <span className="text-xs text-[var(--muted)]">{formatDate(note.updatedAt)}</span>
            </Link>
          ))}
          {notes.length === 0 ? <p className="px-4 py-6 text-sm text-[var(--muted)]">还没有笔记。</p> : null}
        </div>
      </section>
    </section>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('zh-CN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}
