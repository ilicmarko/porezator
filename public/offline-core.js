(function () {
  'use strict';

  function parseCsvByMode(text, offlineMode) {
    const lines = text.trim().split('\n').filter((l) => l.trim());
    const rows = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      const delimiter = line.includes('\t') ? '\t' : ',';
      const parts = line.split(delimiter).map((s) => s.trim());

      if (i === 0 && /ticker/i.test(parts.join(' '))) continue;
      if (parts.length < 5) continue;

      const row = {
        date: parts[0],
        ticker: (parts[1] || '').toUpperCase(),
        shares: parseFloat((parts[2] || '').replace(/,/g, '')),
        price: parseFloat((parts[3] || '').replace(/,/g, '')),
        currency: (parts[4] || '').toUpperCase(),
      };

      if (offlineMode) {
        if (parts.length < 6) {
          throw new Error(`Offline mode: nedostaje srednji_kurs u redu ${i + 1}.`);
        }
        row.exchangeRate = parseFloat((parts[5] || '').replace(/,/g, ''));
        if (!Number.isFinite(row.exchangeRate) || row.exchangeRate <= 0) {
          throw new Error(`Offline mode: neispravan srednji_kurs u redu ${i + 1}.`);
        }
      }

      if (!row.date || !row.ticker || !Number.isFinite(row.shares) || !Number.isFinite(row.price) || !row.currency) {
        throw new Error(`Neispravan CSV red ${i + 1}.`);
      }
      rows.push(row);
    }
    return rows;
  }

  function aggregateRows(rows, offlineMode) {
    const map = {};
    for (const r of rows) {
      const key = `${r.date}|${r.ticker}|${r.currency}`;
      const cost = r.shares * r.price;
      if (!map[key]) {
        map[key] = { ...r, totalCost: cost, rateWeightedSum: (r.exchangeRate || 0) * cost };
      } else {
        map[key].totalCost += cost;
        map[key].shares += r.shares;
        map[key].rateWeightedSum += (r.exchangeRate || 0) * cost;
      }
    }

    return Object.values(map).map((r) => {
      const out = {
        date: r.date,
        ticker: r.ticker,
        shares: r.shares,
        price: r.totalCost / r.shares,
        currency: r.currency,
      };
      if (offlineMode) {
        out.exchangeRate = r.rateWeightedSum / r.totalCost;
      }
      return out;
    });
  }

  function fifoMatchLocal(purchases, sales, force) {
    const buysByTicker = {};
    for (const p of purchases) {
      if (!buysByTicker[p.ticker]) buysByTicker[p.ticker] = [];
      buysByTicker[p.ticker].push({ ...p, remaining: p.shares });
    }
    for (const ticker of Object.keys(buysByTicker)) {
      buysByTicker[ticker].sort((a, b) => a.date.localeCompare(b.date));
    }

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
          exchangeRate: lot.exchangeRate,
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

      results.push({ sale, matchedLots });
    }
    return results;
  }

  function yearToFull(yearStr) {
    const parsed = parseInt(yearStr, 10);
    if (!Number.isFinite(parsed)) return null;
    return parsed < 100 ? 2000 + parsed : parsed;
  }

  function generateXmlOffline(body) {
    const fullYear = yearToFull(body.year);
    if (!fullYear) throw new Error('Neispravna godina prodaje.');

    const purchases = aggregateRows(parseCsvByMode(body.purchasesCsv, true), true);
    const sales = aggregateRows(parseCsvByMode(body.salesCsv, true), true);
    if (!sales.length) throw new Error('Nema prodaja u CSV-u.');
    if (!purchases.length) throw new Error('Nema kupovina u CSV-u.');

    const matched = fifoMatchLocal(purchases, sales, !!body.force);
    const vrsta = body.vrstaPrijave || '1';
    const osnov = body.osnovZaPrijavu || '4';
    const pd = body.personalData || {};

    const datumOstvarenja = body.half === 'H2' ? `${fullYear}-12-31` : `${fullYear}-06-30`;
    const datumDospelosti = body.half === 'H2' ? `${fullYear + 1}-01-31` : `${fullYear}-07-31`;

    let entriesXml = '';
    let redniBroj = 0;
    const documents = [];
    const rows = [];
    const salesDetails = [];
    const buyDetails = [];
    let totalSoldRsd = 0;
    let totalBoughtRsd = 0;

    for (const { sale, matchedLots } of matched) {
      redniBroj++;
      const saleRate = sale.exchangeRate || 1;
      const saleRsd = sale.shares * sale.price * saleRate;
      const saleDateCompact = sale.date.replace(/-/g, '');
      let saleBoughtRsd = 0;

      let sticanjaXml = '';
      for (const lot of matchedLots) {
        const lotRate = lot.exchangeRate || 1;
        const lotRsd = lot.shares * lot.price * lotRate;
        saleBoughtRsd += lotRsd;
        const lotDateCompact = lot.date.replace(/-/g, '');
        sticanjaXml += `
            <ns1:Sticanje>
                <ns1:DatumSticanja>${lot.date}</ns1:DatumSticanja>
                <ns1:BrojDokumentaOSticanju>${lotDateCompact}</ns1:BrojDokumentaOSticanju>
                <ns1:BrojStecenihHOVInvesticionihJed>${lot.shares}</ns1:BrojStecenihHOVInvesticionihJed>
                <ns1:NabavnaCena>${lotRsd.toFixed(2)}</ns1:NabavnaCena>
            </ns1:Sticanje>`;

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
      }

      entriesXml += `
        <ns1:PodaciOPrenosuHOVInvesticionihJed>
            <ns1:RedniBroj>${redniBroj}</ns1:RedniBroj>
            <ns1:NazivEmitenta><![CDATA[${sale.ticker}]]></ns1:NazivEmitenta>
            <ns1:DatumPrenosaHOV>${sale.date}</ns1:DatumPrenosaHOV>
            <ns1:BrojDokumentaOPrenosu>${saleDateCompact}</ns1:BrojDokumentaOPrenosu>
            <ns1:BrojPrenetihHOVInvesticionihJed>${sale.shares}</ns1:BrojPrenetihHOVInvesticionihJed>
            <ns1:ProdajnaCena>${saleRsd.toFixed(2)}</ns1:ProdajnaCena>${sticanjaXml}
        </ns1:PodaciOPrenosuHOVInvesticionihJed>`;

      const saleGainRsd = saleRsd - saleBoughtRsd;
      totalSoldRsd += saleRsd;
      totalBoughtRsd += saleBoughtRsd;
      rows.push({
        redniBroj,
        ticker: sale.ticker,
        saleDate: sale.date,
        shares: sale.shares,
        saleRate,
        soldRsd: Number(saleRsd.toFixed(2)),
        boughtRsd: Number(saleBoughtRsd.toFixed(2)),
        capitalGainRsd: Number(saleGainRsd.toFixed(2)),
      });

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

      documents.push({ type: 'Prodaja', ticker: sale.ticker, date: sale.date, docNumber: saleDateCompact, shares: sale.shares });
      for (const lot of matchedLots) {
        const lotDateCompact = lot.date.replace(/-/g, '');
        documents.push({ type: 'Kupovina', ticker: sale.ticker, date: lot.date, docNumber: lotDateCompact, shares: lot.shares });
      }
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
            <ns1:DatumPodnosenjaPrijave>${body.filingDate}</ns1:DatumPodnosenjaPrijave>
            <ns1:NacinPodnosenjaPrijave>E</ns1:NacinPodnosenjaPrijave>
        </ns1:DatumINacinPodnosenjaPrijave>
    </ns1:PodaciOPrijavi>
    <ns1:PodaciOPoreskomObvezniku>
      <ns1:TipPoreskogObveznika>${pd.tipPoreskogObveznika || '1'}</ns1:TipPoreskogObveznika>
      <ns1:PoreskiIdentifikacioniBroj>${pd.poreskiIdentifikacioniBroj || ''}</ns1:PoreskiIdentifikacioniBroj>
      <ns1:ImeIPrezimePoreskogObveznika><![CDATA[${pd.imeIPrezime || ''}]]></ns1:ImeIPrezimePoreskogObveznika>
      <ns1:PrebivalisteBoravistePoreskogObveznika>${pd.prebivalisteSifra || ''}</ns1:PrebivalisteBoravistePoreskogObveznika>
      <ns1:AdresaPoreskogObveznika><![CDATA[${pd.adresa || ''}]]></ns1:AdresaPoreskogObveznika>
      <ns1:TelefonKontaktOsobe>${pd.telefon || ''}</ns1:TelefonKontaktOsobe>
      <ns1:ElektronskaPosta><![CDATA[${pd.email || ''}]]></ns1:ElektronskaPosta>
      <ns1:JMBGPodnosiocaPrijave>${pd.jmbg || ''}</ns1:JMBGPodnosiocaPrijave>
    </ns1:PodaciOPoreskomObvezniku>
    <ns1:DeklarisanoPrenosHOVInvesticionihJed>${entriesXml}
    </ns1:DeklarisanoPrenosHOVInvesticionihJed>
</ns1:PodaciPoreskeDeklaracije>`;

    const capitalGainRsd = Number((totalSoldRsd - totalBoughtRsd).toFixed(2));
    const estimatedTax15Rsd = Number((Math.max(capitalGainRsd, 0) * 0.15).toFixed(2));

    return {
      xml,
      documents,
      summary: {
        totalSoldRsd: Number(totalSoldRsd.toFixed(2)),
        totalBoughtRsd: Number(totalBoughtRsd.toFixed(2)),
        capitalGainRsd,
        estimatedTax15Rsd,
        rows,
        salesDetails,
        buyDetails,
      },
    };
  }

  const exports = {
    parseCsvByMode,
    aggregateRows,
    fifoMatchLocal,
    yearToFull,
    generateXmlOffline,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exports;
  } else {
    window.PorezatorOffline = exports;
  }
})();
