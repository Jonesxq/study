import { MarkdownEditor } from './MarkdownEditor';

type NoteFormProps = {
  action: string;
  submitLabel: string;
  note?: {
    title: string;
    summary: string;
    contentMarkdown: string;
    status: string;
    tags: string[];
  };
};

export function NoteForm({ action, submitLabel, note }: NoteFormProps) {
  return (
    <form action={action} method="post" className="space-y-5">
      <div className="grid gap-4 lg:grid-cols-[1fr_220px]">
        <label className="block">
          <span className="mb-2 block text-sm font-medium">标题</span>
          <input
            name="title"
            defaultValue={note?.title ?? ''}
            className="w-full border border-[var(--line)] bg-white px-4 py-3 outline-none focus:border-[var(--accent)]"
            required
          />
        </label>
        <label className="block">
          <span className="mb-2 block text-sm font-medium">状态</span>
          <select
            name="status"
            defaultValue={note?.status ?? 'draft'}
            className="w-full border border-[var(--line)] bg-white px-4 py-3 outline-none focus:border-[var(--accent)]"
          >
            <option value="draft">草稿</option>
            <option value="public">公开</option>
            <option value="archived">归档</option>
          </select>
        </label>
      </div>
      <label className="block">
        <span className="mb-2 block text-sm font-medium">摘要</span>
        <textarea
          name="summary"
          defaultValue={note?.summary ?? ''}
          maxLength={160}
          className="min-h-24 w-full resize-y border border-[var(--line)] bg-white px-4 py-3 outline-none focus:border-[var(--accent)]"
        />
      </label>
      <label className="block">
        <span className="mb-2 block text-sm font-medium">标签</span>
        <input
          name="tags"
          defaultValue={note?.tags.join(', ') ?? ''}
          className="w-full border border-[var(--line)] bg-white px-4 py-3 outline-none focus:border-[var(--accent)]"
          placeholder="阅读, 技术, 生活"
        />
      </label>
      <MarkdownEditor defaultValue={note?.contentMarkdown ?? ''} />
      <div className="flex items-center gap-3">
        <button type="submit" className="bg-[var(--accent)] px-5 py-3 text-sm font-medium text-white">
          {submitLabel}
        </button>
      </div>
    </form>
  );
}
