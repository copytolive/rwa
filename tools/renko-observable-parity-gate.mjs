import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT=path.resolve('.');
await import(path.join(ROOT,'renko/renko-tv-engine.js'));
const E=globalThis.RWARenkoTVEngine;
if(!E)throw new Error('RWARenkoTVEngine missing');

const [index,fixture]=await Promise.all([
  fs.readFile(path.join(ROOT,'renko/index.html'),'utf8'),
  fs.readFile(path.join(ROOT,'renko/fixtures/gold-20y-close-parity.json'),'utf8').then(JSON.parse),
]);
const exists=async p=>fs.access(path.join(ROOT,p)).then(()=>true).catch(()=>false);
const bars=fixture.bars.map(([t,c])=>({openTime:t,closeTime:t+86400000-1,open:c,high:c,low:c,close:c}));
const build=box=>E.build(bars,{method:'traditional',boxSize:box,source:'close',wicks:false},0.1);
const r800=build(800),r900=build(900),r1000=build(1000),r1200=build(1200);
const spanYears=(bars.at(-1).closeTime-bars[0].openTime)/(365.2425*86400000);
const goldLongHistoryPass=spanYears>=20&&r900.bricks.length===5&&r1000.bricks.length===5&&r800.bricks.length>r900.bricks.length&&r1200.bricks.length<r900.bricks.length;

const percentageExample=E.computeBox([{open:216,high:216,low:216,close:216,openTime:0,closeTime:1}],{method:'percentage',percentage:.01},.01);
const percentageLtpOfficialExamplePass=Math.abs(percentageExample-2)<1e-12;

const sourceControlPass=/id=["']sourceSelect["']/.test(index)&&/id=["']intervalSelect["']/.test(index);
const fixed1sOnlyAbsentPass=!/renko-tv-1s-close-lock\.js/.test(index)&&!/FIXED RENKO SOURCE/.test(index);
const historyLadderModulePass=await exists('renko/renko-tv-history-ladder.js');
const declaredFullParityPass=/observableParity/.test(index)&&!/fixed Binance 1-second/i.test(index);

const checks={
  goldLongHistoryPass,
  percentageLtpOfficialExamplePass,
  sourceControlPass,
  fixed1sOnlyAbsentPass,
  historyLadderModulePass,
  declaredFullParityPass,
};
const report={
  schema:'renko-tradingview-observable-parity-gate-v1',
  status:Object.values(checks).every(Boolean)?'PASS':'FAIL',
  checks,
  gold:{
    fixture:fixture.schema,
    rawCsvSha256:fixture.raw_csv_sha256,
    gateAValidated:fixture.gate_a_validated,
    witnessSpanYears:Number(spanYears.toFixed(2)),
    sourceRowsDaily:fixture.source_rows_daily,
    counts:{box800:r800.bricks.length,box900:r900.bricks.length,box1000:r1000.bricks.length,box1200:r1200.bricks.length},
    fullDailyExpected:fixture.full_daily_expected,
  },
  percentage:{officialExampleInput:{ltp:216,percent:1,minTick:.01},actualBox:percentageExample,expectedBox:2},
  contract:{
    source:'TradingView exposes Close/OHLC source selection',
    timeframe:'selected chart timeframe is the finest historical source resolution',
    deepHistory:'when lower-timeframe history ends, TradingView uses higher-timeframe history',
    percentageLtp:'LTP x percent, min-tick rounding, then TradingView additional stability rounding',
    claimBoundary:'PASS means observable contract gates here pass; it is not a claim of access to proprietary TradingView source code',
  },
};
console.log('RENKO_OBSERVABLE_PARITY_GATE',JSON.stringify(report));
if(report.status!=='PASS')process.exitCode=2;
