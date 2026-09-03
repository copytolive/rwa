const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { getHistoricalRates } = require('dukascopy-node');

const catalogPath = path.join(__dirname, 'assets.json');
const outputPath = path.join(__dirname, 'asset_status.json');
const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
const windows = [
  [new Date('2024-01-02T12:00:00.000Z'), new Date('2024-01-02T12:15:00.000Z')],
  [new Date('2024-01-03T14:00:00.000Z'), new Date('2024-01-03T14:15:00.000Z')],
  [new Date('2024-06-03T12:00:00.000Z'), new Date('2024-06-03T12:15:00.000Z')]
];

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

async function verifyDukascopy(asset) {
  const attempts=[];
  for(const [sampleFrom,sampleTo] of windows){
    try{
      const data = await getHistoricalRates({
        instrument: asset.provider_symbol,
        dates: { from: sampleFrom, to: sampleTo },
        timeframe: 'tick',
        format: 'json',
        batchSize: 2,
        pauseBetweenBatchesMs: 150
      });
      const rows = Array.isArray(data) ? data : [];
      const valid = rows.filter(x => Number.isFinite(Number(x.bidPrice)) && Number.isFinite(Number(x.askPrice)) && Number(x.askPrice) >= Number(x.bidPrice));
      attempts.push({from:sampleFrom.toISOString(),to:sampleTo.toISOString(),valid_ticks:valid.length});
      if(!valid.length)continue;
      const first = valid[0], last = valid[valid.length - 1];
      const fingerprintPayload = valid.map(x => `${x.timestamp}|${x.bidPrice}|${x.askPrice}`).join('\n');
      return {
        status: 'VERIFIED',
        sample_count: valid.length,
        sample_sha256: sha256(fingerprintPayload),
        first_timestamp: Number(first.timestamp),
        last_timestamp: Number(last.timestamp),
        sample_from: sampleFrom.toISOString(),
        sample_to: sampleTo.toISOString(),
        verification_attempts: attempts
      };
    }catch(err){
      attempts.push({from:sampleFrom.toISOString(),to:sampleTo.toISOString(),error:String(err&&err.message?err.message:err)});
    }
  }
  const e=new Error('zero valid bid/ask ticks across all verification windows');
  e.attempts=attempts;
  throw e;
}

(async () => {
  const results = [];
  for (const asset of catalog.assets) {
    const started = Date.now();
    try {
      const v = await verifyDukascopy(asset);
      results.push({ ...asset, ...v, verified_at: new Date().toISOString(), latency_ms: Date.now() - started });
      console.log(`PASS ${asset.symbol} ${v.sample_count}`);
    } catch (err) {
      results.push({ ...asset, status: 'FAILED', error: String(err && err.message ? err.message : err), verification_attempts:err?.attempts||[], verified_at: new Date().toISOString(), latency_ms: Date.now() - started });
      console.error(`FAIL ${asset.symbol}: ${err && err.message ? err.message : err}`);
    }
  }
  const verified = results.filter(x => x.status === 'VERIFIED').length;
  const failedSymbols = results.filter(x=>x.status!=='VERIFIED').map(x=>x.symbol);
  const payload = {
    schema_version: 2,
    generated_at: new Date().toISOString(),
    verification_windows: windows.map(([from,to])=>({from:from.toISOString(),to:to.toISOString()})),
    total_assets: results.length,
    verified_assets: verified,
    failed_assets: results.length - verified,
    failed_symbols: failedSymbols,
    primary_provider: catalog.primary_provider,
    assets: results
  };
  fs.writeFileSync(outputPath, JSON.stringify(payload, null, 2));
  console.log(`VectorForge asset verification: ${verified}/${results.length} verified; failed=${failedSymbols.join(',')||'none'}`);
  if (!verified) process.exit(1);
})().catch(err => {
  console.error(err && err.stack ? err.stack : String(err));
  process.exit(1);
});
