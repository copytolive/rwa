const { getHistoricalRates } = require('dukascopy-node');

(async () => {
  const [, , instrument, fromIso, toIso] = process.argv;
  if (!instrument || !fromIso || !toIso) {
    console.error('usage: node fetch_dukascopy.cjs <instrument> <from-iso> <to-iso>');
    process.exit(2);
  }
  const data = await getHistoricalRates({
    instrument,
    dates: { from: new Date(fromIso), to: new Date(toIso) },
    timeframe: 'tick',
    batchSize: 4,
    pauseBetweenBatchesMs: 150
  });
  for (const x of data || []) {
    const ts = Number(x.timestamp);
    const bid = Number(x.bidPrice);
    const ask = Number(x.askPrice);
    if (Number.isFinite(ts) && Number.isFinite(bid) && Number.isFinite(ask) && ask >= bid) {
      process.stdout.write(`${ts}\t${bid}\t${ask}\n`);
    }
  }
})().catch(err => {
  console.error(err && err.stack ? err.stack : String(err));
  process.exit(1);
});
