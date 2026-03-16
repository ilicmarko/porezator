const { test, expect } = require('@playwright/test');
const { resetPage, goToStep } = require('./helpers');

test.describe('Autosave & Restore', () => {
  test('form data persists after reload', async ({ page }) => {
    await resetPage(page);

    await page.fill('#year', '2024');
    await page.selectOption('#half', 'H2');
    await goToStep(page, 2);
    await page.fill('#salesCsv', '2024-12-01,GOOG,5,100,USD');
    await page.fill('#purchasesCsv', '2024-01-01,GOOG,5,80,USD');

    // Wait for autosave debounce (350ms)
    await page.waitForTimeout(500);

    await page.reload();

    await expect(page.locator('#year')).toHaveValue('2024');
    await expect(page.locator('#half')).toHaveValue('H2');
    await goToStep(page, 2);
    await expect(page.locator('#salesCsv')).toHaveValue('2024-12-01,GOOG,5,100,USD');
    await expect(page.locator('#purchasesCsv')).toHaveValue('2024-01-01,GOOG,5,80,USD');
  });

  test('CSV data persists after reload', async ({ page }) => {
    await resetPage(page);

    const csv = '2025-03-01,TSLA,20,250.00,USD';
    await goToStep(page, 2);
    await page.fill('#salesCsv', csv);
    await page.waitForTimeout(500);
    await page.reload();

    await goToStep(page, 2);
    await expect(page.locator('#salesCsv')).toHaveValue(csv);
  });

  test('clear function resets form and localStorage', async ({ page }) => {
    await page.goto('/');
    await goToStep(page, 2);
    await page.fill('#salesCsv', 'test data');
    await page.waitForTimeout(500);

    page.on('dialog', (dialog) => dialog.accept());
    await page.click('text=Obriši sačuvane podatke');

    const saved = await page.evaluate(() => localStorage.getItem('porezator_form_v1'));
    expect(saved).toBeNull();
  });
});
