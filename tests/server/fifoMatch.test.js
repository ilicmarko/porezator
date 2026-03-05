const { fifoMatch } = require('../../server');

function buy(ticker, date, shares, price, currency = 'USD') {
  return { ticker, date, shares, price, currency };
}

function sell(ticker, date, shares, price, currency = 'USD') {
  return { ticker, date, shares, price, currency };
}

describe('fifoMatch', () => {
  test('simple 1:1 buy and sell', () => {
    const purchases = [buy('AAPL', '2025-01-01', 10, 100)];
    const sales = [sell('AAPL', '2025-06-01', 10, 150)];
    const result = fifoMatch(purchases, sales);

    expect(result).toHaveLength(1);
    expect(result[0].sale).toMatchObject({ ticker: 'AAPL', shares: 10 });
    expect(result[0].matchedLots).toHaveLength(1);
    expect(result[0].matchedLots[0]).toMatchObject({ shares: 10, price: 100 });
  });

  test('multiple buys, one sale — FIFO order (oldest first)', () => {
    const purchases = [
      buy('AAPL', '2025-01-01', 5, 100),
      buy('AAPL', '2025-02-01', 5, 120),
      buy('AAPL', '2025-03-01', 5, 140),
    ];
    const sales = [sell('AAPL', '2025-06-01', 8, 150)];
    const result = fifoMatch(purchases, sales);

    expect(result[0].matchedLots).toHaveLength(2);
    expect(result[0].matchedLots[0]).toMatchObject({ date: '2025-01-01', shares: 5, price: 100 });
    expect(result[0].matchedLots[1]).toMatchObject({ date: '2025-02-01', shares: 3, price: 120 });
  });

  test('one buy, multiple sales — lot splits across sales', () => {
    const purchases = [buy('AAPL', '2025-01-01', 10, 100)];
    const sales = [
      sell('AAPL', '2025-06-01', 3, 150),
      sell('AAPL', '2025-07-01', 7, 160),
    ];
    const result = fifoMatch(purchases, sales);

    expect(result).toHaveLength(2);
    expect(result[0].matchedLots[0].shares).toBe(3);
    expect(result[1].matchedLots[0].shares).toBe(7);
  });

  test('insufficient buys throws error', () => {
    const purchases = [buy('AAPL', '2025-01-01', 5, 100)];
    const sales = [sell('AAPL', '2025-06-01', 10, 150)];

    expect(() => fifoMatch(purchases, sales)).toThrow('Nedovoljno kupovina');
  });

  test('insufficient buys with force=true does not throw', () => {
    const purchases = [buy('AAPL', '2025-01-01', 5, 100)];
    const sales = [sell('AAPL', '2025-06-01', 10, 150)];

    expect(() => fifoMatch(purchases, sales, true)).not.toThrow();
    const result = fifoMatch(purchases, sales, true);
    expect(result[0].matchedLots[0].shares).toBe(5);
  });

  test('no buys for ticker throws error', () => {
    const purchases = [buy('MSFT', '2025-01-01', 10, 200)];
    const sales = [sell('AAPL', '2025-06-01', 5, 150)];

    expect(() => fifoMatch(purchases, sales)).toThrow('Nema kupovina za ticker AAPL');
  });

  test('multiple tickers matched independently', () => {
    const purchases = [
      buy('AAPL', '2025-01-01', 10, 100),
      buy('MSFT', '2025-01-01', 5, 200),
    ];
    const sales = [
      sell('AAPL', '2025-06-01', 10, 150),
      sell('MSFT', '2025-06-01', 5, 300),
    ];
    const result = fifoMatch(purchases, sales);

    expect(result).toHaveLength(2);
    expect(result[0].sale.ticker).toBe('AAPL');
    expect(result[1].sale.ticker).toBe('MSFT');
  });

  test('exact share count leaves 0 remaining', () => {
    const purchases = [buy('AAPL', '2025-01-01', 10, 100)];
    const sales = [sell('AAPL', '2025-06-01', 10, 150)];
    const result = fifoMatch(purchases, sales);

    expect(result[0].matchedLots[0].shares).toBe(10);
  });

  test('floating point edge case within 0.001 tolerance passes', () => {
    // Sell slightly less than bought due to floating point
    const purchases = [buy('AAPL', '2025-01-01', 10, 100)];
    const sales = [sell('AAPL', '2025-06-01', 10.0005, 150)];

    // This should throw because 0.0005 < 0.001, so it barely passes
    // Actually: 10 shares bought, 10.0005 sold → remaining 0.0005 → within tolerance
    expect(() => fifoMatch(purchases, sales)).not.toThrow();
  });

  test('sales sorted by date regardless of input order', () => {
    const purchases = [buy('AAPL', '2025-01-01', 20, 100)];
    const sales = [
      sell('AAPL', '2025-07-01', 5, 160),
      sell('AAPL', '2025-06-01', 5, 150),
    ];
    const result = fifoMatch(purchases, sales);

    // Should be sorted: June first, then July
    expect(result[0].sale.date).toBe('2025-06-01');
    expect(result[1].sale.date).toBe('2025-07-01');
  });
});
