const { test, expect } = require('@playwright/test');

const BUY_CSV_OFFLINE = '2025-01-15,AAPL,10,100,USD,117.5';
const SELL_CSV_OFFLINE = '2025-06-20,AAPL,10,150,USD,118.0';

async function fillFormOffline(page, { buyCsv = BUY_CSV_OFFLINE, sellCsv = SELL_CSV_OFFLINE } = {}) {
  await page.fill('#year', '2025');
  await page.selectOption('#half', 'H1');
  await page.fill('#filingDate', '2025-07-15');
  await page.fill('#purchasesCsv', buyCsv);
  await page.fill('#salesCsv', sellCsv);
}

test.describe('Offline Mode', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  test('toggle offline mode updates UI', async ({ page }) => {
    await page.check('#offlineMode');
    await expect(page.locator('#modeNote')).toBeVisible();
  });

  test('offline generation produces XML without server call', async ({ page }) => {
    await page.check('#offlineMode');
    await fillFormOffline(page);

    // Monitor network - no /api/generate call should happen
    const apiCalls = [];
    page.on('request', (req) => {
      if (req.url().includes('/api/generate')) apiCalls.push(req);
    });

    await page.click('#generateBtn');
    await expect(page.locator('#preview')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('#preview')).toContainText('ns1:PodaciPoreskeDeklaracije');
    expect(apiCalls).toHaveLength(0);
  });

  test('offline mode with 5-column CSV shows error', async ({ page }) => {
    await page.check('#offlineMode');
    await fillFormOffline(page, {
      buyCsv: '2025-01-15,AAPL,10,100,USD',
      sellCsv: '2025-06-20,AAPL,10,150,USD',
    });

    await page.click('#generateBtn');
    await expect(page.locator('.toast-error')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('.toast-msg')).toContainText('srednji_kurs');
  });
});
