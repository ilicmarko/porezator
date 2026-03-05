const { fifoMatchLocal } = require('../../public/offline-core');

function buy(ticker, date, shares, price, currency = 'USD', exchangeRate = 117.5) {
  return { ticker, date, shares, price, currency, exchangeRate };
}

function sell(ticker, date, shares, price, currency = 'USD', exchangeRate = 118.0) {
  return { ticker, date, shares, price, currency, exchangeRate };
}

describe('fifoMatchLocal', () => {
  test('simple 1:1 match', () => {
    const purchases = [buy('AAPL', '2025-01-01', 10, 100)];
    const sales = [sell('AAPL', '2025-06-01', 10, 150)];
    const result = fifoMatchLocal(purchases, sales, false);

    expect(result).toHaveLength(1);
    expect(result[0].matchedLots[0].shares).toBe(10);
  });

  test('FIFO order — oldest lot first', () => {
    const purchases = [
      buy('AAPL', '2025-01-01', 5, 100),
      buy('AAPL', '2025-02-01', 5, 120),
    ];
    const sales = [sell('AAPL', '2025-06-01', 8, 150)];
    const result = fifoMatchLocal(purchases, sales, false);

    expect(result[0].matchedLots).toHaveLength(2);
    expect(result[0].matchedLots[0].date).toBe('2025-01-01');
    expect(result[0].matchedLots[0].shares).toBe(5);
    expect(result[0].matchedLots[1].date).toBe('2025-02-01');
    expect(result[0].matchedLots[1].shares).toBe(3);
  });

  test('insufficient buys throws error', () => {
    const purchases = [buy('AAPL', '2025-01-01', 5, 100)];
    const sales = [sell('AAPL', '2025-06-01', 10, 150)];

    expect(() => fifoMatchLocal(purchases, sales, false)).toThrow('Nedovoljno kupovina');
  });

  test('force=true bypasses insufficient buys', () => {
    const purchases = [buy('AAPL', '2025-01-01', 5, 100)];
    const sales = [sell('AAPL', '2025-06-01', 10, 150)];

    expect(() => fifoMatchLocal(purchases, sales, true)).not.toThrow();
  });

  test('no buys for ticker throws error', () => {
    const purchases = [buy('MSFT', '2025-01-01', 10, 200)];
    const sales = [sell('AAPL', '2025-06-01', 5, 150)];

    expect(() => fifoMatchLocal(purchases, sales, false)).toThrow('Nema kupovina za ticker AAPL');
  });

  test('matched lots include exchangeRate', () => {
    const purchases = [buy('AAPL', '2025-01-01', 10, 100, 'USD', 115.0)];
    const sales = [sell('AAPL', '2025-06-01', 10, 150)];
    const result = fifoMatchLocal(purchases, sales, false);

    expect(result[0].matchedLots[0].exchangeRate).toBe(115.0);
  });
});
