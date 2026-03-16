const { test, expect } = require('@playwright/test');
const { resetPage, fillTradeFlow, generateFromPreview, prefillServerRates, openPreviewStep } = require('./helpers');

test.describe('Exchange Rate Lookup', () => {
  test.beforeEach(async ({ page }) => {
    await resetPage(page);
  });

  test('prefill button populates rates and generation uses them', async ({ page }) => {
    await page.route('**/api/exchange-rates', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          rates: {
            'USD|2025-01-15': 100,
            'USD|2025-06-20': 100,
          },
        }),
      })
    );

    await fillTradeFlow(page, {
      buyCsv: '2025-01-15,AAPL,10,100,USD',
      sellCsv: '2025-06-20,AAPL,10,150,USD',
    });
    await prefillServerRates(page);
    await expect(page.locator('#salesTable .table-rate-input')).toHaveValue('100');
    await generateFromPreview(page);

    await expect(page.locator('#preview')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('#documentsList')).toContainText('50.000,00');
  });

  test('API error shows toast error', async ({ page }) => {
    await page.route('**/api/exchange-rates', (route) =>
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Ne mogu da dobijem kurs za USD na dan 2025-01-15' }),
      })
    );

    await fillTradeFlow(page, {
      buyCsv: '2025-01-15,AAPL,10,100,USD',
      sellCsv: '2025-06-20,AAPL,10,150,USD',
    });
    await openPreviewStep(page);
    await page.click('#prefillRatesBtn');

    await expect(page.locator('.toast-error')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('.toast-msg')).toContainText('kurs');
  });
});
