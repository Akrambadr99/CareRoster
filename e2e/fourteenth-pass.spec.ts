import { expect, test } from '@playwright/test'

test('clinical claim and credential fan-out persist across navigation', async ({ page }) => {
  await page.goto('/coverage/shift-workspace?shift=ICU-NIGHT-15')
  await expect(page.getByLabel('Clinical queue')).toContainText('ICU-NIGHT-15')
  await page.getByRole('button', { name: 'Claim selected transfer review' }).click()
  await expect(page.getByRole('status')).toContainText('claimed')
  await page.goto('/operations')
  await page.goto('/coverage/shift-workspace?shift=ICU-NIGHT-15')
  await expect(page.getByLabel('Selected shift')).toContainText('lead-mira')
  await page.getByRole('button', { name: 'Toggle linked RN-1 credential' }).click()
  await expect(page.getByRole('status')).toContainText('related shifts updated')
  await expect(page.getByLabel('Selected shift')).toContainText('roster r5')
  await page.reload()
  await expect(page.getByLabel('Selected shift')).toContainText('roster r5')
  await page.getByLabel('Shift collection').getByRole('button', { name: /ED-NIGHT-15/ }).click()
  await expect(page.getByLabel('Selected shift')).toContainText('roster r3')
})
