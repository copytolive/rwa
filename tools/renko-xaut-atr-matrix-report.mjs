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
  await page.addInitScript(()=>{
    try{localStorage.setItem('rwa_renko_tradingview_settings_v1',JSON.stringify({interval:'4h',source:'close',method:'atr',atrLength:1000000}))}catch{}
    window.__renkoLongTasks=[];try{if('PerformanceObserver'in window){const po=new PerformanceObserver(list=>{for(const e of list.getEntries())window.__renkoLongTasks.push({start:e.startTime,duration:e.duration})});po.observe({type:'longtask',buffered:true})}}catch{}
  });
  const url=`${base}/renko/?symbol=XAUT&fixed1sAtrMatrix=1&ts=${Date.now()}`;
  const response=await page.goto(url,{waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForFunction(()=>window.RWARenkoTV?.state?.symbol==='XAUTUSDT'&&window.RWARenkoTV?.state?.status==='live'&&window.RWARenkoTV?.settings?.interval==='1s'&&window.RWARenkoTV?.state?.closedBars?.length>100&&document.documentElement.dataset.marketProvider==='okx-spot'&&!document.querySelector('#intervalSelect'),null,{timeout:90000});
  await page.waitForFunction(()=>document.documentElement.dataset.atrMatrixReady==='true',null,{timeout:240000});
  await sleep(500);
  const ready=await page.evaluate(()=>({
    warmMs:Number(document.documentElement.dataset.atrMatrixWarmMs)||0,
    available:Number(document.documentElement.dataset.atrMatrixAvailable)||0,
    revision:Number(document.documentElement.dataset.atrMatrixRevision)||0,
    provider:window.RWARenkoXAUTProvider?.provider,
    providerFixedInterval:window.RWARenkoXAUTProvider?.fixedInterval,
    providerStats:{...window.RWARenkoXAUTProvider?.stats},
    matrixVersion:window.RWARenkoATRParity?.version,
    matrix:[...(window.RWARenkoATRParity?.matrix||[])],
    interval:window.RWARenkoTV?.settings?.interval,
    selectorExists:!!document.querySelector('#intervalSelect'),
    packProvider:document.documentElement.dataset.atrMatrixProvider||''
  }));
  const rows=[];
  for(const n of lengths){
    await page.evaluate(()=>{window.__applyMark=performance.now();window.__renkoLongTasks.length=0});
    await page.fill('#atrLength',String(n));
    await page.click('[data-apply-method="atr"]');
    await page.waitForFunction(n=>window.RWARenkoTV?.state?.atrAppliedLength===n&&window.RWARenkoTV?.state?.atrHistorySatisfied===true&&document.documentElement.dataset.atrRawBoxPass==='true'&&Number(document.documentElement.dataset.atrLength)===n&&window.RWARenkoTV?.settings?.interval==='1s',n,{timeout:90000});
    await sleep(250);
    const row=await page.evaluate(n=>{
      const T=window.RWARenkoTV,s=T.state,br=s.confirmed||[],first=br[0],last=br.at(-1),raw=Number(s.atrRaw),box=Number(s.box),tol=Math.max(1e-12,Math.abs(raw)*1e-10),mark=Number(window.__applyMark)||0;
      const tbt=(window.__renkoLongTasks||[]).filter(x=>x.start>=mark).reduce((a,x)=>a+Math.max(0,Number(x.duration)-50),0);
      return {length:n,method:T.settings.method,interval:T.settings.interval,source:T.settings.source,rawAtr:raw,atr:Number(s.atr),box,rawEqualsBox:Number.isFinite(raw)&&raw>0&&Math.abs(raw-box)<=tol,atrEqualsBox:Number.isFinite(Number(s.atr))&&Math.abs(Number(s.atr)-box)<=tol,historySatisfied:!!s.atrHistorySatisfied,sourceCount:Number(s.atrHistorySourceCount)||0,historyFrom:Number(s.atrHistoryFrom)||0,historyTo:Number(s.atrHistoryTo)||0,confirmed:Number(br.length)||0,firstBrickTime:Number(first?.sourceTime)||0,lastBrickTime:Number(last?.sourceTime)||0,anchor:Number(s.base?.anchor),applyMs:Number(document.documentElement.dataset.atrMatrixApplyMs)||0,runtimeTbtMs:Number(document.documentElement.dataset.atrMatrixTbtMs)||0,observedTbtMs:tbt,provider:s.atrMatrixProvider||'',badge:document.querySelector('.method[data-method="atr"] .method-title span')?.textContent||'',coverage:document.getElementById('tvCoverage')?.textContent||'',selectorExists:!!document.querySelector('#intervalSelect'),fixedInterval:window.RENKO_FIXED_INTERVAL,currentInterval:document.getElementById('currentInterval')?.textContent||'',baseBox:Number(s.base?.box)};
    },n);
    row.pass=row.method==='atr'&&row.interval==='1s'&&row.fixedInterval==='1s'&&!row.selectorExists&&row.rawEqualsBox&&row.atrEqualsBox&&row.historySatisfied&&row.sourceCount>=n&&row.confirmed>0&&row.firstBrickTime>0&&row.lastBrickTime>=row.firstBrickTime&&row.observedTbtMs===0&&row.runtimeTbtMs===0&&row.applyMs<50&&Math.abs(row.baseBox-row.box)<=Math.max(1e-12,Math.abs(row.box)*1e-10);
    rows.push(row);
    await page.screenshot({path:path.join(out,`${label}-atr-${n}.png`),fullPage:true});
  }
  const million=rows.at(-1);
  const rev0=await page.evaluate(()=>Number(window.RWARenkoTV?.state?.closedBars?.at(-1)?.closeTime)||0);
  await page.waitForFunction(r=>Number(window.RWARenkoTV?.state?.closedBars?.at(-1)?.closeTime)>r,rev0,{timeout:20000});
  await sleep(2200);
  const persistence=await page.evaluate(()=>{
    const T=window.RWARenkoTV,s=T.state,raw=Number(s.atrRaw),box=Number(s.box),atr=Number(s.atr),tol=Math.max(1e-12,Math.abs(raw)*1e-10);
    return {interval:T.settings.interval,length:Number(T.settings.atrLength),appliedLength:Number(s.atrAppliedLength),rawAtr:raw,atr,box,rawEqualsBox:Number.isFinite(raw)&&raw>0&&Math.abs(raw-box)<=tol,atrEqualsBox:Number.isFinite(atr)&&Math.abs(atr-box)<=tol,historySatisfied:!!s.atrHistorySatisfied,sourceCount:Number(s.atrHistorySourceCount)||0,revision:Number(s.closedBars.at(-1)?.closeTime)||0,selectorExists:!!document.querySelector('#intervalSelect'),fixedInterval:window.RENKO_FIXED_INTERVAL,stableStats:{...(window.RWARenkoStableChartV2?.stats||{})}};
  });
  await page.screenshot({path:path.join(out,`${label}-atr-1000000-post-close.png`),fullPage:true});
  const providerFailures=failed.filter(x=>/okx|XAUT|binance/i.test(x.url));
  const matrixPass=rows.every(r=>r.pass);
  const persistencePass=persistence.interval==='1s'&&persistence.fixedInterval==='1s'&&!persistence.selectorExists&&persistence.length===1000000&&persistence.appliedLength===1000000&&persistence.rawEqualsBox&&persistence.atrEqualsBox&&persistence.historySatisfied&&persistence.sourceCount>=1000000&&persistence.revision>rev0&&Math.abs(persistence.box-million.box)<=Math.max(1e-12,Math.abs(million.box)*1e-8);
  const pass=!!response?.ok()&&ready.provider==='OKX Spot'&&ready.providerFixedInterval==='1s'&&ready.interval==='1s'&&!ready.selectorExists&&ready.matrix.join(',')===lengths.join(',')&&ready.available>=1000999&&/OKX Spot XAUT-USDT fixed 1s/i.test(ready.packProvider)&&matrixPass&&persistencePass&&!errors.length;
  results.push({label,viewport,url,httpStatus:response?.status(),ready,rows,persistence,persistencePass,errors,consoleErrors,providerFailures:providerFailures.slice(0,50),providerFailureCount:providerFailures.length,pass});
  await page.close();
}

try{await run('desktop',{width:1900,height:1000});await run('mobile',{width:390,height:844})}finally{await browser.close()}
const report={schema:'renko-xaut-fixed-1s-atr-seven-length-browser-v1',generatedAt:new Date().toISOString(),base,lengths,status:results.every(r=>r.pass)?'PASS':'FAIL',contract:'Production timeframe selector is absent and runtime is hard-locked to 1s. Each positive raw Wilder ATR becomes the actual Renko box for the seven requested lengths, with prepared-switch observed main-thread TBT = 0 ms and deep ATR persistence across later 1s closes.',claimBoundary:'Observable/documented Renko parity only; no claim of TradingView proprietary source-code identity.',results};
fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));
console.log('RENKO_XAUT_ATR_MATRIX_REPORT '+JSON.stringify(report));
if(report.status!=='PASS')process.exit(2);
