import { expect, test } from '@playwright/test';

test('import, message, campaign, meeting, and voice call', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto('/login');
  await page.getByTestId('login-email').fill('admin@aijewel.local');
  await page.getByTestId('login-password').fill(process.env.SEED_PASSWORD ?? 'Local-demo-1234');
  await page.getByTestId('login-submit').click();
  await expect(page.getByTestId('dashboard-leads')).toBeVisible();

  await page.getByRole('link', { name: 'Imports' }).click();
  await page.getByTestId('import-group').click();
  await expect(page.getByTestId('import-summary')).toContainText(/Successful: (500|0)/);
  await expect(page.getByTestId('import-summary')).toContainText('Total rows: 500');

  await page.getByRole('link', { name: 'Leads' }).click();
  await page.getByTestId('lead-search').fill('+919810000001');
  await page.getByRole('button', { name: 'Apply filters' }).click();
  await page.getByRole('link', { name: 'Anitha Khan' }).first().click();
  await expect(page.getByRole('heading', { name: 'Anitha Khan' })).toBeVisible();

  await page.getByRole('button', { name: 'WhatsApp' }).click();
  await expect(page.getByTestId('whatsapp-thread')).toBeVisible();
  await page.getByTestId('whatsapp-send').click();
  await expect(page.getByTestId('whatsapp-thread')).toContainText('12 months');
  await expect(page.getByTestId('whatsapp-thread')).toContainText('READ');

  await page.goBack();
  await page.getByRole('link', { name: 'Send campaign' }).click();
  await page.getByRole('button', { name: 'Save draft' }).click();
  await expect(page.getByTestId('preview-campaign')).toBeVisible();
  await page.getByTestId('preview-campaign').click();
  await expect(page.getByTestId('preview-message')).toContainText('Anitha');
  await expect(page.getByTestId('preview-message')).toContainText('Fatima Jewellers');

  await page.getByRole('button', { name: 'Move to REVIEW' }).click();
  await page.getByRole('button', { name: 'Move to APPROVED' }).click();
  await page.getByRole('button', { name: 'Move to SCHEDULED' }).click();
  await page.getByTestId('execute-campaign').click();
  await expect(page.getByText('REPORT')).toBeVisible();

  await page.getByRole('link', { name: 'Leads' }).click();
  await page.getByTestId('lead-search').fill('+919810000001');
  await page.getByRole('button', { name: 'Apply filters' }).click();
  await page.getByRole('link', { name: 'Anitha Khan' }).first().click();
  await page.getByTestId('meeting-date').fill('2026-12-15');
  await page.getByTestId('book-meeting').click();
  await expect(page.locator('#meeting').getByRole('button', { name: 'Cancel' })).toBeVisible();

  await page.getByTestId('start-voice').click();
  await expect(page.getByTestId('lead-timeline')).toContainText('CALL_MADE');
  await expect(page.locator('audio').first()).toBeVisible();
});
