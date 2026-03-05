const { aggregateByTickerDate } = require('../../server');

describe('aggregateByTickerDate', () => {
  test('no duplicates — passthrough', () => {
    const rows = [
      { date: '2025-01-15', ticker: 'AAPL', shares: 10, price: 100, currency: 'USD' },
      { date: '2025-02-20', ticker: 'MSFT', shares: 5, price: 200, currency: 'USD' },
    ];
    const result = aggregateByTickerDate(rows);
    expect(result).toHaveLength(2);
  });

  test('same ticker+date+currency are merged with weighted avg price', () => {
    const rows = [
      { date: '2025-01-15', ticker: 'AAPL', shares: 10, price: 100, currency: 'USD' },
      { date: '2025-01-15', ticker: 'AAPL', shares: 10, price: 200, currency: 'USD' },
    ];
    const result = aggregateByTickerDate(rows);
    expect(result).toHaveLength(1);
    expect(result[0].shares).toBe(20);
    // Weighted: (10*100 + 10*200) / 20 = 150
    expect(result[0].price).toBe(150);
  });

  test('same ticker, different dates remain separate', () => {
    const rows = [
      { date: '2025-01-15', ticker: 'AAPL', shares: 10, price: 100, currency: 'USD' },
      { date: '2025-02-20', ticker: 'AAPL', shares: 10, price: 100, currency: 'USD' },
    ];
    const result = aggregateByTickerDate(rows);
    expect(result).toHaveLength(2);
  });

  test('same ticker+date, different currency remain separate', () => {
    const rows = [
      { date: '2025-01-15', ticker: 'AAPL', shares: 10, price: 100, currency: 'USD' },
      { date: '2025-01-15', ticker: 'AAPL', shares: 10, price: 100, currency: 'EUR' },
    ];
    const result = aggregateByTickerDate(rows);
    expect(result).toHaveLength(2);
  });

  test('preserves all fields after aggregation', () => {
    const rows = [
      { date: '2025-01-15', ticker: 'AAPL', shares: 10, price: 100, currency: 'USD' },
    ];
    const result = aggregateByTickerDate(rows);
    expect(result[0]).toEqual({
      date: '2025-01-15',
      ticker: 'AAPL',
      shares: 10,
      price: 100,
      currency: 'USD',
    });
  });
});
