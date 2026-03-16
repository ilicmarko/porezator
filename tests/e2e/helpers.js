async function resetPage(page) {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
}

async function goToStep(page, step) {
  await page.locator(`.stepper-item[data-step="${step}"]`).click();
}

async function fillTradeFlow(page, {
  buyCsv,
  sellCsv,
  year = '2025',
  half = 'H1',
  filingDate = '2025-07-15',
} = {}) {
  await page.fill('#year', year);
  await page.selectOption('#half', half);
  await page.fill('#filingDate', filingDate);
  await goToStep(page, 2);

  if (typeof buyCsv === 'string') {
    await page.fill('#purchasesCsv', buyCsv);
  }
  if (typeof sellCsv === 'string') {
    await page.fill('#salesCsv', sellCsv);
  }
}

async function openPreviewStep(page) {
  await goToStep(page, 3);
}

async function prefillServerRates(page) {
  await openPreviewStep(page);
  await page.click('#prefillRatesBtn');
}

async function generateFromPreview(page) {
  await openPreviewStep(page);
  await page.click('#generateBtn');
}

module.exports = {
  resetPage,
  goToStep,
  fillTradeFlow,
  openPreviewStep,
  prefillServerRates,
  generateFromPreview,
};
