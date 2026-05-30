import type { FeishuBlock } from './types';

export function blocksToMarkdown(blocks: FeishuBlock[]): string {
  return blocks
    .map(blockToMarkdown)
    .filter((markdown) => markdown.length > 0)
    .join('\n\n');
}

function blockToMarkdown(block: FeishuBlock): string {
  switch (block.type) {
    case 'heading': {
      const level = Math.min(Math.max(Math.trunc(block.level), 1), 6);
      return `${'#'.repeat(level)} ${escapeMarkdownInline(cleanText(block.text))}`.trim();
    }
    case 'text':
      return escapeMarkdownInline(cleanText(block.text));
    case 'bullet':
      return `- ${escapeMarkdownInline(cleanText(block.text))}`.trimEnd();
    case 'ordered':
      return `${block.number ?? 1}. ${escapeMarkdownInline(cleanText(block.text))}`.trimEnd();
    case 'image': {
      const target = block.path ?? (block.token ? `/uploads/feishu/${encodeURIComponent(block.token)}` : '');
      if (!target) return '';
      return `![${escapeMarkdownImageAlt(cleanText(block.alt))}](${target})`;
    }
    case 'divider':
      return '---';
    case 'code': {
      const language = (block.language ?? '').replace(/[^A-Za-z0-9_+#.-]/g, '');
      const text = block.text ?? '';
      const fence = text.includes('```') ? '````' : '```';
      return [`${fence}${language}`, text, fence].join('\n');
    }
  }
}

function cleanText(value?: string): string {
  return (value ?? '').replace(/\r\n?/g, '\n').trim();
}

function escapeMarkdownInline(value: string): string {
  return value.replace(/[\\`*_{}\[\]()#+\-.!|>]/g, '\\$&');
}

function escapeMarkdownImageAlt(value: string): string {
  return value.replace(/[\]\\]/g, '\\$&');
}
