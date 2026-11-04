// All rows below are made up; no real account data.
const {
  toBelgradeDate, parseAmount, parseTrading212Csv, parseRevolutCsv, mergeImports,
} = require('../../public/broker-import');

const T212_HEADER = 'Action,Time (UTC),ISIN,Ticker,Name,Notes,ID,No. of shares,Price / share,Currency (Price / share),Exchange rate,Result,Currency (Result),Total,Currency (Total),Withholding tax,Currency (Withholding tax),Currency conversion fee,Currency (Currency conversion fee)';

const t212 = [
  T212_HEADER,
  'Deposit,2026-01-05 09:00:00+00:00,,,,,DEP1,,,,,,,100.00,"USD",,,,',
  'Market buy,2026-02-10 14:00:00+00:00,US0000000001,AAA,"Alpha Inc",,EOF1,0.5000000000,100.0000000000,EUR,0.85000000,,,59.00,"USD",,,0.10,"USD"',
  'Limit buy,2026-03-01 10:00:00+00:00,US0000000002,BBB,"Beta Corp",,EOF2,2.0000000000,10.0000000000,USD,1.00000000,,,20.00,"USD",,,,',
  'Market sell,2026-07-15 22:30:00+00:00,US0000000001,AAA,"Alpha Inc",,EOF3,0.2500000000,120.0000000000,EUR,0.86000000,3.50,"USD",34.80,"USD",,,0.05,"USD"',
  'Dividend (Dividend),2026-04-01 12:00:00+00:00,US0000000002,BBB,"Beta Corp",,,2.0000000000,0.10,USD,1.00000000,,,0.20,"USD",0.03,USD,,',
].join('\n');

const revolut = [
  'Date,Ticker,Type,Quantity,Price per share,Total Amount,Currency,FX Rate',
  '2025-01-08T14:30:00.889Z,AAA,BUY - MARKET,0.5,USD 100.00,USD 50,USD,0.0025',
  '2025-02-01T10:00:00Z,,CASH TOP-UP,,,USD 100,USD,0.0025',
  '2025-03-01T10:00:00Z,CCC,BUY - MARKET,1,"EUR 1,200.00","EUR 1,200.00",EUR,0.0026',
  '2025-06-01T10:00:00Z,AAA,DIVIDEND,,,USD 0.10,USD,0.0026',
  '2025-10-24T13:31:04.012Z,AAA,SELL - MARKET,0.25,USD 120.00,USD 30,USD,0.0030',
  '2026-08-11T13:18:57.835439Z,AAA,STOCK SPLIT,0.25,,USD 0,USD,0.0032',
  '2026-09-01T10:00:00Z,AAA,SELL - MARKET,0.5,USD 70.00,USD 35,USD,0.0032',
].join('\n');

describe('toBelgradeDate', () => {
  test('late UTC evening is the next day in Belgrade', () => {
    expect(toBelgradeDate('2026-07-15 22:30:00+00:00')).toBe('2026-07-16');
    expect(toBelgradeDate('2026-01-15T23:30:00Z')).toBe('2026-01-16');
    expect(toBelgradeDate('2026-01-15T22:30:00Z')).toBe('2026-01-15');
  });
  test('empty or invalid input gives empty string', () => {
    expect(toBelgradeDate('')).toBe('');
    expect(toBelgradeDate('not a date')).toBe('');
  });
});

describe('parseAmount', () => {
  test('strips currency and thousands separators', () => {
    expect(parseAmount('USD 142.64')).toBe(142.64);
    expect(parseAmount('EUR 1,200.00')).toBe(1200);
    expect(parseAmount('')).toBeNaN();
  });
});

describe('parseTrading212Csv', () => {
  const r = parseTrading212Csv(t212);
  test('keeps only buys and sells (any order type)', () => {
    expect(r.buys.map((b) => b.ticker)).toEqual(['AAA', 'BBB']);
    expect(r.sells.map((s) => s.ticker)).toEqual(['AAA']);
  });
  test('price comes from Total in the account currency', () => {
    expect(r.buys[0]).toMatchObject({ date: '2026-02-10', shares: 0.5, price: 118, currency: 'USD', id: 'EOF1' });
    expect(r.sells[0]).toMatchObject({ date: '2026-07-16', shares: 0.25, price: 139.2, currency: 'USD' });
  });
  test('rejects a file that is not a Trading 212 export', () => {
    expect(() => parseTrading212Csv('a,b,c\n1,2,3')).toThrow('Trading 212');
  });
});

describe('parseRevolutCsv', () => {
  const r = parseRevolutCsv(revolut);
  test('reads buys and sells, ignores cash and dividends', () => {
    expect(r.buys).toHaveLength(2);
    expect(r.sells).toHaveLength(2);
  });
  test('price comes from Total Amount, per-row currency', () => {
    expect(r.buys[0]).toMatchObject({ date: '2025-01-08', ticker: 'AAA', shares: 0.5, price: 100, currency: 'USD' });
    expect(r.buys[1]).toMatchObject({ ticker: 'CCC', price: 1200, currency: 'EUR' });
  });
  test('warns when a ticker is sold after a stock split', () => {
    expect(r.warnings).toHaveLength(1);
    expect(r.warnings[0]).toContain('AAA');
  });
  test('rejects a file that is not a Revolut statement', () => {
    expect(() => parseRevolutCsv('a,b,c\n1,2,3')).toThrow('Revolut');
  });
});

describe('mergeImports', () => {
  test('overlapping exports are counted once', () => {
    const a = parseTrading212Csv(t212);
    const m = mergeImports([a, parseTrading212Csv(t212)]);
    expect(m.buys).toHaveLength(2);
    expect(m.sells).toHaveLength(1);
    expect(m.duplicates).toBe(3);
  });
});

