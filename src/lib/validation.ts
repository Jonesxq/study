import { z } from 'zod';

const editableStatuses = ['public', 'draft', 'archived'] as const;

export const noteInputSchema = z.object({
  title: z.string().trim().min(1, '标题不能为空'),
  summary: z.string().trim().max(160, '摘要不能超过 160 个字符'),
  contentMarkdown: z.string().trim().min(1, '正文不能为空'),
  status: z
    .string()
    .refine((status): status is (typeof editableStatuses)[number] => editableStatuses.includes(status as never), {
      message: '状态必须是公开、草稿或归档',
    }),
  tags: z
    .string()
    .transform((value) =>
      value
        .split(/[,，]/)
        .map((tag) => tag.trim())
        .filter(Boolean),
    ),
});

export type NoteInput = z.infer<typeof noteInputSchema>;
