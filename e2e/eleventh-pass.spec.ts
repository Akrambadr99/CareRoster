import { expect, test } from '@playwright/test'

test('roster coordinator cannot approve their own qualified transfer coverage', async ({ page }) => {
  await page.goto('/wards/WARD-ICU/coverage/2026-09-14')
  await page.getByRole('button', { name: 'Assign to shift' }).click()
  await page.getByLabel('Candidate').selectOption('RN-6')
  await page.getByRole('button', { name: 'Assign to shift' }).click()
  await page.goto('/wards/ICU/transfers/HDU?patients=1')
  await expect(page.getByText('Queue: clinical-review')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Approve transfer coverage' })).toBeDisabled()
  await page.getByLabel('Decision authority').selectOption('clinical lead')
  await page.getByRole('button', { name: 'Approve transfer coverage' }).click()
  await expect(page.getByText('Reviewer: clinical lead')).toBeVisible()
})
