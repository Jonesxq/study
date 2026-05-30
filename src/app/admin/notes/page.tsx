import Link from 'next/link';
import { DeleteNoteButton } from './delete-note-button';
import { getDatabase } from '@/lib/db/client';
import { listAdminNotes } from '@/lib/db/notes';

export const dynamic = 'force-dynamic';

const statusLabels = {
  public: '公开',
  draft: '草稿',
  archived: '归档',
  removed: '已移除',
};

const sourceLabels = {
  local: '本地',
  feishu: '飞书',
};

export default function AdminNotesPage() {
  const notes = listAdminNotes(getDatabase());

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-normal">全部笔记</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">管理本地 Markdown 笔记，查看飞书同步内容。</p>
        </div>
        <Link href="/admin/notes/new" className="bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white">
          新建笔记
        </Link>
      </div>
      <div className="overflow-x-auto border border-[var(--line)] bg-[var(--surface)]">
        <table className="w-full min-w-[720px] border-collapse text-left text-sm">
          <thead className="border-b border-[var(--line)] text-[var(--muted)]">
            <tr>
              <th className="px-4 py-3 font-medium">标题</th>
              <th className="px-4 py-3 font-medium">来源</th>
              <th className="px-4 py-3 font-medium">状态</th>
              <th className="px-4 py-3 font-medium">更新时间</th>
              <th className="px-4 py-3 font-medium">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--line)]">
            {notes.map((note) => (
              <tr key={note.id} className="align-top">
                <td className="px-4 py-3 font-medium">{note.title}</td>
                <td className="px-4 py-3">{sourceLabels[note.sourceType]}</td>
                <td className="px-4 py-3">{statusLabels[note.status]}</td>
                <td className="px-4 py-3 text-[var(--muted)]">{formatDate(note.updatedAt)}</td>
                <td className="px-4 py-3">
                  <Link href={`/admin/notes/${note.id}/edit`} className="text-[var(--accent)] hover:underline">
                    编辑
                  </Link>
                  {note.sourceType === 'local' ? (
                    <form action={`/api/admin/notes/${note.id}/delete`} method="post" className="ml-3 inline">
                      <DeleteNoteButton title={note.title} />
                    </form>
                  ) : (
                    <span className="ml-3 text-[var(--muted)]">飞书同步</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {notes.length === 0 ? <p className="px-4 py-6 text-sm text-[var(--muted)]">还没有笔记。</p> : null}
      </div>
    </section>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('zh-CN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}
