#!/usr/bin/env node
'use strict';

// Independent cross-feed acquisition for frozen P45 certification.
// Source: Dukascopy via dukascopy-node 1.50.0. No strategy parameters here.
// Rate-limit-safe acquisition: one daily artifact per batch, explicit pauses, retries, cache.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { getHistoricalRates } = require('dukascopy-node');

const OUT = path.resolve('crossfeed_data');
const CACHE = path.resolve('.dukascopy-cache');
fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(CACHE, { recursive: true });

function sha256(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

async function acquire(priceType) {
  // December 2024 is warm-up only. It supplies >200 M15 bars plus a prior-week boundary
  // before the untouched 2025 scoring window. Strategy logic and 2025 score window are unchanged.
  console.log(`Acquiring Dukascopy XAUUSD ${priceType.toUpperCase()} M1: 2024-12-01..2026-01-01 UTC`);
  const csv = await getHistoricalRates({
    instrument: 'xauusd',
    dates: {
      from: new Date('2024-12-01T00:00:00Z'),
      to: new Date('2026-01-01T00:00:00Z'),
    },
    timeframe: 'm1',
    priceType,
    utcOffset: 0,
    volumes: false,
    ignoreFlats: false,
    format: 'csv',
    batchSize: 1,
    pauseBetweenBatchesMs: 1500,
    useCache: true,
    cacheFolderPath: CACHE,
    retryCount: 6,
    retryOnEmpty: false,
    failAfterRetryCount: true,
    pauseBetweenRetriesMs: 5000,
  });
  if (typeof csv !== 'string' || csv.length < 100000) {
    throw new Error(`Unexpected ${priceType} payload: type=${typeof csv}, length=${csv?.length}`);
  }
  const p = path.join(OUT, `dukascopy_${priceType}.csv`);
  fs.writeFileSync(p, csv, 'utf8');
  const b = fs.readFileSync(p);
  console.log(JSON.stringify({ priceType, path: p, bytes: b.length, sha256: sha256(b) }));
}

(async () => {
  await acquire('bid');
  await acquire('ask');
})().catch((err) => {
  console.error(err && err.stack ? err.stack : err);
  process.exit(1);
});
