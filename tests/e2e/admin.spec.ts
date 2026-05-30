import { expect, test } from '@playwright/test';

test('admin area redirects to Chinese login page', async ({ page }) => {
  await page.goto('/admin');
  await expect(page).toHaveURL(/\/admin\/login/);
  await expect(page.getByRole('heading', { name: '登录后台' })).toBeVisible();
});
