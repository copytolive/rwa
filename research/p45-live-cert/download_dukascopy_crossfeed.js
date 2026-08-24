#!/usr/bin/env node
'use strict';

// Independent cross-feed acquisition for frozen P45 certification.
// Source: Dukascopy via dukascopy-node 1.50.0. No strategy parameters here.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { getHistoricalRates } = require('dukascopy-node');

const OUT = path.resolve('crossfeed_data');
fs.mkdirSync(OUT, { recursive: true });

function sha256(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

async function acquire(priceType) {
  console.log(`Acquiring Dukascopy XAUUSD ${priceType.toUpperCase()} M1: 2024-01-01..2026-01-01 UTC`);
  const csv = await getHistoricalRates({
    instrument: 'xauusd',
    dates: {
      from: new Date('2024-01-01T00:00:00Z'),
      to: new Date('2026-01-01T00:00:00Z'),
    },
    timeframe: 'm1',
    priceType,
    utcOffset: 0,
    volumes: false,
    ignoreFlats: false,
    format: 'csv',
    batchSize: 10,
    pauseBetweenBatchesMs: 750,
    retryCount: 3,
    retryOnEmpty: false,
    failAfterRetryCount: true,
    pauseBetweenRetriesMs: 1500,
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
