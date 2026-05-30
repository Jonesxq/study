import { expect, test } from '@playwright/test';

test('public home is a Chinese notes site', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('未闲漫步')).toBeVisible();
  await expect(page.getByText('最近在想什么')).toBeVisible();
  await expect(page.getByRole('link', { name: '笔记' })).toBeVisible();
  await expect(page.getByRole('link', { name: '标签' })).toBeVisible();
});
