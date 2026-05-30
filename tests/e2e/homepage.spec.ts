import { expect, test } from '@playwright/test';

test('homepage renders the public shell', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByText('未闲漫步')).toBeVisible();
  await expect(page.getByRole('heading', { name: '最近在想什么' })).toBeVisible();
  await expect(page.getByRole('link', { name: '笔记' })).toBeVisible();
  await expect(page.getByRole('link', { name: '标签' })).toBeVisible();
  await expect(page.getByRole('link', { name: '搜索' })).toBeVisible();
  await expect(page.getByRole('link', { name: '关于' })).toBeVisible();
});
