import { expect, test } from '@playwright/test'
test('credentialed shift addition updates hourly coverage', async ({ page }) => {
  await page.goto('/wards/WARD-ICU/coverage/2026-09-14')
  await expect(page.getByText('Critical care RN at 21:00', { exact: false })).toBeVisible()
  await page.getByRole('button', { name: 'Assign to shift' }).click()
  await expect(page.getByRole('status')).toContainText('added to the Night shift')
  await page.getByLabel('Candidate').selectOption('RN-5')
  await expect(page.getByText('Credential expired before the shift.')).toBeVisible()
})
