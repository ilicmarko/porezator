const request = require('supertest');
const { app } = require('../../server');

// Mock global fetch for exchange rate calls
const originalFetch = global.fetch;

afterEach(() => {
  global.fetch = originalFetch;
});

describe('GET /api/exchange-rate/:currency/:date', () => {
  test('proxies valid rate', async () => {
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({ exchange_middle: 117.5, date: '2025-01-15' }),
    }));

    const res = await request(app).get('/api/exchange-rate/USD/2025-01-15');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('exchange_middle');
  });

  test('external API failure returns 500', async () => {
    global.fetch = jest.fn(async () => ({
      ok: false,
      status: 404,
    }));

    const res = await request(app).get('/api/exchange-rate/XYZ/2025-01-15');
    expect(res.status).toBe(500);
    expect(res.body).toHaveProperty('error');
  });
});

describe('POST /api/exchange-rates', () => {
  test('returns batch of rates keyed by currency and date', async () => {
    global.fetch = jest.fn(async (url) => {
      if (url.includes('/USD/rates/2025-01-15')) {
        return {
          ok: true,
          json: async () => ({ exchange_middle: 117.5 }),
        };
      }

      if (url.includes('/EUR/rates/2025-01-15')) {
        return {
          ok: true,
          json: async () => ({ exchange_middle: 1 }),
        };
      }

      return { ok: false, status: 404 };
    });

    const res = await request(app).post('/api/exchange-rates').send({
      items: [
        { currency: 'USD', date: '2025-01-15' },
        { currency: 'USD', date: '2025-01-15' },
        { currency: 'EUR', date: '2025-01-15' },
      ],
    });

    expect(res.status).toBe(200);
    expect(res.body.rates['USD|2025-01-15']).toBe(117.5);
    expect(res.body.rates['EUR|2025-01-15']).toBe(1);
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  test('missing items returns 400', async () => {
    const res = await request(app).post('/api/exchange-rates').send({ items: [] });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/bar jedan datum i valutu/i);
  });

  test('missing currency or date returns 400', async () => {
    const res = await request(app).post('/api/exchange-rates').send({ items: [{ currency: 'USD' }] });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/currency i date/i);
  });
});
