const { generateXmlOffline } = require('../../public/offline-core');

const baseBody = {
  year: '2025',
  half: 'H1',
  filingDate: '2025-07-15',
  purchasesCsv: '2025-01-15,AAPL,10,100,USD,117.5',
  salesCsv: '2025-06-20,AAPL,10,150,USD,118.0',
  personalData: { imeIPrezime: 'Petar Petrović', jmbg: '0101990710000' },
};

describe('generateXmlOffline', () => {
  test('valid input produces complete XML', () => {
    const result = generateXmlOffline(baseBody);
    expect(result.xml).toContain('ns1:PodaciPoreskeDeklaracije');
    expect(result.xml).toContain('ns1:PodaciOPrijavi');
    expect(result.xml).toContain('ns1:PodaciOPoreskomObvezniku');
    expect(result.xml).toContain('<![CDATA[AAPL]]>');
    expect(result.xml).toContain('<ns1:DatumPrenosaHOV>2025-06-20</ns1:DatumPrenosaHOV>');
  });

  test('summary totals are correct', () => {
    const result = generateXmlOffline(baseBody);
    // Sale: 10 * 150 * 118 = 177000
    // Purchase: 10 * 100 * 117.5 = 117500
    // Gain: 59500
    expect(result.summary.totalSoldRsd).toBe(177000);
    expect(result.summary.totalBoughtRsd).toBe(117500);
    expect(result.summary.capitalGainRsd).toBe(59500);
    expect(result.summary.estimatedTax15Rsd).toBe(8925);
  });

  test('missing year throws error', () => {
    expect(() =>
      generateXmlOffline({ ...baseBody, year: 'abc' })
    ).toThrow('Neispravna godina');
  });

  test('no sales throws error', () => {
    expect(() =>
      generateXmlOffline({ ...baseBody, salesCsv: '' })
    ).toThrow('Nema prodaja');
  });

  test('no purchases throws error', () => {
    expect(() =>
      generateXmlOffline({ ...baseBody, purchasesCsv: '' })
    ).toThrow('Nema kupovina');
  });

  test('H1 dates are correct', () => {
    const result = generateXmlOffline({ ...baseBody, half: 'H1' });
    expect(result.xml).toContain('2025-06-30');
    expect(result.xml).toContain('2025-07-31');
  });

  test('H2 dates are correct', () => {
    const result = generateXmlOffline({ ...baseBody, half: 'H2' });
    expect(result.xml).toContain('2025-12-31');
    expect(result.xml).toContain('2026-01-31');
  });

  test('documents list contains Prodaja and Kupovina', () => {
    const result = generateXmlOffline(baseBody);
    expect(result.documents.some(d => d.type === 'Prodaja')).toBe(true);
    expect(result.documents.some(d => d.type === 'Kupovina')).toBe(true);
  });

  test('roundShares rounds only XML display values and annotates ticker and acquisition docs', () => {
    const result = generateXmlOffline({
      ...baseBody,
      purchasesCsv: '2025-01-15,GOOGL,13.24,100,USD,100\n2025-01-16,GOOGL,0.13,100,USD,100',
      salesCsv: '2025-06-20,GOOGL,13.37,150,USD,100',
      roundShares: true,
    });

    expect(result.xml).toContain('<![CDATA[GOOGL (preneto ukupno 13,37 akcija, zbog zaokruživanja prikazano 14)]]>');
    expect(result.xml).toContain('<ns1:BrojPrenetihHOVInvesticionihJed>14</ns1:BrojPrenetihHOVInvesticionihJed>');
    expect(result.xml).toContain('<ns1:BrojStecenihHOVInvesticionihJed>13</ns1:BrojStecenihHOVInvesticionihJed>');
    expect(result.xml).toContain('<ns1:BrojStecenihHOVInvesticionihJed>1</ns1:BrojStecenihHOVInvesticionihJed>');
    expect(result.xml).toContain('20250116 (stečeno 0,13 zaokruženo 1)');
    expect(result.xml).toContain('<ns1:ProdajnaCena>200550.00</ns1:ProdajnaCena>');

    expect(result.documents.find(d => d.type === 'Prodaja').shares).toBe(14);
    expect(result.documents.find(d => d.docNumber.includes('stečeno 0,13 zaokruženo 1'))).toBeTruthy();
    expect(result.summary.totalSoldRsd).toBe(200550);
    expect(result.summary.totalBoughtRsd).toBe(133700);
  });
});
