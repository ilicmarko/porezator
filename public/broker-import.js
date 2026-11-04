(function () {
  'use strict';

  // Parsers for broker exports that are turned into the app's CSV rows:
  // { date: 'YYYY-MM-DD', ticker, shares, price, currency, id }
  // Everything runs in the browser; files are never uploaded.

  function parseCsvLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        inQuotes = !inQuotes;
      } else if (ch === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
    result.push(current.trim());
    return result;
  }

  function splitLines(text) {
    return String(text || '').replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim());
  }

  function headerIndex(line) {
    const header = parseCsvLine(line).map((h) => h.trim().toLowerCase());
    return (...names) => {
      for (const name of names) {
        const i = header.indexOf(name);
        if (i >= 0) return i;
      }
      return -1;
    };
  }

  // Brokers export UTC timestamps; the transfer date in Serbia is the Belgrade date.
  function toBelgradeDate(utcValue) {
    const iso = String(utcValue || '').trim().replace(' ', 'T');
    if (!iso) return '';
    const d = new Date(/[zZ]$|[+-]\d\d:?\d\d$/.test(iso) ? iso : iso + 'Z');
    if (Number.isNaN(d.getTime())) return '';
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Belgrade', year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(d);
  }

  // "USD 1,234.56" -> 1234.56
  function parseAmount(value) {
    const m = String(value || '').replace(/,/g, '').match(/-?\d+(\.\d+)?/);
    return m ? parseFloat(m[0]) : NaN;
  }

  function makeRow(date, ticker, shares, total, currency, id) {
    return { date, ticker, shares, price: +(total / shares).toFixed(8), currency, id };
  }

  // Trading 212 "History" export. Price per share is derived from Total
  // (account currency, includes the currency conversion fee).
  function parseTrading212Csv(text) {
    const lines = splitLines(text);
    const out = { buys: [], sells: [], skipped: 0, warnings: [] };
    if (!lines.length) return out;
    const col = headerIndex(lines[0]);
    const idx = {
      action: col('action'), time: col('time (utc)', 'time'), ticker: col('ticker'), id: col('id'),
      shares: col('no. of shares'), total: col('total'), currency: col('currency (total)'),
    };
    if (idx.action < 0 || idx.time < 0 || idx.shares < 0 || idx.total < 0 || idx.currency < 0) {
      throw new Error('Ovo ne liči na Trading 212 History export (nedostaju kolone Action/Time/No. of shares/Total).');
    }

    for (const line of lines.slice(1)) {
      const p = parseCsvLine(line);
      const action = (p[idx.action] || '').toLowerCase();
      const isBuy = /\bbuy$/.test(action);
      const isSell = /\bsell$/.test(action);
      if (!isBuy && !isSell) continue;

      const date = toBelgradeDate(p[idx.time]);
      const ticker = (p[idx.ticker] || '').toUpperCase();
      const shares = parseFloat(p[idx.shares]);
      const total = parseAmount(p[idx.total]);
      const currency = (p[idx.currency] || '').toUpperCase();
      if (!date || !ticker || !currency || !(shares > 0) || !(total > 0)) { out.skipped++; continue; }

      const id = (idx.id >= 0 && p[idx.id]) || `t212|${action}|${p[idx.time]}|${ticker}|${shares}|${total}`;
      (isBuy ? out.buys : out.sells).push(makeRow(date, ticker, shares, total, currency, id));
    }
    return out;
  }

  // Revolut "Trading account statement" (Invest → Documents → Stocks → Account statement).
  // Amounts look like "USD 142.64"; the FX Rate column is for the account's home
  // currency, so it is ignored and NBS rates are used instead.
  function parseRevolutCsv(text) {
    const lines = splitLines(text);
    const out = { buys: [], sells: [], skipped: 0, warnings: [] };
    if (!lines.length) return out;
    const col = headerIndex(lines[0]);
    const idx = {
      date: col('date'), ticker: col('ticker'), type: col('type'), quantity: col('quantity'),
      total: col('total amount'), currency: col('currency'),
    };
    if (Object.values(idx).some((i) => i < 0)) {
      throw new Error('Ovo ne liči na Revolut trading account statement (nedostaju kolone Date/Ticker/Type/Quantity/Total Amount/Currency).');
    }

    const splits = [];
    for (const line of lines.slice(1)) {
      const p = parseCsvLine(line);
      const type = (p[idx.type] || '').toUpperCase();
      const ticker = (p[idx.ticker] || '').toUpperCase();
      const date = toBelgradeDate(p[idx.date]);
      if (type.startsWith('STOCK SPLIT')) {
        splits.push({ ticker, date });
        continue;
      }
      const isBuy = type.startsWith('BUY');
      const isSell = type.startsWith('SELL');
      if (!isBuy && !isSell) continue;

      const shares = parseFloat(p[idx.quantity]);
      const total = parseAmount(p[idx.total]);
      const currency = (p[idx.currency] || '').toUpperCase();
      if (!date || !ticker || !currency || !(shares > 0) || !(total > 0)) { out.skipped++; continue; }

      const id = `revolut|${p[idx.date]}|${ticker}|${type}|${shares}|${total}`;
      (isBuy ? out.buys : out.sells).push(makeRow(date, ticker, shares, total, currency, id));
    }

    // A split adds shares with no purchase, so FIFO for later sales of that
    // ticker would not add up. Flag it instead of guessing the cost basis.
    for (const s of splits) {
      if (out.sells.some((x) => x.ticker === s.ticker && x.date >= s.date)) {
        out.warnings.push(`${s.ticker}: podela akcija (stock split) ${s.date} — proverite kupovine pre prodaje, Porezator ne preračunava podelu automatski.`);
      }
    }
    return out;
  }

  // Merge several files; overlapping exports are de-duplicated by row id.
  function mergeImports(results) {
    const merged = { buys: [], sells: [], skipped: 0, duplicates: 0, warnings: [] };
    const seen = new Set();
    for (const r of results) {
      merged.skipped += r.skipped;
      merged.warnings.push(...r.warnings);
      for (const [list, target] of [[r.buys, merged.buys], [r.sells, merged.sells]]) {
        for (const row of list) {
          if (seen.has(row.id)) { merged.duplicates++; continue; }
          seen.add(row.id);
          target.push(row);
        }
      }
    }
    return merged;
  }

  const exports = { toBelgradeDate, parseAmount, parseTrading212Csv, parseRevolutCsv, mergeImports };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exports;
  } else {
    window.PorezatorBrokers = exports;
  }
})();
