import { describe, expect, it } from 'vitest';
import { renderMarkdown } from '@/lib/markdown/render';
import { summarizeMarkdown } from '@/lib/markdown/summarize';

describe('markdown rendering', () => {
  it('renders Chinese Markdown and removes unsafe html', async () => {
    const html = await renderMarkdown('# 标题\n\n正文 **重点**\n\n<script>alert(1)</script>');
    expect(html).toContain('<h1>标题</h1>');
    expect(html).toContain('<strong>重点</strong>');
    expect(html).not.toContain('<script>');
  });

  it('creates a short plain Chinese summary', () => {
    expect(summarizeMarkdown('# 标题\n\n这是第一段内容，用来生成摘要。', 12)).toBe('这是第一段内容，用来生成...');
  });
});
