const { test, expect } = require('@playwright/test');

test.describe('CSV Preview Tables', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  test('buy table renders after clicking load', async ({ page }) => {
    await page.fill('#purchasesCsv', '2025-01-15,AAPL,10,100,USD');
    // Find the "Učitaj tabelu" button for purchases
    const loadBtn = page.locator('button', { hasText: 'Učitaj tabelu' }).nth(1);
    await loadBtn.click();
    await expect(page.locator('#purchasesTable')).toBeVisible();
    await expect(page.locator('#purchasesTable')).toContainText('AAPL');
  });

  test('sell table renders after clicking load', async ({ page }) => {
    await page.fill('#salesCsv', '2025-06-20,AAPL,10,150,USD');
    const loadBtn = page.locator('button', { hasText: 'Učitaj tabelu' }).first();
    await loadBtn.click();
    await expect(page.locator('#salesTable')).toBeVisible();
    await expect(page.locator('#salesTable')).toContainText('AAPL');
  });

  test('6-column offline CSV shows srednji_kurs column', async ({ page }) => {
    await page.fill('#salesCsv', '2025-06-20,AAPL,10,150,USD,118');
    const loadBtn = page.locator('button', { hasText: 'Učitaj tabelu' }).first();
    await loadBtn.click();
    await expect(page.locator('#salesTable')).toBeVisible();
    await expect(page.locator('#salesTable')).toContainText('118');
  });

  test('empty CSV shows nothing or hides table', async ({ page }) => {
    await page.fill('#salesCsv', '');
    const loadBtn = page.locator('button', { hasText: 'Učitaj tabelu' }).first();
    await loadBtn.click();
    // Table should be hidden or have no data rows
    const rows = page.locator('#salesTable tr');
    const count = await rows.count();
    // Only header or nothing
    expect(count).toBeLessThanOrEqual(1);
  });
});
