const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { getHistoricalRates } = require('dukascopy-node');

const ROOT = path.resolve(__dirname, '..');
const catalogPath = path.join(__dirname, 'assets.json');
const outputPath = path.join(__dirname, 'asset_status.json');
const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
const sampleFrom = new Date('2024-01-02T12:00:00.000Z');
const sampleTo = new Date('2024-01-02T12:15:00.000Z');

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

async function verifyDukascopy(asset) {
  const data = await getHistoricalRates({
    instrument: asset.provider_symbol,
    dates: { from: sampleFrom, to: sampleTo },
    timeframe: 'tick',
    format: 'json',
    batchSize: 2,
    pauseBetweenBatchesMs: 100
  });
  const rows = Array.isArray(data) ? data : [];
  const valid = rows.filter(x => Number.isFinite(Number(x.bidPrice)) && Number.isFinite(Number(x.askPrice)) && Number(x.askPrice) >= Number(x.bidPrice));
  if (!valid.length) throw new Error('zero valid bid/ask ticks in verification window');
  const first = valid[0], last = valid[valid.length - 1];
  const fingerprintPayload = valid.map(x => `${x.timestamp}|${x.bidPrice}|${x.askPrice}`).join('\n');
  return {
    status: 'VERIFIED',
    sample_count: valid.length,
    sample_sha256: sha256(fingerprintPayload),
    first_timestamp: Number(first.timestamp),
    last_timestamp: Number(last.timestamp),
    sample_from: sampleFrom.toISOString(),
    sample_to: sampleTo.toISOString()
  };
}

async function verifyBinance(asset) {
  const day = '2024-01-02';
  const name = `${asset.provider_symbol}-aggTrades-${day}.zip`;
  const url = `https://data.binance.vision/data/spot/daily/aggTrades/${asset.provider_symbol}/${name}`;
  const r = await fetch(url, { headers: { 'User-Agent': 'VectorForgeAssetVerifier/1.0' } });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const buf = Buffer.from(await r.arrayBuffer());
  if (buf.length < 1000) throw new Error('archive unexpectedly small');
  return {
    status: 'VERIFIED',
    sample_count: null,
    sample_sha256: sha256(buf),
    archive_bytes: buf.length,
    sample_from: `${day}T00:00:00.000Z`,
    sample_to: `${day}T23:59:59.999Z`
  };
}

(async () => {
  const results = [];
  for (const asset of catalog.assets) {
    const started = Date.now();
    try {
      const v = asset.provider === 'dukascopy' ? await verifyDukascopy(asset) : await verifyBinance(asset);
      results.push({ ...asset, ...v, verified_at: new Date().toISOString(), latency_ms: Date.now() - started });
      console.log(`PASS ${asset.symbol} ${v.sample_count ?? v.archive_bytes}`);
    } catch (err) {
      results.push({ ...asset, status: 'FAILED', error: String(err && err.message ? err.message : err), verified_at: new Date().toISOString(), latency_ms: Date.now() - started });
      console.error(`FAIL ${asset.symbol}: ${err && err.message ? err.message : err}`);
    }
  }
  const verified = results.filter(x => x.status === 'VERIFIED').length;
  const payload = {
    schema_version: 1,
    generated_at: new Date().toISOString(),
    verification_window: { from: sampleFrom.toISOString(), to: sampleTo.toISOString() },
    total_assets: results.length,
    verified_assets: verified,
    failed_assets: results.length - verified,
    primary_provider: catalog.primary_provider,
    assets: results
  };
  fs.writeFileSync(outputPath, JSON.stringify(payload, null, 2));
  console.log(`VectorForge asset verification: ${verified}/${results.length} verified`);
  if (!verified) process.exit(1);
})().catch(err => {
  console.error(err && err.stack ? err.stack : String(err));
  process.exit(1);
});
