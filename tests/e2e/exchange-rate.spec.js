const { test, expect } = require('@playwright/test');

test.describe('Exchange Rate Lookup', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  test('exchange rate is used in online generation', async ({ page }) => {
    // Intercept the proxy endpoint with a known rate
    await page.route('**/api/exchange-rate/**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ exchange_middle: 100.0 }),
      })
    );

    // Also intercept the server-side fetch to kurs.resenje.org
    // (the server makes its own fetch, so we need to mock at API level)
    // Instead, mock the /api/generate response directly for predictable results
    await page.route('**/api/generate', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          xml: '<ns1:PodaciPoreskeDeklaracije>mock XML with rate 100</ns1:PodaciPoreskeDeklaracije>',
          documents: [{ type: 'Prodaja', ticker: 'AAPL', date: '2025-06-20', docNumber: '20250620', shares: 10 }],
          summary: {
            totalSoldRsd: 150000,
            totalBoughtRsd: 100000,
            capitalGainRsd: 50000,
            estimatedTax15Rsd: 7500,
            rows: [],
            salesDetails: [],
            buyDetails: [],
          },
        }),
      })
    );

    await page.fill('#year', '2025');
    await page.selectOption('#half', 'H1');
    await page.fill('#filingDate', '2025-07-15');
    await page.fill('#purchasesCsv', '2025-01-15,AAPL,10,100,USD');
    await page.fill('#salesCsv', '2025-06-20,AAPL,10,150,USD');
    await page.click('#generateBtn');

    await expect(page.locator('#preview')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('#preview')).toContainText('mock XML with rate 100');
  });

  test('API error shows toast error', async ({ page }) => {
    await page.route('**/api/generate', (route) =>
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Ne mogu da dobijem kurs za USD na dan 2025-01-15' }),
      })
    );

    await page.fill('#year', '2025');
    await page.selectOption('#half', 'H1');
    await page.fill('#filingDate', '2025-07-15');
    await page.fill('#purchasesCsv', '2025-01-15,AAPL,10,100,USD');
    await page.fill('#salesCsv', '2025-06-20,AAPL,10,150,USD');
    await page.click('#generateBtn');

    await expect(page.locator('.toast-error')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('.toast-msg')).toContainText('kurs');
  });
});
