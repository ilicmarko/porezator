const { parseCsvByMode } = require('../../public/offline-core');

describe('parseCsvByMode', () => {
  test('non-offline mode parses 5 columns without exchangeRate', () => {
    const csv = '2025-01-15,AAPL,10,100,USD';
    const result = parseCsvByMode(csv, false);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      date: '2025-01-15',
      ticker: 'AAPL',
      shares: 10,
      price: 100,
      currency: 'USD',
    });
    expect(result[0]).not.toHaveProperty('exchangeRate');
  });

  test('offline mode parses 6 columns with exchangeRate', () => {
    const csv = '2025-01-15,AAPL,10,100,USD,117.5';
    const result = parseCsvByMode(csv, true);
    expect(result).toHaveLength(1);
    expect(result[0].exchangeRate).toBe(117.5);
  });

  test('offline mode with missing 6th column throws error', () => {
    const csv = '2025-01-15,AAPL,10,100,USD';
    expect(() => parseCsvByMode(csv, true)).toThrow('nedostaje srednji_kurs');
  });

  test('offline mode with invalid rate (0) throws error', () => {
    const csv = '2025-01-15,AAPL,10,100,USD,0';
    expect(() => parseCsvByMode(csv, true)).toThrow('neispravan srednji_kurs');
  });

  test('offline mode with negative rate throws error', () => {
    const csv = '2025-01-15,AAPL,10,100,USD,-5';
    expect(() => parseCsvByMode(csv, true)).toThrow('neispravan srednji_kurs');
  });

  test('offline mode with NaN rate throws error', () => {
    const csv = '2025-01-15,AAPL,10,100,USD,abc';
    expect(() => parseCsvByMode(csv, true)).toThrow('neispravan srednji_kurs');
  });

  test('invalid row with missing fields throws error', () => {
    // ticker empty
    const csv = '2025-01-15,,10,100,USD';
    expect(() => parseCsvByMode(csv, false)).toThrow('Neispravan CSV red');
  });

  test('skips header row containing "ticker"', () => {
    const csv = 'date,ticker,shares,price,currency\n2025-01-15,AAPL,10,100,USD';
    const result = parseCsvByMode(csv, false);
    expect(result).toHaveLength(1);
  });

  test('supports tab-delimited input', () => {
    const csv = '2025-01-15\tAAPL\t10\t100\tUSD';
    const result = parseCsvByMode(csv, false);
    expect(result[0].ticker).toBe('AAPL');
  });
});
