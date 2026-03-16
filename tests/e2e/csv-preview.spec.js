const { test, expect } = require('@playwright/test');
const { resetPage, fillTradeFlow, openPreviewStep } = require('./helpers');

test.describe('CSV Preview Tables', () => {
  test.beforeEach(async ({ page }) => {
    await resetPage(page);
  });

  test('buy table renders after clicking load', async ({ page }) => {
    await fillTradeFlow(page, { buyCsv: '2025-01-15,AAPL,10,100,USD' });
    await openPreviewStep(page);
    await expect(page.locator('#purchasesTable')).toBeVisible();
    await expect(page.locator('#purchasesTable')).toContainText('AAPL');
  });

  test('sell table renders after clicking load', async ({ page }) => {
    await fillTradeFlow(page, { sellCsv: '2025-06-20,AAPL,10,150,USD' });
    await openPreviewStep(page);
    await expect(page.locator('#salesTable')).toBeVisible();
    await expect(page.locator('#salesTable')).toContainText('AAPL');
  });

  test('6-column offline CSV shows srednji_kurs column', async ({ page }) => {
    await fillTradeFlow(page, { sellCsv: '2025-06-20,AAPL,10,150,USD,118' });
    await openPreviewStep(page);
    await expect(page.locator('#salesTable')).toBeVisible();
    await expect(page.locator('#salesTable')).toContainText('118');
  });

  test('empty CSV shows nothing or hides table', async ({ page }) => {
    await fillTradeFlow(page, { sellCsv: '' });
    await openPreviewStep(page);
    // Table should be hidden or have no data rows
    const rows = page.locator('#salesTable tr');
    const count = await rows.count();
    // Only header or nothing
    expect(count).toBeLessThanOrEqual(1);
  });
});
