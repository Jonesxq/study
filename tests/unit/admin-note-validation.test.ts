import { describe, expect, it } from 'vitest';
import { noteInputSchema } from '@/lib/validation';

describe('admin note validation', () => {
  it('accepts a valid note and trims split tags', () => {
    const result = noteInputSchema.parse({
      title: '  本地笔记  ',
      summary: '  一段摘要  ',
      contentMarkdown: '  正文内容  ',
      status: 'public',
      tags: '  阅读, Next.js， 生活  , ',
    });

    expect(result).toEqual({
      title: '本地笔记',
      summary: '一段摘要',
      contentMarkdown: '正文内容',
      status: 'public',
      tags: ['阅读', 'Next.js', '生活'],
    });
  });

  it('rejects an empty title with a Chinese error message', () => {
    const result = noteInputSchema.safeParse({
      title: '   ',
      summary: '',
      contentMarkdown: '正文内容',
      status: 'draft',
      tags: '',
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe('标题不能为空');
  });

  it('rejects empty markdown content with a Chinese error message', () => {
    const result = noteInputSchema.safeParse({
      title: '标题',
      summary: '',
      contentMarkdown: '   ',
      status: 'draft',
      tags: '',
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe('正文不能为空');
  });

  it('rejects overly long summaries with a Chinese error message', () => {
    const result = noteInputSchema.safeParse({
      title: '标题',
      summary: '摘'.repeat(161),
      contentMarkdown: '正文内容',
      status: 'draft',
      tags: '',
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe('摘要不能超过 160 个字符');
  });

  it('rejects status outside the admin note workflow', () => {
    const result = noteInputSchema.safeParse({
      title: '标题',
      summary: '',
      contentMarkdown: '正文内容',
      status: 'removed',
      tags: '',
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe('状态必须是公开、草稿或归档');
  });
});
