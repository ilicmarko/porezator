const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '1mb' }));
if (!process.env.VERCEL) {
  app.use(express.static(path.join(__dirname, 'public')));
}

async function fetchExchangeRate(currency, date) {
  if (currency === 'RSD') return 1;

  const url = `https://kurs.resenje.org/api/v1/currencies/${currency}/rates/${date}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Ne mogu da dobijem kurs za ${currency} na dan ${date}`);
  }

  const data = await response.json();
  if (!Number.isFinite(data.exchange_middle)) {
    throw new Error(`Neispravan odgovor za ${currency} na dan ${date}`);
  }

  return data.exchange_middle;
}

app.get('/api/exchange-rate/:currency/:date', async (req, res) => {
  const { currency, date } = req.params;

  try {
    const normalizedCurrency = String(currency || '').toUpperCase();
    const exchangeMiddle = await fetchExchangeRate(normalizedCurrency, date);
    res.json({ exchange_middle: exchangeMiddle, currency: normalizedCurrency, date });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/exchange-rates', async (req, res) => {
  const items = Array.isArray(req.body?.items) ? req.body.items : null;
  if (!items || items.length === 0) {
    return res.status(400).json({ error: 'Morate poslati bar jedan datum i valutu.' });
  }

  try {
    const uniqueItems = [];
    const seen = new Set();

    for (const item of items) {
      const currency = String(item?.currency || '').toUpperCase();
      const date = String(item?.date || '');
      if (!currency || !date) {
        return res.status(400).json({ error: 'Svaki zapis mora imati currency i date.' });
      }

      const key = `${currency}|${date}`;
      if (seen.has(key)) continue;
      seen.add(key);
      uniqueItems.push({ currency, date, key });
    }

    const rates = {};
    await Promise.all(uniqueItems.map(async ({ currency, date, key }) => {
      rates[key] = await fetchExchangeRate(currency, date);
    }));

    res.json({ rates });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Porezator radi na http://localhost:${PORT}`);
  });
}

module.exports = {
  app,
  fetchExchangeRate,
};
