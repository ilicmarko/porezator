const { parseCsv } = require('../../server');

describe('parseCsv', () => {
  test('parses basic 5-column CSV', () => {
    const csv = '2025-01-15,AAPL,10,150.50,USD';
    const result = parseCsv(csv);
    expect(result).toEqual([
      { date: '2025-01-15', ticker: 'AAPL', shares: 10, price: 150.5, currency: 'USD' },
    ]);
  });

  test('parses tab-separated values (Google Sheets paste)', () => {
    const csv = '2025-01-15\tAAPL\t10\t150.50\tUSD';
    const result = parseCsv(csv);
    expect(result).toEqual([
      { date: '2025-01-15', ticker: 'AAPL', shares: 10, price: 150.5, currency: 'USD' },
    ]);
  });

  test('skips header row containing "ticker"', () => {
    const csv = 'date,ticker,shares,price,currency\n2025-01-15,AAPL,10,150.50,USD';
    const result = parseCsv(csv);
    expect(result).toHaveLength(1);
    expect(result[0].ticker).toBe('AAPL');
  });

  test('skips blank lines', () => {
    const csv = '2025-01-15,AAPL,10,150.50,USD\n\n\n2025-02-20,MSFT,5,300,USD';
    const result = parseCsv(csv);
    expect(result).toHaveLength(2);
  });

  test('skips rows with fewer than 5 columns', () => {
    const csv = '2025-01-15,AAPL,10\n2025-01-15,AAPL,10,150.50,USD';
    const result = parseCsv(csv);
    expect(result).toHaveLength(1);
  });

  test('handles commas in number strings (using replace)', () => {
    // parseCsv uses simple split(',') so it cannot handle quoted fields.
    // Commas are stripped from each part after splitting, which works when
    // the user pastes pre-split columns (e.g. tab-separated or no quoting).
    const csv = '2025-01-15\tAAPL\t1,000\t1,250.50\tUSD';
    const result = parseCsv(csv);
    expect(result[0].shares).toBe(1000);
    expect(result[0].price).toBe(1250.5);
  });

  test('normalizes ticker to uppercase', () => {
    const csv = '2025-01-15,aapl,10,150.50,usd';
    const result = parseCsv(csv);
    expect(result[0].ticker).toBe('AAPL');
    expect(result[0].currency).toBe('USD');
  });

  test('parses multiple rows', () => {
    const csv = [
      '2025-01-15,AAPL,10,150.50,USD',
      '2025-02-20,MSFT,5,300,USD',
      '2025-03-10,GOOG,3,2800,USD',
    ].join('\n');
    const result = parseCsv(csv);
    expect(result).toHaveLength(3);
    expect(result.map(r => r.ticker)).toEqual(['AAPL', 'MSFT', 'GOOG']);
  });
});
