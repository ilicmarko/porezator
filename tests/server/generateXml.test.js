const { generateXml } = require('../../server');

// Mock global fetch for exchange rate API
const originalFetch = global.fetch;

function mockFetch(rateMap = {}) {
  global.fetch = jest.fn(async (url) => {
    // Extract currency and date from URL
    const match = url.match(/currencies\/(\w+)\/rates\/(\d{4}-\d{2}-\d{2})/);
    if (!match) return { ok: false, status: 404 };
    const key = `${match[1]}_${match[2]}`;
    const rate = rateMap[key];
    if (rate === undefined) return { ok: false, status: 404 };
    return {
      ok: true,
      json: async () => ({ exchange_middle: rate }),
    };
  });
}

afterEach(() => {
  global.fetch = originalFetch;
});

const baseBuyCsv = '2025-01-15,AAPL,10,100,USD';
const baseSellCsv = '2025-06-20,AAPL,10,150,USD';
const baseParams = {
  year: '2025',
  half: 'H1',
  filingDate: '2025-07-15',
  purchasesCsv: baseBuyCsv,
  salesCsv: baseSellCsv,
  personalData: { imeIPrezime: 'Petar Petrović', jmbg: '0101990710000' },
};

describe('generateXml', () => {
  test('H1 period produces correct dates', async () => {
    mockFetch({ USD_2025_01_15: 117.5, 'USD_2025-01-15': 117.5, 'USD_2025-06-20': 118.0 });
    // Need to fix the key format
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({ exchange_middle: 117.5 }),
    }));

    const result = await generateXml({ ...baseParams, half: 'H1' });
    expect(result.xml).toContain('<ns1:DatumOstvarenjaPrihodaDelaPrihoda>2025-06-30</ns1:DatumOstvarenjaPrihodaDelaPrihoda>');
    expect(result.xml).toContain('<ns1:DatumDospelostiZaPodnosenjePoreskePrijave>2025-07-31</ns1:DatumDospelostiZaPodnosenjePoreskePrijave>');
  });

  test('H2 period produces correct dates', async () => {
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({ exchange_middle: 117.5 }),
    }));

    const result = await generateXml({ ...baseParams, half: 'H2' });
    expect(result.xml).toContain('<ns1:DatumOstvarenjaPrihodaDelaPrihoda>2025-12-31</ns1:DatumOstvarenjaPrihodaDelaPrihoda>');
    expect(result.xml).toContain('<ns1:DatumDospelostiZaPodnosenjePoreskePrijave>2026-01-31</ns1:DatumDospelostiZaPodnosenjePoreskePrijave>');
  });

  test('short year "25" converts to 2025', async () => {
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({ exchange_middle: 117.5 }),
    }));

    const result = await generateXml({ ...baseParams, year: '25' });
    expect(result.xml).toContain('2025-06-30');
  });

  test('full year "2025" works directly', async () => {
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({ exchange_middle: 117.5 }),
    }));

    const result = await generateXml({ ...baseParams, year: '2025' });
    expect(result.xml).toContain('2025-06-30');
  });

  test('valid XML contains required ns1 tags', async () => {
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({ exchange_middle: 117.5 }),
    }));

    const result = await generateXml(baseParams);
    expect(result.xml).toContain('ns1:PodaciPoreskeDeklaracije');
    expect(result.xml).toContain('ns1:PodaciOPrijavi');
    expect(result.xml).toContain('ns1:PodaciOPoreskomObvezniku');
    expect(result.xml).toContain('ns1:DeklarisanoPrenosHOVInvesticionihJed');
    expect(result.xml).toContain('ns1:PodaciOPrenosuHOVInvesticionihJed');
    expect(result.xml).toContain('<![CDATA[AAPL]]>');
  });

  test('summary math: capitalGain = totalSold - totalBought', async () => {
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({ exchange_middle: 100 }), // rate = 100 for simple math
    }));

    const result = await generateXml(baseParams);
    const { totalSoldRsd, totalBoughtRsd, capitalGainRsd } = result.summary;
    expect(capitalGainRsd).toBe(Number((totalSoldRsd - totalBoughtRsd).toFixed(2)));
  });

  test('tax is 15% of positive capital gain', async () => {
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({ exchange_middle: 100 }),
    }));

    const result = await generateXml(baseParams);
    const { capitalGainRsd, estimatedTax15Rsd } = result.summary;
    expect(capitalGainRsd).toBeGreaterThan(0);
    expect(estimatedTax15Rsd).toBe(Number((capitalGainRsd * 0.15).toFixed(2)));
  });

  test('negative gain results in 0 tax', async () => {
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({ exchange_middle: 100 }),
    }));

    // Sell cheaper than bought
    const result = await generateXml({
      ...baseParams,
      purchasesCsv: '2025-01-15,AAPL,10,200,USD',
      salesCsv: '2025-06-20,AAPL,10,100,USD',
    });
    expect(result.summary.capitalGainRsd).toBeLessThan(0);
    expect(result.summary.estimatedTax15Rsd).toBe(0);
  });

  test('personal data included in XML', async () => {
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({ exchange_middle: 100 }),
    }));

    const result = await generateXml(baseParams);
    expect(result.xml).toContain('Petar Petrović');
    expect(result.xml).toContain('0101990710000');
  });

  test('documents list contains Prodaja and Kupovina entries', async () => {
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({ exchange_middle: 100 }),
    }));

    const result = await generateXml(baseParams);
    expect(result.documents.some(d => d.type === 'Prodaja')).toBe(true);
    expect(result.documents.some(d => d.type === 'Kupovina')).toBe(true);
    expect(result.documents[0].docNumber).toBe('20250620');
  });

  test('empty sales CSV throws error', async () => {
    await expect(
      generateXml({ ...baseParams, salesCsv: '' })
    ).rejects.toThrow('Nema prodaja');
  });

  test('empty purchases CSV throws error', async () => {
    await expect(
      generateXml({ ...baseParams, purchasesCsv: '' })
    ).rejects.toThrow('Nema kupovina');
  });
});
