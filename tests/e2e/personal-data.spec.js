const { test, expect } = require('@playwright/test');

test.describe('Personal Data Section', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  test('personal data section is collapsible', async ({ page }) => {
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
    await page.check('#offlineMode');
    await page.fill('#year', '2025');
    await page.selectOption('#half', 'H1');
    await page.fill('#filingDate', '2025-07-15');
    await page.fill('#purchasesCsv', '2025-01-15,AAPL,10,100,USD,117.5');
    await page.fill('#salesCsv', '2025-06-20,AAPL,10,150,USD,118');

    // Fill personal data
    await page.fill('#imeIPrezime', 'Test Korisnik');
    await page.fill('#jmbg', '0101990000000');

    await page.click('#generateBtn');
    await expect(page.locator('#preview')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('#preview')).toContainText('Test Korisnik');
    await expect(page.locator('#preview')).toContainText('0101990000000');
  });
});
