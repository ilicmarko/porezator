const express = require('express');
const path = require('path');
const app = express();
const PORT = 3000;

app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const DEFAULT_PERSONAL_DATA = {
  tipPoreskogObveznika: '1',
  poreskiIdentifikacioniBroj: '',
  imeIPrezime: '',
  prebivalisteSifra: '',
  adresa: '',
  telefon: '',
  email: '',
  jmbg: '',
};

function mergePersonalData(input = {}) {
  return {
    ...DEFAULT_PERSONAL_DATA,
    ...input,
  };
}

// ─── NBS exchange rate proxy ────────────────────────────────────────────────────
app.get('/api/exchange-rate/:currency/:date', async (req, res) => {
  const { currency, date } = req.params;
  try {
    const url = `https://kurs.resenje.org/api/v1/currencies/${currency}/rates/${date}`;
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`NBS API ${resp.status}`);
    const data = await resp.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Parse CSV text → array of { date, ticker, shares, price, currency } ─────
function parseCsv(text) {
  const lines = text.trim().split('\n');
  const rows = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    // Skip header row if present
    if (i === 0 && line.toLowerCase().includes('ticker')) continue;
    // Support both comma-separated and tab-separated (Google Sheets paste)
    const delimiter = line.includes('\t') ? '\t' : ',';
    const parts = line.split(delimiter).map(s => s.trim());
    if (parts.length < 5) continue;
    rows.push({
      date: parts[0],        // YYYY-MM-DD
      ticker: parts[1].toUpperCase(),
      shares: parseFloat(parts[2].replace(/,/g, '')),
      price: parseFloat(parts[3].replace(/,/g, '')),
      currency: parts[4].toUpperCase(),
    });
  }
  return rows;
}

// ─── Fetch middle exchange rate with caching ─────────────────────────────────
const rateCache = {};

async function getMiddleRate(currency, date) {
  if (currency === 'RSD') return 1;
  const key = `${currency}_${date}`;
  if (rateCache[key] !== undefined) return rateCache[key];

  const url = `https://kurs.resenje.org/api/v1/currencies/${currency}/rates/${date}`;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Ne mogu da dobijem kurs za ${currency} na dan ${date}`);
  const data = await resp.json();
  rateCache[key] = data.exchange_middle;
  return data.exchange_middle;
}

// ─── FIFO matching ──────────────────────────────────────────────────────────────
// Returns array of sale entries, each with matched purchase lots.
function fifoMatch(purchases, sales, force = false) {
  // Group purchases by ticker, sorted by date (oldest first)
  const buysByTicker = {};
  for (const p of purchases) {
    if (!buysByTicker[p.ticker]) buysByTicker[p.ticker] = [];
    buysByTicker[p.ticker].push({ ...p, remaining: p.shares });
  }
  for (const ticker of Object.keys(buysByTicker)) {
    buysByTicker[ticker].sort((a, b) => a.date.localeCompare(b.date));
  }

  // Sort sales by date
  const sortedSales = [...sales].sort((a, b) => a.date.localeCompare(b.date));

  const results = [];
  for (const sale of sortedSales) {
    const lots = buysByTicker[sale.ticker];
    if (!lots) throw new Error(`Nema kupovina za ticker ${sale.ticker}`);

    let sharesToMatch = sale.shares;
    const matchedLots = [];

    for (const lot of lots) {
      if (sharesToMatch <= 0) break;
      if (lot.remaining <= 0) continue;

      const used = Math.min(lot.remaining, sharesToMatch);
      matchedLots.push({
        date: lot.date,
        shares: used,
        price: lot.price,
        currency: lot.currency,
      });
      lot.remaining -= used;
      sharesToMatch -= used;
    }

    if (sharesToMatch > 0.001 && !force) {
      throw new Error(
        `Nedovoljno kupovina za prodaju ${sale.shares} ${sale.ticker} na dan ${sale.date}. ` +
        `Preostalo ${sharesToMatch.toFixed(4)} akcija bez pokrića.`
      );
    }

    results.push({
      sale,
      matchedLots,
    });
  }

  return results;
}

// ─── Aggregate rows by ticker + date ────────────────────────────────────────────
function aggregateByTickerDate(rows) {
  const map = {};
  for (const r of rows) {
    const key = `${r.date}|${r.ticker}|${r.currency}`;
    if (!map[key]) {
      map[key] = { ...r, totalCost: r.shares * r.price };
    } else {
      map[key].totalCost += r.shares * r.price;
      map[key].shares += r.shares;
    }
  }
  return Object.values(map).map(r => ({
    date: r.date,
    ticker: r.ticker,
    shares: r.shares,
    price: r.totalCost / r.shares, // weighted average price
    currency: r.currency,
  }));
}

// ─── Generate XML ───────────────────────────────────────────────────────────────
async function generateXml({ year, half, filingDate, vrstaPrijave, osnovZaPrijavu, purchasesCsv, salesCsv, force, personalData }) {
  const pd = mergePersonalData(personalData);
  const purchases = aggregateByTickerDate(parseCsv(purchasesCsv));
  const sales = aggregateByTickerDate(parseCsv(salesCsv));

  if (sales.length === 0) throw new Error('Nema prodaja u CSV-u.');
  if (purchases.length === 0) throw new Error('Nema kupovina u CSV-u.');

  const matched = fifoMatch(purchases, sales, force);

  // Calculate dates based on year and half
  const parsedYear = parseInt(year, 10);
  const fullYear = parsedYear < 100 ? (2000 + parsedYear) : parsedYear;
  const vrsta = vrstaPrijave || '1';
  const osnov = osnovZaPrijavu || '4';
  let datumOstvarenja, datumDospelosti;
  if (half === 'H2') {
    datumOstvarenja = `${fullYear}-12-31`;
    datumDospelosti = `${fullYear + 1}-01-31`;
  } else {
    datumOstvarenja = `${fullYear}-06-30`;
    datumDospelosti = `${fullYear}-07-31`;
  }

  // Fetch all exchange rates ahead of time
  const rateDates = new Set();
  for (const { sale, matchedLots } of matched) {
    rateDates.add(`${sale.currency}|${sale.date}`);
    for (const lot of matchedLots) {
      rateDates.add(`${lot.currency}|${lot.date}`);
    }
  }
  await Promise.all(
    [...rateDates].map(key => {
      const [currency, date] = key.split('|');
      return getMiddleRate(currency, date);
    })
  );

  // Build XML entries
  let entriesXml = '';
  let redniBroj = 0;
  const financialRows = [];
  const salesDetails = [];
  const buyDetails = [];
  let totalSoldRsd = 0;
  let totalBoughtRsd = 0;

  for (const { sale, matchedLots } of matched) {
    redniBroj++;
    const saleRate = await getMiddleRate(sale.currency, sale.date);
    const saleRsd = sale.shares * sale.price * saleRate;
    const prodajnaCena = saleRsd.toFixed(2);
    const saleDateCompact = sale.date.replace(/-/g, '');
    let saleBoughtRsd = 0;

    salesDetails.push({
      redniBroj,
      ticker: sale.ticker,
      date: sale.date,
      shares: Number(sale.shares.toFixed(4)),
      unitPrice: Number(sale.price.toFixed(6)),
      currency: sale.currency,
      exchangeRate: Number(saleRate.toFixed(6)),
      valueRsd: Number(saleRsd.toFixed(2)),
    });

    let sticanjaXml = '';
    for (const lot of matchedLots) {
      const lotRate = await getMiddleRate(lot.currency, lot.date);
      const lotRsd = lot.shares * lot.price * lotRate;
      const nabavnaCena = lotRsd.toFixed(2);
      const lotDateCompact = lot.date.replace(/-/g, '');
      saleBoughtRsd += lotRsd;

      buyDetails.push({
        redniBroj,
        ticker: sale.ticker,
        date: lot.date,
        shares: Number(lot.shares.toFixed(4)),
        unitPrice: Number(lot.price.toFixed(6)),
        currency: lot.currency,
        exchangeRate: Number(lotRate.toFixed(6)),
        valueRsd: Number(lotRsd.toFixed(2)),
      });

      sticanjaXml += `
            <ns1:Sticanje>
                <ns1:DatumSticanja>${lot.date}</ns1:DatumSticanja>
                <ns1:BrojDokumentaOSticanju>${lotDateCompact}</ns1:BrojDokumentaOSticanju>
                <ns1:BrojStecenihHOVInvesticionihJed>${lot.shares}</ns1:BrojStecenihHOVInvesticionihJed>
                <ns1:NabavnaCena>${nabavnaCena}</ns1:NabavnaCena>
            </ns1:Sticanje>`;
    }

    entriesXml += `
        <ns1:PodaciOPrenosuHOVInvesticionihJed>
            <ns1:RedniBroj>${redniBroj}</ns1:RedniBroj>
            <ns1:NazivEmitenta><![CDATA[${sale.ticker}]]></ns1:NazivEmitenta>
            <ns1:DatumPrenosaHOV>${sale.date}</ns1:DatumPrenosaHOV>
            <ns1:BrojDokumentaOPrenosu>${saleDateCompact}</ns1:BrojDokumentaOPrenosu>
            <ns1:BrojPrenetihHOVInvesticionihJed>${sale.shares}</ns1:BrojPrenetihHOVInvesticionihJed>
            <ns1:ProdajnaCena>${prodajnaCena}</ns1:ProdajnaCena>${sticanjaXml}
        </ns1:PodaciOPrenosuHOVInvesticionihJed>`;

    const saleGainRsd = saleRsd - saleBoughtRsd;
    totalSoldRsd += saleRsd;
    totalBoughtRsd += saleBoughtRsd;
    financialRows.push({
      redniBroj,
      ticker: sale.ticker,
      saleDate: sale.date,
      shares: sale.shares,
      saleRate,
      soldRsd: Number(saleRsd.toFixed(2)),
      boughtRsd: Number(saleBoughtRsd.toFixed(2)),
      capitalGainRsd: Number(saleGainRsd.toFixed(2)),
    });
  }

  const xml = `<ns1:PodaciPoreskeDeklaracije
    xmlns:xsi='http://www.w3.org/2001/XMLSchema-instance'
    xmlns:ns1='http://pid.purs.gov.rs'>
    <ns1:PodaciOPrijavi>
      <ns1:VrstaPrijave>${vrsta}</ns1:VrstaPrijave>
      <ns1:OsnovZaPrijavu>${osnov}</ns1:OsnovZaPrijavu>
        <ns1:DatumOstvarenjaPrihodaDelaPrihoda>${datumOstvarenja}</ns1:DatumOstvarenjaPrihodaDelaPrihoda>
        <ns1:DatumDospelostiZaPodnosenjePoreskePrijave>${datumDospelosti}</ns1:DatumDospelostiZaPodnosenjePoreskePrijave>
        <ns1:DatumINacinPodnosenjaPrijave>
            <ns1:DatumPodnosenjaPrijave>${filingDate}</ns1:DatumPodnosenjaPrijave>
            <ns1:NacinPodnosenjaPrijave>E</ns1:NacinPodnosenjaPrijave>
        </ns1:DatumINacinPodnosenjaPrijave>
    </ns1:PodaciOPrijavi>
    <ns1:PodaciOPoreskomObvezniku>
      <ns1:TipPoreskogObveznika>${pd.tipPoreskogObveznika}</ns1:TipPoreskogObveznika>
      <ns1:PoreskiIdentifikacioniBroj>${pd.poreskiIdentifikacioniBroj}</ns1:PoreskiIdentifikacioniBroj>
      <ns1:ImeIPrezimePoreskogObveznika><![CDATA[${pd.imeIPrezime}]]></ns1:ImeIPrezimePoreskogObveznika>
      <ns1:PrebivalisteBoravistePoreskogObveznika>${pd.prebivalisteSifra}</ns1:PrebivalisteBoravistePoreskogObveznika>
      <ns1:AdresaPoreskogObveznika><![CDATA[${pd.adresa}]]></ns1:AdresaPoreskogObveznika>
      <ns1:TelefonKontaktOsobe>${pd.telefon}</ns1:TelefonKontaktOsobe>
      <ns1:ElektronskaPosta><![CDATA[${pd.email}]]></ns1:ElektronskaPosta>
      <ns1:JMBGPodnosiocaPrijave>${pd.jmbg}</ns1:JMBGPodnosiocaPrijave>
    </ns1:PodaciOPoreskomObvezniku>
    <ns1:DeklarisanoPrenosHOVInvesticionihJed>${entriesXml}
    </ns1:DeklarisanoPrenosHOVInvesticionihJed>
</ns1:PodaciPoreskeDeklaracije>`;

  // Collect documents list
  const documents = [];
  for (const { sale, matchedLots } of matched) {
    const saleDateCompact = sale.date.replace(/-/g, '');
    documents.push({
      type: 'Prodaja',
      ticker: sale.ticker,
      date: sale.date,
      docNumber: saleDateCompact,
      shares: sale.shares,
    });
    for (const lot of matchedLots) {
      const lotDateCompact = lot.date.replace(/-/g, '');
      documents.push({
        type: 'Kupovina',
        ticker: sale.ticker,
        date: lot.date,
        docNumber: lotDateCompact,
        shares: lot.shares,
      });
    }
  }

  const capitalGainRsd = Number((totalSoldRsd - totalBoughtRsd).toFixed(2));
  const estimatedTax15Rsd = Number((Math.max(capitalGainRsd, 0) * 0.15).toFixed(2));
  const summary = {
    totalSoldRsd: Number(totalSoldRsd.toFixed(2)),
    totalBoughtRsd: Number(totalBoughtRsd.toFixed(2)),
    capitalGainRsd,
    estimatedTax15Rsd,
    rows: financialRows,
    salesDetails,
    buyDetails,
  };

  return { xml, documents, summary };
}

// ─── Generate endpoint ──────────────────────────────────────────────────────────
app.post('/api/generate', async (req, res) => {
  try {
    const { year, half, filingDate, vrstaPrijave, osnovZaPrijavu, purchasesCsv, salesCsv, force, personalData } = req.body;

    if (!year || !half || !filingDate || !purchasesCsv || !salesCsv) {
      return res.status(400).json({ error: 'Sva polja su obavezna.' });
    }

    const result = await generateXml({ year, half, filingDate, vrstaPrijave, osnovZaPrijavu, purchasesCsv, salesCsv, force: !!force, personalData });
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ─── PDF Filling Helpers ────────────────────────────────────────────────────────
// Splits string into characters and fills consecutive PDF fields
function fillCharacterFields(form, basePattern, startIndex, text, maxLength = 99) {
  const chars = text.toString().slice(0, maxLength).split('');
  for (let i = 0; i < chars.length; i++) {
    const fieldName = `${basePattern}[${startIndex + i}]`;
    try {
      const field = form.getTextField(fieldName);
      field.setText(chars[i]);
    } catch (err) {
      // Field might not exist, skip silently
    }
  }
}

async function fillPdf({ year, half, filingDate, purchasesCsv, salesCsv, force, fieldMappings, personalData }) {
  const pd = mergePersonalData(personalData);
  // Load the blank PDF
  const pdfBytes = fs.readFileSync('./8940_ID.pdf');
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const form = pdfDoc.getForm();

  // Get the same data as XML generation
  const purchases = aggregateByTickerDate(parseCsv(purchasesCsv));
  const sales = aggregateByTickerDate(parseCsv(salesCsv));
  const matched = fifoMatch(purchases, sales, force);

  // Calculate dates
  const parsedYr = parseInt(year, 10);
  const fullYear = parsedYr < 100 ? (2000 + parsedYr) : parsedYr;
  let datumOstvarenja, datumDospelosti;
  if (half === 'H2') {
    datumOstvarenja = `${fullYear}-12-31`;
    datumDospelosti = `${fullYear + 1}-01-31`;
  } else {
    datumOstvarenja = `${fullYear}-06-30`;
    datumDospelosti = `${fullYear}-07-31`;
  }

  // Apply custom field mappings if provided
  if (fieldMappings) {
    for (const [fieldName, value] of Object.entries(fieldMappings)) {
      try {
        const field = form.getTextField(fieldName);
        field.setText(String(value));
      } catch (err) {
        console.warn(`Field ${fieldName} not found or not a text field`);
      }
    }
  }

  // Auto-fill basic personal info (using Page1 fields - adjust indices as needed)
  // These are example mappings - you'll need to adjust based on actual PDF layout
  try {
    // JMBG (assuming it starts at TextField1[0] on Page1)
    fillCharacterFields(form, 'topmostSubform[0].Page1[0].TextField1', 0, pd.jmbg, 13);

    // Filing date (assuming TextField1[13-22])
    fillCharacterFields(form, 'topmostSubform[0].Page1[0].TextField1', 13, filingDate.replace(/-/g, ''), 10);
  } catch (err) {
    console.error('Error filling basic fields:', err.message);
  }

  // Flatten form to prevent further editing
  // form.flatten();

  const filledPdfBytes = await pdfDoc.save();
  return Buffer.from(filledPdfBytes);
}

// ─── Fill PDF endpoint ──────────────────────────────────────────────────────────
app.post('/api/fill-pdf', async (req, res) => {
  try {
    const { year, half, filingDate, purchasesCsv, salesCsv, force, fieldMappings, personalData } = req.body;

    if (!year || !half || !filingDate || !purchasesCsv || !salesCsv) {
      return res.status(400).json({ error: 'Sva polja su obavezna.' });
    }

    const pdfBuffer = await fillPdf({
      year, half, filingDate, purchasesCsv, salesCsv, force: !!force, fieldMappings, personalData
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="poreska_prijava_filled.pdf"');
    res.send(pdfBuffer);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ─── Get PDF field names (helper endpoint) ──────────────────────────────────────
app.get('/api/pdf-fields', async (req, res) => {
  try {
    const pdfBytes = fs.readFileSync('./8940_ID.pdf');
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const form = pdfDoc.getForm();
    const fields = form.getFields();

    const fieldNames = fields.map((field, i) => ({
      index: i + 1,
      name: field.getName(),
      type: field.constructor.name
    }));

    res.json({ total: fields.length, fields: fieldNames });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Porezator radi na http://localhost:${PORT}`);
});
