const fs = require('fs');
const crypto = require('crypto');
const path = require('path');
const { getHistoricalRates } = require('dukascopy-node');

(async () => {
  const [, , outPath, fromIso = '2003-05-05', toIso = '2026-08-28'] = process.argv;
  if (!outPath) {
    console.error('usage: node fetch_copytolive_gold_h1.cjs <output.csv> [from] [to-exclusive]');
    process.exit(2);
  }
  const data = await getHistoricalRates({
    instrument: 'xauusd',
    dates: {
      from: new Date(fromIso + (fromIso.includes('T') ? '' : 'T00:00:00.000Z')),
      to: new Date(toIso + (toIso.includes('T') ? '' : 'T00:00:00.000Z'))
    },
    timeframe: 'h1',
    priceType: 'bid',
    format: 'json',
    utcOffset: 0,
    volumes: true,
    ignoreFlats: true,
    batchSize: 8,
    pauseBetweenBatchesMs: 150,
    useCache: true,
    cacheFolderPath: '.dukascopy-cache-copytolive-gold'
  });
  if (!Array.isArray(data) || data.length < 10000) {
    throw new Error('Dukascopy GOLD H1 unexpectedly short: ' + (Array.isArray(data) ? data.length : 'non-array'));
  }
  const lines = ['Date,open,high,low,close,volume'];
  let prev = -Infinity;
  for (const x of data) {
    const ts = Number(x.timestamp);
    const o = Number(x.open), h = Number(x.high), l = Number(x.low), c = Number(x.close);
    const v = Number(x.volume || 0);
    if (![ts,o,h,l,c,v].every(Number.isFinite)) continue;
    if (ts <= prev) throw new Error('non-monotonic timestamp ' + ts);
    if (h < l || o < l || o > h || c < l || c > h) throw new Error('OHLC violation ' + ts);
    prev = ts;
    lines.push([new Date(ts).toISOString(), o, h, l, c, v].join(','));
  }
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  const body = lines.join('\n') + '\n';
  fs.writeFileSync(outPath, body);
  console.log(JSON.stringify({
    status: 'PASS',
    provider: 'Dukascopy',
    instrument: 'xauusd',
    timeframe: 'h1',
    priceType: 'bid',
    from: fromIso,
    to_exclusive: toIso,
    rows: lines.length - 1,
    sha256: crypto.createHash('sha256').update(body).digest('hex'),
    output: outPath
  }, null, 2));
})().catch(err => {
  console.error(err && err.stack ? err.stack : String(err));
  process.exit(1);
});
