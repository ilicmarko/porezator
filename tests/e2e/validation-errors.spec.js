const { test, expect } = require('@playwright/test');
const { resetPage, goToStep, fillTradeFlow, generateFromPreview, openPreviewStep } = require('./helpers');

test.describe('Validation & Error Handling', () => {
  test.beforeEach(async ({ page }) => {
    await resetPage(page);
  });

  test('empty form shows validation error', async ({ page }) => {
    // Clear any default values
    await page.fill('#year', '');
    await page.fill('#filingDate', '');
    await goToStep(page, 2);
    await page.fill('#salesCsv', '');
    await page.fill('#purchasesCsv', '');

    await generateFromPreview(page);
    await expect(page.locator('.toast-error')).toBeVisible({ timeout: 5000 });
  });

  test('empty buy CSV shows error about missing purchases', async ({ page }) => {
    await fillTradeFlow(page, {
      offline: true,
      buyCsv: '',
      sellCsv: '2025-06-20,AAPL,10,150,USD,118',
    });

    await generateFromPreview(page);
    await expect(page.locator('.toast-error')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('.toast-msg')).toContainText(/kupovina/i);
  });

  test('empty sell CSV shows error about missing sales', async ({ page }) => {
    await fillTradeFlow(page, {
      offline: true,
      buyCsv: '2025-01-15,AAPL,10,100,USD,117.5',
      sellCsv: '',
    });

    await generateFromPreview(page);
    await expect(page.locator('.toast-error')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('.toast-msg')).toContainText(/prodaj/i);
  });

  test('FIFO mismatch without force shows coverage error', async ({ page }) => {
    await fillTradeFlow(page, {
      offline: true,
      buyCsv: '2025-01-15,AAPL,5,100,USD,117.5',
      sellCsv: '2025-06-20,AAPL,10,150,USD,118',
    });

    await generateFromPreview(page);
    await expect(page.locator('.toast-error')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('.toast-msg')).toContainText(/Nedovoljno|pokrić/i);
  });

  test('force checkbox bypasses coverage error', async ({ page }) => {
    await fillTradeFlow(page, {
      offline: true,
      buyCsv: '2025-01-15,AAPL,5,100,USD,117.5',
      sellCsv: '2025-06-20,AAPL,10,150,USD,118',
    });

    // First attempt triggers coverage error
    await generateFromPreview(page);
    await expect(page.locator('.toast-error')).toBeVisible({ timeout: 5000 });

    await openPreviewStep(page);
    await page.check('#forceCheckbox');

    // Dismiss existing toast and retry
    await page.click('.toast-close');
    await page.click('#generateBtn');
    await expect(page.locator('#preview')).toBeVisible({ timeout: 5000 });
  });
});
