import { expect, test } from '@playwright/test';

test('login, create a lead, and open the dashboard', async ({ page }) => {
  await page.goto('/login');
  await page.getByTestId('login-email').fill('admin@aijewel.local');
  await page.getByTestId('login-password').fill(process.env.SEED_PASSWORD ?? 'Local-demo-1234');
  await page.getByTestId('login-submit').click();
  await expect(page.getByTestId('dashboard-leads')).toBeVisible();
  await page.getByRole('link', { name: 'Leads' }).click();
  await page.getByTestId('lead-name').fill('E2E Kumar');
  await page.getByTestId('lead-phone').fill('9876501234');
  await page.getByTestId('lead-create').click();
  await page.getByTestId('lead-search').fill('E2E Kumar');
  await page.getByRole('button', { name: 'Apply filters' }).click();
  await expect(page.getByRole('link', { name: 'E2E Kumar' })).toBeVisible();
});
