import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const base=(process.env.RWA_TEST_URL||'http://127.0.0.1:8080/rwa').replace(/\/$/,'');
const out=process.env.RENKO_XAUT_MATRIX_OUT||'artifacts/renko-xaut-atr-matrix';
const lengths=[1,10,100,1000,10000,100000,1000000];
fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true});
const results=[];
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

async function run(label,viewport){
  const page=await browser.newPage({viewport});
  const errors=[],consoleErrors=[],failed=[];
  page.on('pageerror',e=>errors.push(String(e?.message||e)));
  page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text())});
  page.on('requestfailed',r=>failed.push({url:r.url(),error:r.failure()?.errorText||''}));
  await page.addInitScript(()=>{try{localStorage.removeItem('rwa_renko_tradingview_settings_v1')}catch{}});
  const url=`${base}/renko/?symbol=XAUT&xautAtrMatrix=1&ts=${Date.now()}`;
  const response=await page.goto(url,{waitUntil:'domcontentloaded',timeout:45000});
  await page.waitForFunction(()=>window.RWARenkoTV?.state?.symbol==='XAUTUSDT'&&window.RWARenkoTV?.state?.status==='live'&&window.RWARenkoTV?.settings?.interval==='1m'&&window.RWARenkoTV?.state?.closedBars?.length>100&&document.documentElement.dataset.marketProvider==='gate-spot',{timeout:60000});
  await page.waitForFunction(()=>document.documentElement.dataset.atrMatrixReady==='true',{timeout:720000});
  // The minute may close while the million-bar worker is warming. The product
  // refreshes the prepared states in-place every few seconds. Do not measure an
  // ATR click until the cache revision is exactly the latest closed source bar.
  await page.waitForFunction(()=>{const b=window.RWARenkoTV?.state?.closedBars?.at?.(-1),rev=Number(b?.closeTime||b?.openTime)||0;return rev>0&&Number(document.documentElement.dataset.atrMatrixRevision)===rev},{timeout:60000});
  await sleep(800);
  const ready=await page.evaluate(()=>({warmMs:Number(document.documentElement.dataset.atrMatrixWarmMs)||0,available:Number(document.documentElement.dataset.atrMatrixAvailable)||0,revision:Number(document.documentElement.dataset.atrMatrixRevision)||0,provider:window.RWARenkoXAUTProvider?.provider,providerStats:{...window.RWARenkoXAUTProvider?.stats},matrixVersion:window.RWARenkoATRParity?.version,matrix:[...(window.RWARenkoATRParity?.matrix||[])]}));
  const rows=[];
  for(const n of lengths){
    // If another 1m close lands between matrix rows, allow the automatic worker
    // refresh to catch up before clicking so the test measures prepared switching,
    // not provider refresh latency.
    await page.waitForFunction(()=>{const b=window.RWARenkoTV?.state?.closedBars?.at?.(-1),rev=Number(b?.closeTime||b?.openTime)||0;return Number(document.documentElement.dataset.atrMatrixRevision)===rev},{timeout:60000});
    await page.fill('#atrLength',String(n));
    await page.click('[data-apply-method="atr"]');
    await page.waitForFunction(n=>window.RWARenkoTV?.state?.atrAppliedLength===n&&window.RWARenkoTV?.state?.atrHistorySatisfied===true&&document.documentElement.dataset.atrRawBoxPass==='true'&&Number(document.documentElement.dataset.atrLength)===n,n,{timeout:60000});
    await sleep(350);
    const row=await page.evaluate(n=>{
      const T=window.RWARenkoTV,s=T.state,e=window.RWARenkoATRParity?.matrixEntries?.get?.(n),br=s.confirmed||[],first=br[0],last=br.at(-1);
      const raw=Number(s.atrRaw),box=Number(s.box),tol=Math.max(1e-12,Math.abs(raw)*1e-10);
      return {length:n,method:T.settings.method,interval:T.settings.interval,source:T.settings.source,rawAtr:raw,box,rawEqualsBox:Number.isFinite(raw)&&raw>0&&Math.abs(raw-box)<=tol,historySatisfied:!!s.atrHistorySatisfied,sourceCount:Number(s.atrHistorySourceCount)||0,historyFrom:Number(s.atrHistoryFrom)||0,historyTo:Number(s.atrHistoryTo)||0,confirmed:Number(br.length)||0,firstBrickTime:Number(first?.sourceTime)||0,lastBrickTime:Number(last?.sourceTime)||0,anchor:Number(s.base?.anchor),applyMs:Number(s.atrMatrixLastApplyMs)||0,longTaskDelta:Number(s.atrMatrixLongTaskDelta)||0,warmMs:Number(s.atrMatrixWarmMs)||0,provider:s.atrMatrixProvider||'',badge:document.querySelector('.method[data-method="atr"] .method-title span')?.textContent||'',coverage:document.getElementById('tvCoverage')?.textContent||'',matrixEntry:{satisfied:!!e?.satisfied,sourceCount:Number(e?.sourceCount)||0,fromTime:Number(e?.fromTime)||0,toTime:Number(e?.toTime)||0,rawAtr:Number(e?.rawAtr),box:Number(e?.box),brickCount:Number(e?.base?.bricks?.length)||0}};
    },n);
    row.pass=row.method==='atr'&&row.interval==='1m'&&row.rawEqualsBox&&row.historySatisfied&&row.sourceCount>=n&&row.confirmed>0&&row.firstBrickTime>0&&row.lastBrickTime>=row.firstBrickTime&&row.longTaskDelta===0&&row.matrixEntry.satisfied&&row.matrixEntry.sourceCount===row.sourceCount&&row.matrixEntry.brickCount===row.confirmed;
    rows.push(row);
    await page.screenshot({path:path.join(out,`${label}-atr-${n}.png`),fullPage:true});
  }
  const by=new Map(rows.map(r=>[r.length,r]));
  const progressive=[1000,10000,100000,1000000].every((n,i,a)=>i===0||by.get(n).historyFrom<by.get(a[i-1]).historyFrom);
  const deepActual=[10000,100000,1000000].every(n=>by.get(n).firstBrickTime>=by.get(n).historyFrom&&by.get(n).firstBrickTime<=by.get(n).historyTo&&by.get(n).lastBrickTime<=by.get(n).historyTo);
  const applyNoBlock=rows.every(r=>r.longTaskDelta===0&&r.applyMs<50);
  const providerFailures=failed.filter(x=>/gateio/i.test(x.url));
  const pass=!!response?.ok()&&ready.provider==='Gate Spot'&&ready.matrixVersion==='4.0.0'&&ready.matrix.join(',')===lengths.join(',')&&ready.available>=1000000&&rows.every(r=>r.pass)&&progressive&&deepActual&&applyNoBlock&&!errors.length;
  const result={label,viewport,url,httpStatus:response?.status(),ready,rows,progressiveHistoryFrom:progressive,deepBrickDatesInsideSourceCoverage:deepActual,applyNoBlock,errors,consoleErrors,providerFailures:providerFailures.slice(0,50),providerFailureCount:providerFailures.length,pass};
  results.push(result);
  await page.close();
}

try{await run('desktop',{width:1900,height:1000});await run('mobile',{width:390,height:844})}finally{await browser.close()}
const report={schema:'renko-xaut-atr-seven-length-browser-v2',generatedAt:new Date().toISOString(),base,lengths,status:results.every(r=>r.pass)?'PASS':'FAIL',claimBoundary:'PASS means the seven XAUT ATR settings satisfy the documented/observable Wilder-ATR Renko contract on regular Gate Spot 1m OHLC data; it is not a claim of TradingView proprietary source-code identity.',results};
fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));
console.log('RENKO_XAUT_ATR_MATRIX_REPORT '+JSON.stringify(report));
if(report.status!=='PASS')process.exit(2);
