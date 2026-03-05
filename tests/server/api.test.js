const request = require('supertest');
const { app } = require('../../server');

// Mock global fetch for exchange rate calls
const originalFetch = global.fetch;

afterEach(() => {
  global.fetch = originalFetch;
});

describe('POST /api/generate', () => {
  const validBody = {
    year: '2025',
    half: 'H1',
    filingDate: '2025-07-15',
    purchasesCsv: '2025-01-15,AAPL,10,100,USD',
    salesCsv: '2025-06-20,AAPL,10,150,USD',
  };

  test('valid request returns 200 with xml, documents, summary', async () => {
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({ exchange_middle: 117.5 }),
    }));

    const res = await request(app).post('/api/generate').send(validBody);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('xml');
    expect(res.body).toHaveProperty('documents');
    expect(res.body).toHaveProperty('summary');
  });

  test('missing required fields returns 400', async () => {
    const res = await request(app).post('/api/generate').send({ year: '2025' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/obavezna/i);
  });

  test('FIFO mismatch without force returns 500', async () => {
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({ exchange_middle: 100 }),
    }));

    const res = await request(app).post('/api/generate').send({
      ...validBody,
      purchasesCsv: '2025-01-15,AAPL,5,100,USD',
      salesCsv: '2025-06-20,AAPL,10,150,USD',
    });
    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/Nedovoljno/);
  });

  test('FIFO mismatch with force returns 200', async () => {
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({ exchange_middle: 100 }),
    }));

    const res = await request(app).post('/api/generate').send({
      ...validBody,
      purchasesCsv: '2025-01-15,AAPL,5,100,USD',
      salesCsv: '2025-06-20,AAPL,10,150,USD',
      force: true,
    });
    expect(res.status).toBe(200);
  });
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
