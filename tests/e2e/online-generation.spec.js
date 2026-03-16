const { test, expect } = require('@playwright/test');
const { resetPage, fillTradeFlow, generateFromPreview, prefillServerRates } = require('./helpers');

const BUY_CSV = '2025-01-15,AAPL,10,100,USD';
const SELL_CSV = '2025-06-20,AAPL,10,150,USD';

async function mockExchangeRates(page, rate = 117.5) {
  await page.route('**/api/exchange-rates', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        rates: {
          'USD|2025-01-15': rate,
          'USD|2025-06-20': rate,
        },
      }),
    })
  );
}

async function fillForm(page, { buyCsv = BUY_CSV, sellCsv = SELL_CSV } = {}) {
  await fillTradeFlow(page, { buyCsv, sellCsv });
}

test.describe('Client XML Generation', () => {
  test.beforeEach(async ({ page }) => {
    await resetPage(page);
  });

  test('happy path — generates XML and shows summary', async ({ page }) => {
    await mockExchangeRates(page);
    await fillForm(page);
    await prefillServerRates(page);
    await generateFromPreview(page);
    await expect(page.locator('#preview')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('#preview')).toContainText('ns1:PodaciPoreskeDeklaracije');
    await expect(page.locator('#downloadBtn')).toBeEnabled();
  });

  test('summary table shows correct capital gain info', async ({ page }) => {
    await mockExchangeRates(page, 100);
    await fillForm(page);
    await prefillServerRates(page);
    await generateFromPreview(page);
    await expect(page.locator('#documentsCard')).toBeVisible({ timeout: 10000 });
    // With rate=100: sold = 10*150*100=150000, bought = 10*100*100=100000, gain=50000
    await expect(page.locator('#documentsList')).toContainText('50');
  });

  test('document list renders Prodaja and Kupovina', async ({ page }) => {
    await mockExchangeRates(page);
    await fillForm(page);
    await prefillServerRates(page);
    await generateFromPreview(page);
    await expect(page.locator('#documentsCard')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('#documentsList')).toContainText('Prodaja');
    await expect(page.locator('#documentsList')).toContainText('Kupovina');
  });

  test('multiple tickers in results', async ({ page }) => {
    await page.route('**/api/exchange-rates', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          rates: {
            'USD|2025-01-15': 117.5,
            'USD|2025-06-20': 117.5,
          },
        }),
      })
    );
    const buyCsv = '2025-01-15,AAPL,10,100,USD\n2025-01-15,MSFT,5,200,USD';
    const sellCsv = '2025-06-20,AAPL,10,150,USD\n2025-06-20,MSFT,5,250,USD';
    await fillForm(page, { buyCsv, sellCsv });
    await prefillServerRates(page);
    await generateFromPreview(page);
    await expect(page.locator('#preview')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('#preview')).toContainText('AAPL');
    await expect(page.locator('#preview')).toContainText('MSFT');
  });
});
