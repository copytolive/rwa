const fs = require('fs');
const crypto = require('crypto');
const path = require('path');
const { getHistoricalRates } = require('dukascopy-node');

/*
 * Rebuild CopyToLive GOLD H1 exactly the way production constructs it:
 *
 *   Dukascopy XAUUSD M1
 *       -> timestamp sort
 *       -> reject non-positive / invalid OHLC
 *       -> pandas-equivalent UTC 1h resample
 *          open=first, high=max, low=min, close=last, volume=sum
 *       -> drop empty hours
 *
 * Production reference:
 *   /home/opentrue-platform/backend/trading-service/pipeline/convert_dukascopy.py
 *
 * IMPORTANT: Native Dukascopy H1 is NOT accepted as production parity data.
 * The production H1 parquet was built from M1, so GitHub must do the same.
 */

function utcDate(s) {
  return new Date(s + (s.includes('T') ? '' : 'T00:00:00.000Z'));
}

function addUtcMonths(date, months) {
  const d = new Date(date.getTime());
  d.setUTCMonth(d.getUTCMonth() + months);
  return d;
}

function timestampMs(x) {
  const raw = x.timestamp ?? x.time ?? x.date;
  if (typeof raw === 'number') {
    return raw < 1e12 ? raw * 1000 : raw;
  }
  const numeric = Number(raw);
  if (Number.isFinite(numeric)) {
    return numeric < 1e12 ? numeric * 1000 : numeric;
  }
  const parsed = Date.parse(String(raw));
  return Number.isFinite(parsed) ? parsed : NaN;
}

(async () => {
  const [, , outPath, d1OutPath, fromIso = '2003-05-05', toIso = '2026-04-29'] = process.argv;
  if (!outPath || !d1OutPath) {
    console.error('usage: node fetch_copytolive_gold_h1.cjs <h1-output.csv> <d1-output.csv> [from] [to-exclusive]');
    process.exit(2);
  }

  const start = utcDate(fromIso);
  const end = utcDate(toIso);
  if (!(start < end)) throw new Error('invalid date window');

  // The original production CSV snapshot contains market-session M1 bars,
  // not Dukascopy's synthetic flat/weekend filler. The converter itself does
  // not delete flat bars because they were already absent from that snapshot.
  // Use ignoreFlats=true when rebuilding the historical source through the API.
  const ignoreFlats = String(process.env.COPYTOLIVE_IGNORE_FLATS || 'true').toLowerCase() === 'true';
  const chunkMonths = Math.max(1, Number(process.env.COPYTOLIVE_M1_CHUNK_MONTHS || 12));

  const hours = new Map();
  const days = new Map();
  let rawM1 = 0;
  let acceptedM1 = 0;
  let duplicateOrOverlap = 0;
  let lastProcessedTs = -Infinity;
  let chunks = 0;

  for (let cursor = new Date(start.getTime()); cursor < end; ) {
    let next = addUtcMonths(cursor, chunkMonths);
    if (next > end) next = new Date(end.getTime());

    const data = await getHistoricalRates({
      instrument: 'xauusd',
      dates: { from: cursor, to: next },
      timeframe: 'm1',
      priceType: 'bid',
      format: 'json',
      utcOffset: 0,
      volumes: true,
      ignoreFlats,
      batchSize: 12,
      pauseBetweenBatchesMs: 80,
      useCache: true,
      cacheFolderPath: '.dukascopy-cache-copytolive-gold-m1'
    });

    if (!Array.isArray(data)) {
      throw new Error('Dukascopy M1 returned non-array for ' + cursor.toISOString());
    }

    data.sort((a, b) => timestampMs(a) - timestampMs(b));
    rawM1 += data.length;

    for (const x of data) {
      const ts = timestampMs(x);
      const o = Number(x.open);
      const h = Number(x.high);
      const l = Number(x.low);
      const c = Number(x.close);
      const v = Number(x.volume || 0);

      if (![ts, o, h, l, c, v].every(Number.isFinite)) continue;
      if (ts < start.getTime() || ts >= end.getTime()) continue;

      // Sequential chunks can overlap by one boundary candle depending on the
      // upstream inclusive/exclusive convention. Production has one M1 row per
      // timestamp, so skip duplicate/overlap timestamps deterministically.
      if (ts <= lastProcessedTs) {
        duplicateOrOverlap += 1;
        continue;
      }
      lastProcessedTs = ts;

      if (o <= 0 || h <= 0 || l <= 0 || c <= 0) continue;
      if (h < l || o < l || o > h || c < l || c > h) {
        throw new Error('M1 OHLC violation ' + new Date(ts).toISOString());
      }
      acceptedM1 += 1;

      const hourTs = Math.floor(ts / 3600000) * 3600000;
      const prev = hours.get(hourTs);
      if (!prev) {
        hours.set(hourTs, {
          ts: hourTs,
          open: o,
          high: h,
          low: l,
          close: c,
          volume: v,
          firstTs: ts,
          lastTs: ts
        });
      } else {
        if (ts < prev.firstTs) {
          prev.firstTs = ts;
          prev.open = o;
        }
        if (ts >= prev.lastTs) {
          prev.lastTs = ts;
          prev.close = c;
        }
        if (h > prev.high) prev.high = h;
        if (l < prev.low) prev.low = l;
        prev.volume += v;
      }

      const dayTs = Math.floor(ts / 86400000) * 86400000;
      const day = days.get(dayTs);
      if (!day) {
        days.set(dayTs, {
          ts: dayTs,
          open: o,
          high: h,
          low: l,
          close: c,
          volume: v,
          firstTs: ts,
          lastTs: ts
        });
      } else {
        if (ts < day.firstTs) {
          day.firstTs = ts;
          day.open = o;
        }
        if (ts >= day.lastTs) {
          day.lastTs = ts;
          day.close = c;
        }
        if (h > day.high) day.high = h;
        if (l < day.low) day.low = l;
        day.volume += v;
      }
    }

    chunks += 1;
    console.error(JSON.stringify({
      stage: 'M1_CHUNK',
      chunk: chunks,
      from: cursor.toISOString(),
      to: next.toISOString(),
      rows: data.length,
      accepted_m1_total: acceptedM1,
      h1_total: hours.size
    }));

    cursor = next;
  }

  const ordered = [...hours.values()].sort((a, b) => a.ts - b.ts);
  if (ordered.length < 10000) {
    throw new Error('M1-resampled GOLD H1 unexpectedly short: ' + ordered.length);
  }

  const lines = ['Date,open,high,low,close,volume'];
  let prevHour = -Infinity;
  for (const x of ordered) {
    if (x.ts <= prevHour) throw new Error('non-monotonic H1 timestamp');
    prevHour = x.ts;
    lines.push([
      new Date(x.ts).toISOString(),
      x.open,
      x.high,
      x.low,
      x.close,
      x.volume
    ].join(','));
  }

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  const body = lines.join('\n') + '\n';
  fs.writeFileSync(outPath, body);

  const orderedD1 = [...days.values()].sort((a, b) => a.ts - b.ts);
  const d1Lines = ['Date,open,high,low,close,volume'];
  for (const x of orderedD1) {
    d1Lines.push([
      new Date(x.ts).toISOString(),
      x.open,
      x.high,
      x.low,
      x.close,
      x.volume
    ].join(','));
  }
  fs.mkdirSync(path.dirname(d1OutPath), { recursive: true });
  const d1Body = d1Lines.join('\n') + '\n';
  fs.writeFileSync(d1OutPath, d1Body);

  console.log(JSON.stringify({
    status: 'PASS',
    construction: 'DUKASCOPY_M1_RESAMPLE_H1',
    production_reference: 'pipeline/convert_dukascopy.py',
    provider: 'Dukascopy',
    instrument: 'xauusd',
    source_timeframe: 'm1',
    output_timeframes: ['h1','d1'],
    priceType: 'bid',
    ignoreFlats,
    resample: {
      bucket: 'UTC 1h',
      open: 'first',
      high: 'max',
      low: 'min',
      close: 'last',
      volume: 'sum',
      empty_hours: 'drop'
    },
    from: fromIso,
    to_exclusive: toIso,
    chunks,
    raw_m1_rows: rawM1,
    accepted_m1_rows: acceptedM1,
    duplicate_or_overlap_rows: duplicateOrOverlap,
    h1_rows: ordered.length,
    d1_rows: orderedD1.length,
    h1_sha256: crypto.createHash('sha256').update(body).digest('hex'),
    d1_sha256: crypto.createHash('sha256').update(d1Body).digest('hex'),
    h1_output: outPath,
    d1_output: d1OutPath
  }, null, 2));
})().catch(err => {
  console.error(err && err.stack ? err.stack : String(err));
  process.exit(1);
});
