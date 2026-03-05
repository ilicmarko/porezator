const { test, expect } = require('@playwright/test');

test.describe('Toast Notification System', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  test('error toast appears on validation failure', async ({ page }) => {
    await page.fill('#year', '');
    await page.fill('#salesCsv', '');
    await page.fill('#purchasesCsv', '');
    await page.click('#generateBtn');
    await expect(page.locator('.toast-error')).toBeVisible({ timeout: 5000 });
  });

  test('close button dismisses toast', async ({ page }) => {
    await page.fill('#year', '');
    await page.fill('#salesCsv', '');
    await page.fill('#purchasesCsv', '');
    await page.click('#generateBtn');
    await expect(page.locator('.toast-error')).toBeVisible({ timeout: 5000 });
    await page.click('.toast-close');
    // Wait for the animation to complete
    await expect(page.locator('.toast')).toHaveCount(0, { timeout: 2000 });
  });

  test('success toast appears after generation', async ({ page }) => {
    await page.check('#offlineMode');
    await page.fill('#year', '2025');
    await page.selectOption('#half', 'H1');
    await page.fill('#filingDate', '2025-07-15');
    await page.fill('#purchasesCsv', '2025-01-15,AAPL,10,100,USD,117.5');
    await page.fill('#salesCsv', '2025-06-20,AAPL,10,150,USD,118');
    await page.click('#generateBtn');
    await expect(page.locator('.toast-success')).toBeVisible({ timeout: 5000 });
  });

  test('multiple errors stack as separate toasts', async ({ page }) => {
    // Trigger first error
    await page.evaluate(() => showAlert('Error 1', 'error'));
    await page.evaluate(() => showAlert('Error 2', 'error'));
    const toasts = page.locator('.toast');
    await expect(toasts).toHaveCount(2, { timeout: 3000 });
  });
});
