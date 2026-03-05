const { test, expect } = require('@playwright/test');

const BUY_CSV = '2025-01-15,AAPL,10,100,USD';
const SELL_CSV = '2025-06-20,AAPL,10,150,USD';

// Mock external exchange-rate API via route interception
async function mockExchangeRate(page, rate = 117.5) {
  await page.route('**/kurs.resenje.org/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ exchange_middle: rate, date: '2025-01-15' }),
    })
  );
  // Also mock our own proxy endpoint (server still calls external)
  await page.route('**/api/exchange-rate/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ exchange_middle: rate }),
    })
  );
}

async function fillForm(page, { buyCsv = BUY_CSV, sellCsv = SELL_CSV } = {}) {
  await page.fill('#year', '2025');
  await page.selectOption('#half', 'H1');
  await page.fill('#filingDate', '2025-07-15');
  await page.fill('#purchasesCsv', buyCsv);
  await page.fill('#salesCsv', sellCsv);
}

test.describe('Online XML Generation', () => {
  test.beforeEach(async ({ page }) => {
    // Clear localStorage before each test
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  test('happy path — generates XML and shows summary', async ({ page }) => {
    await mockExchangeRate(page);
    await fillForm(page);
    await page.click('#generateBtn');
    await expect(page.locator('#preview')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('#preview')).toContainText('ns1:PodaciPoreskeDeklaracije');
    await expect(page.locator('#downloadBtn')).toBeEnabled();
  });

  test('summary table shows correct capital gain info', async ({ page }) => {
    await mockExchangeRate(page, 100);
    await fillForm(page);
    await page.click('#generateBtn');
    await expect(page.locator('#documentsCard')).toBeVisible({ timeout: 10000 });
    // With rate=100: sold = 10*150*100=150000, bought = 10*100*100=100000, gain=50000
    await expect(page.locator('#documentsList')).toContainText('50');
  });

  test('document list renders Prodaja and Kupovina', async ({ page }) => {
    await mockExchangeRate(page);
    await fillForm(page);
    await page.click('#generateBtn');
    await expect(page.locator('#documentsCard')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('#documentsList')).toContainText('Prodaja');
    await expect(page.locator('#documentsList')).toContainText('Kupovina');
  });

  test('multiple tickers in results', async ({ page }) => {
    await mockExchangeRate(page);
    const buyCsv = '2025-01-15,AAPL,10,100,USD\n2025-01-15,MSFT,5,200,USD';
    const sellCsv = '2025-06-20,AAPL,10,150,USD\n2025-06-20,MSFT,5,250,USD';
    await fillForm(page, { buyCsv, sellCsv });
    await page.click('#generateBtn');
    await expect(page.locator('#preview')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('#preview')).toContainText('AAPL');
    await expect(page.locator('#preview')).toContainText('MSFT');
  });
});
