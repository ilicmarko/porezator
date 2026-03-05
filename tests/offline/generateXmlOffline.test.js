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
});
