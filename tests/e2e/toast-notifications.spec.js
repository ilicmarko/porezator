const { test, expect } = require('@playwright/test');
const { resetPage, goToStep, fillTradeFlow, generateFromPreview } = require('./helpers');

test.describe('Toast Notification System', () => {
  test.beforeEach(async ({ page }) => {
    await resetPage(page);
  });

  test('error toast appears on validation failure', async ({ page }) => {
    await page.fill('#year', '');
    await goToStep(page, 2);
    await page.fill('#salesCsv', '');
    await page.fill('#purchasesCsv', '');
    await generateFromPreview(page);
    await expect(page.locator('.toast-error')).toBeVisible({ timeout: 5000 });
  });

  test('close button dismisses toast', async ({ page }) => {
    await page.fill('#year', '');
    await goToStep(page, 2);
    await page.fill('#salesCsv', '');
    await page.fill('#purchasesCsv', '');
    await generateFromPreview(page);
    await expect(page.locator('.toast-error')).toBeVisible({ timeout: 5000 });
    await page.click('.toast-close');
    // Wait for the animation to complete
    await expect(page.locator('.toast')).toHaveCount(0, { timeout: 2000 });
  });

  test('success toast appears after generation', async ({ page }) => {
    await fillTradeFlow(page, {
      offline: true,
      buyCsv: '2025-01-15,AAPL,10,100,USD,117.5',
      sellCsv: '2025-06-20,AAPL,10,150,USD,118',
    });
    await generateFromPreview(page);
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
