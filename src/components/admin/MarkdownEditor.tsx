'use client';

import { useMemo, useState } from 'react';

type MarkdownEditorProps = {
  name?: string;
  defaultValue?: string;
};

export function MarkdownEditor({ name = 'contentMarkdown', defaultValue = '' }: MarkdownEditorProps) {
  const [markdown, setMarkdown] = useState(defaultValue);
  const previewBlocks = useMemo(() => buildPreviewBlocks(markdown), [markdown]);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <label className="block">
        <span className="mb-2 block text-sm font-medium">正文 Markdown</span>
        <textarea
          name={name}
          value={markdown}
          onChange={(event) => setMarkdown(event.target.value)}
          className="min-h-[420px] w-full resize-y border border-[var(--line)] bg-white px-4 py-3 font-mono text-sm leading-7 outline-none focus:border-[var(--accent)]"
          required
        />
      </label>
      <section aria-label="Markdown 预览" className="min-h-[420px] border border-[var(--line)] bg-white px-5 py-4">
        <p className="mb-4 text-sm font-medium">预览</p>
        <div className="space-y-3 text-sm leading-7">{previewBlocks}</div>
      </section>
    </div>
  );
}

function buildPreviewBlocks(markdown: string) {
  const lines = markdown.split(/\r?\n/);
  const blocks = lines.map((line, index) => {
    const trimmed = line.trim();

    if (!trimmed) {
      return <div key={index} className="h-3" />;
    }

    const heading = /^(#{1,3})\s+(.+)$/.exec(trimmed);
    if (heading) {
      const level = heading[1]?.length ?? 1;
      const className = level === 1 ? 'text-xl font-semibold' : level === 2 ? 'text-lg font-semibold' : 'font-semibold';
      return (
        <p key={index} className={className}>
          {heading[2]}
        </p>
      );
    }

    const listItem = /^[-*+]\s+(.+)$/.exec(trimmed);
    if (listItem) {
      return (
        <p key={index} className="pl-4">
          <span aria-hidden="true">- </span>
          {listItem[1]}
        </p>
      );
    }

    return <p key={index}>{trimmed}</p>;
  });

  return blocks.length > 0 ? blocks : <p className="text-[var(--muted)]">开始输入后会显示安全预览。</p>;
}
