const { test, expect } = require('@playwright/test');

test.describe('Validation & Error Handling', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  test('empty form shows validation error', async ({ page }) => {
    // Clear any default values
    await page.fill('#year', '');
    await page.fill('#filingDate', '');
    await page.fill('#salesCsv', '');
    await page.fill('#purchasesCsv', '');

    await page.click('#generateBtn');
    await expect(page.locator('.toast-error')).toBeVisible({ timeout: 5000 });
  });

  test('empty buy CSV shows error about missing purchases', async ({ page }) => {
    // Use offline mode to avoid network dependency
    await page.check('#offlineMode');
    await page.fill('#year', '2025');
    await page.selectOption('#half', 'H1');
    await page.fill('#filingDate', '2025-07-15');
    await page.fill('#salesCsv', '2025-06-20,AAPL,10,150,USD,118');
    await page.fill('#purchasesCsv', '');

    await page.click('#generateBtn');
    await expect(page.locator('.toast-error')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('.toast-msg')).toContainText(/kupovina/i);
  });

  test('empty sell CSV shows error about missing sales', async ({ page }) => {
    await page.check('#offlineMode');
    await page.fill('#year', '2025');
    await page.selectOption('#half', 'H1');
    await page.fill('#filingDate', '2025-07-15');
    await page.fill('#purchasesCsv', '2025-01-15,AAPL,10,100,USD,117.5');
    await page.fill('#salesCsv', '');

    await page.click('#generateBtn');
    await expect(page.locator('.toast-error')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('.toast-msg')).toContainText(/prodaj/i);
  });

  test('FIFO mismatch without force shows coverage error', async ({ page }) => {
    await page.check('#offlineMode');
    await page.fill('#year', '2025');
    await page.selectOption('#half', 'H1');
    await page.fill('#filingDate', '2025-07-15');
    await page.fill('#purchasesCsv', '2025-01-15,AAPL,5,100,USD,117.5');
    await page.fill('#salesCsv', '2025-06-20,AAPL,10,150,USD,118');

    await page.click('#generateBtn');
    await expect(page.locator('.toast-error')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('.toast-msg')).toContainText(/Nedovoljno|pokrić/i);
  });

  test('force checkbox bypasses coverage error', async ({ page }) => {
    await page.check('#offlineMode');
    await page.fill('#year', '2025');
    await page.selectOption('#half', 'H1');
    await page.fill('#filingDate', '2025-07-15');
    await page.fill('#purchasesCsv', '2025-01-15,AAPL,5,100,USD,117.5');
    await page.fill('#salesCsv', '2025-06-20,AAPL,10,150,USD,118');

    // First attempt triggers coverage error
    await page.click('#generateBtn');
    await expect(page.locator('.toast-error')).toBeVisible({ timeout: 5000 });

    // Reveal the force override section (normally done by validateCoverage)
    await page.evaluate(() => {
      document.getElementById('forceOverride').style.display = 'block';
    });
    await page.check('#forceCheckbox');

    // Dismiss existing toast and retry
    await page.click('.toast-close');
    await page.click('#generateBtn');
    await expect(page.locator('#preview')).toBeVisible({ timeout: 5000 });
  });
});
