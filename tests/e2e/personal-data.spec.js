const { test, expect } = require('@playwright/test');
const { resetPage, goToStep, fillTradeFlow, generateFromPreview } = require('./helpers');

test.describe('Personal Data Section', () => {
  test.beforeEach(async ({ page }) => {
    await resetPage(page);
  });

  test('personal data section is collapsible', async ({ page }) => {
    await goToStep(page, 1);
    const details = page.locator('#personalDataCard');

    // Should start open
    await expect(details).toHaveAttribute('open', '');

    // Click summary to collapse
    await page.click('#personalDataCard > summary');
    await expect(details).not.toHaveAttribute('open', '');

    // Click again to expand
    await page.click('#personalDataCard > summary');
    await expect(details).toHaveAttribute('open', '');
  });

  test('personal data appears in generated XML', async ({ page }) => {
    await fillTradeFlow(page, {
      offline: true,
      buyCsv: '2025-01-15,AAPL,10,100,USD,117.5',
      sellCsv: '2025-06-20,AAPL,10,150,USD,118',
    });

    // Fill personal data
    await goToStep(page, 1);
    await page.fill('#imeIPrezime', 'Test Korisnik');
    await page.fill('#jmbg', '0101990000000');

    await generateFromPreview(page);
    await expect(page.locator('#preview')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('#preview')).toContainText('Test Korisnik');
    await expect(page.locator('#preview')).toContainText('0101990000000');
  });
});
