const { aggregateRows } = require('../../public/offline-core');

describe('aggregateRows', () => {
  test('no duplicates — passthrough', () => {
    const rows = [
      { date: '2025-01-15', ticker: 'AAPL', shares: 10, price: 100, currency: 'USD' },
    ];
    const result = aggregateRows(rows, false);
    expect(result).toHaveLength(1);
    expect(result[0].shares).toBe(10);
    expect(result[0].price).toBe(100);
  });

  test('merges same ticker+date+currency with weighted avg price', () => {
    const rows = [
      { date: '2025-01-15', ticker: 'AAPL', shares: 10, price: 100, currency: 'USD' },
      { date: '2025-01-15', ticker: 'AAPL', shares: 10, price: 200, currency: 'USD' },
    ];
    const result = aggregateRows(rows, false);
    expect(result).toHaveLength(1);
    expect(result[0].shares).toBe(20);
    expect(result[0].price).toBe(150);
  });

  test('offline mode: weighted average exchangeRate by cost', () => {
    const rows = [
      { date: '2025-01-15', ticker: 'AAPL', shares: 10, price: 100, currency: 'USD', exchangeRate: 110 },
      { date: '2025-01-15', ticker: 'AAPL', shares: 10, price: 200, currency: 'USD', exchangeRate: 120 },
    ];
    const result = aggregateRows(rows, true);
    expect(result).toHaveLength(1);
    // Weighted: (110 * 1000 + 120 * 2000) / 3000 = 350000/3000 ≈ 116.667
    expect(result[0].exchangeRate).toBeCloseTo(116.667, 2);
  });

  test('non-offline: no exchangeRate in output', () => {
    const rows = [
      { date: '2025-01-15', ticker: 'AAPL', shares: 10, price: 100, currency: 'USD' },
    ];
    const result = aggregateRows(rows, false);
    expect(result[0]).not.toHaveProperty('exchangeRate');
  });
});
