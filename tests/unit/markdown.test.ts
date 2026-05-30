import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { createElement } from 'react';
import { MarkdownView } from '@/components/public/MarkdownView';
import { renderMarkdown } from '@/lib/markdown/render';
import { summarizeMarkdown } from '@/lib/markdown/summarize';

describe('markdown rendering', () => {
  it('renders Chinese Markdown and removes unsafe html', async () => {
    const html = await renderMarkdown('# 标题\n\n正文 **重点**\n\n<script>alert(1)</script>');
    expect(html).toContain('<h1>标题</h1>');
    expect(html).toContain('<strong>重点</strong>');
    expect(html).not.toContain('<script>');
  });

  it('removes unsafe links, images, and raw html attributes', async () => {
    const html = await renderMarkdown(
      [
        '[x](javascript:alert(1))',
        '![x](javascript:alert(1))',
        '<img src=x onerror=alert(1)>',
        '<a href="javascript:alert(1)">x</a>'
      ].join('\n\n')
    );

    expect(html).not.toContain('javascript:');
    expect(html).not.toContain('onerror');
    expect(html).not.toContain('<img');
    expect(html).not.toContain('href="javascript:');
  });

  it('renders sanitized html through the public Markdown view', () => {
    render(createElement(MarkdownView, { sanitizedHtml: '<p>正文 <strong>重点</strong></p>' }));

    expect(screen.getByText('重点')).toBeTruthy();
  });

  it('creates a short plain Chinese summary', () => {
    expect(summarizeMarkdown('# 标题\n\n这是第一段内容，用来生成摘要。', 12)).toBe('这是第一段内容，用来生成...');
  });

  it('summarizes links, images, code fences, html, hyphens, and emoji safely', () => {
    expect(summarizeMarkdown('[链接](https://example.com/a_(b)) 后续')).toBe('链接 后续');
    expect(summarizeMarkdown('前文 ![替代文字](https://example.com/a_(b).png) 后文')).toBe('前文 后文');
    expect(summarizeMarkdown('正文\n\n```ts\nconst a = 1;\n```\n\n~~~js\nalert(1)\n~~~\n\n结尾')).toBe('正文 结尾');
    expect(summarizeMarkdown('<p>中文，<strong>重点</strong>。</p><div onclick="x">继续</div>')).toBe(
      '中文，重点。继续'
    );
    expect(summarizeMarkdown('- 列表项\n普通-text 1-3')).toBe('列表项 普通-text 1-3');
    expect(summarizeMarkdown('😀😀😀正文', 3)).toBe('😀😀😀...');
  });
});
