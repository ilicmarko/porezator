const { test, expect } = require('@playwright/test');
const { resetPage, fillTradeFlow, generateFromPreview } = require('./helpers');

const BUY_CSV_OFFLINE = '2025-01-15,AAPL,10,100,USD,117.5';
const SELL_CSV_OFFLINE = '2025-06-20,AAPL,10,150,USD,118.0';

async function fillFormOffline(page, { buyCsv = BUY_CSV_OFFLINE, sellCsv = SELL_CSV_OFFLINE } = {}) {
  await fillTradeFlow(page, { buyCsv, sellCsv });
}

test.describe('Local Generation', () => {
  test.beforeEach(async ({ page }) => {
    await resetPage(page);
  });

  test('step 0 highlights local generation by default', async ({ page }) => {
    await expect(page.locator('#modeNote')).toBeVisible();
    await expect(page.locator('#modeNote')).toContainText(/Podrazumevano lokalno/i);
  });

  test('client-side generation produces XML without calling generate API', async ({ page }) => {
    await fillFormOffline(page);

    const apiCalls = [];
    page.on('request', (req) => {
      if (req.url().includes('/api/generate')) apiCalls.push(req);
    });

    await generateFromPreview(page);
    await expect(page.locator('#preview')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('#preview')).toContainText('ns1:PodaciPoreskeDeklaracije');
    expect(apiCalls).toHaveLength(0);
  });

  test('missing rates in 5-column CSV shows error', async ({ page }) => {
    await fillFormOffline(page, {
      buyCsv: '2025-01-15,AAPL,10,100,USD',
      sellCsv: '2025-06-20,AAPL,10,150,USD',
    });

    await generateFromPreview(page);
    await expect(page.locator('.toast-error')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('.toast-msg')).toContainText('srednji_kurs');
  });
});
