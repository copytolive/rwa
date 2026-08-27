import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';

const BASE=(process.env.RWA_TEST_URL||'https://copytolive.github.io/rwa').replace(/\/$/,'');
const OUT=path.resolve('artifacts/renko-atr-zero-blocking');
const VALUES=[14,140,500,6000,10000];
await fs.mkdir(OUT,{recursive:true});
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1900,height:1000},deviceScaleFactor:1});
const errors=[];
page.on('pageerror',e=>errors.push(String(e?.message||e)));
page.on('console',m=>{if(m.type()==='error'&&!/Failed to load resource|WebSocket connection/i.test(m.text()))errors.push(m.text())});
await page.goto(`${BASE}/renko/?symbol=SOL&atrZeroBlocking=1&ts=${Date.now()}`,{waitUntil:'domcontentloaded',timeout:60000});
await page.waitForFunction(()=>window.RWARenkoTV?.state?.status==='live'&&window.RWARenkoATRParity?.version==='3.0.0'&&window.RWARenkoATRInstant?.version==='1.0.0',null,{timeout:60000});
await page.waitForFunction(()=>document.documentElement.dataset.atrInstantReady==='true',null,{timeout:90000});

const results=[];
for(const length of VALUES){
  await page.fill('#atrLength',String(length));
  const started=Date.now();
  await page.click('[data-apply-method="atr"]');
  await page.waitForFunction(n=>RWARenkoTV.settings.atrLength===n&&RWARenkoTV.state.atrLastApply?.length===n&&RWARenkoTV.state.atrInstantMetric?.length===n&&document.documentElement.dataset.atrInstantCacheHit==='true'&&document.documentElement.dataset.atrBlockingMs==='0',length,{timeout:20000});
  const wallMs=Date.now()-started;
  const snap=await page.evaluate(()=>({
    atrLength:RWARenkoTV.settings.atrLength,
    atr:RWARenkoTV.state.atr,
    box:RWARenkoTV.state.box,
    confirmed:RWARenkoTV.state.confirmed.length,
    sourceBars:RWARenkoTV.state.closedBars.length,
    blockingMs:Number(document.documentElement.dataset.atrBlockingMs),
    frameMs:Number(document.documentElement.dataset.atrInstantFrameMs),
    cacheHit:document.documentElement.dataset.atrInstantCacheHit==='true',
    metric:document.querySelector('#atrInstantMetric')?.textContent,
    coverage:document.querySelector('#tvCoverage')?.textContent,
    badge:document.querySelector('.method[data-method="atr"] .method-title span')?.textContent
  }));
  results.push({...snap,wallMs});
  await page.screenshot({path:path.join(OUT,`atr-${length}-0ms-blocking.png`),fullPage:true});
}
const pass=errors.length===0&&results.length===VALUES.length&&results.every(x=>x.cacheHit&&x.blockingMs===0&&x.atrLength===VALUES[results.indexOf(x)]);
const report={url:page.url(),values:VALUES,results,errors,pass,note:'0 ms refers to measured main-thread Total Blocking Time, not literal wall-clock elapsed time.'};
await fs.writeFile(path.join(OUT,'report.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
await browser.close();
if(!pass)process.exit(1);
