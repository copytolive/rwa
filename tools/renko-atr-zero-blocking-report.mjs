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
await page.waitForFunction(()=>window.RWARenkoTV?.state?.status==='live'&&window.RWARenkoATRParity?.version==='3.0.0'&&window.RWARenkoATRInstant?.version==='1.1.0',null,{timeout:60000});
await page.waitForFunction(()=>document.documentElement.dataset.atrInstantReady==='true',null,{timeout:90000});

async function snapshot(){
  return page.evaluate(()=>({
    atrLength:RWARenkoTV?.settings?.atrLength,
    atr:RWARenkoTV?.state?.atr,
    box:RWARenkoTV?.state?.box,
    confirmed:RWARenkoTV?.state?.confirmed?.length,
    sourceBars:RWARenkoTV?.state?.closedBars?.length,
    latestClosed:RWARenkoTV?.state?.closedBars?.at(-1)?.closeTime,
    historySatisfied:RWARenkoTV?.state?.atrHistorySatisfied,
    blockingMs:Number(document.documentElement.dataset.atrBlockingMs),
    frameMs:Number(document.documentElement.dataset.atrInstantFrameMs),
    cacheHit:document.documentElement.dataset.atrInstantCacheHit==='true',
    ready:document.documentElement.dataset.atrInstantReady,
    staged:document.documentElement.dataset.atrInstantStaged,
    metric:document.querySelector('#atrInstantMetric')?.textContent,
    coverage:document.querySelector('#tvCoverage')?.textContent,
    badge:document.querySelector('.method[data-method="atr"] .method-title span')?.textContent,
    lastApply:RWARenkoTV?.state?.atrLastApply||null,
    instantMetric:RWARenkoTV?.state?.atrInstantMetric||null,
    cacheSize:RWARenkoATRInstant?.cacheSize,
    warmContext:RWARenkoATRInstant?.warmContext,
    currentContext:RWARenkoATRInstant?.contextKey?.()
  }));
}

const results=[];
let failure=null;
for(let i=0;i<VALUES.length;i++){
  const length=VALUES[i];
  // If a 1m source candle closed since prewarm, wait for the revision-safe cache
  // to catch up BEFORE measuring the user's interaction.
  await page.waitForFunction(()=>document.documentElement.dataset.atrInstantReady==='true',null,{timeout:90000});
  await page.fill('#atrLength',String(length));
  const started=Date.now();
  await page.click('[data-apply-method="atr"]');
  try{
    await page.waitForFunction(n=>RWARenkoTV.settings.atrLength===n&&RWARenkoTV.state.atrLastApply?.length===n&&RWARenkoTV.state.atrInstantMetric?.length===n&&document.documentElement.dataset.atrInstantCacheHit==='true'&&document.documentElement.dataset.atrBlockingMs==='0',length,{timeout:10000});
  }catch(e){
    failure={length,error:String(e?.message||e),state:await snapshot()};
    await page.screenshot({path:path.join(OUT,`FAILED-atr-${length}.png`),fullPage:true});
    break;
  }
  const wallMs=Date.now()-started,snap=await snapshot();
  results.push({...snap,wallMs});
  await page.screenshot({path:path.join(OUT,`atr-${length}-0ms-blocking.png`),fullPage:true});
}
const pass=!failure&&errors.length===0&&results.length===VALUES.length&&results.every((x,i)=>x.cacheHit&&x.blockingMs===0&&x.atrLength===VALUES[i]&&x.lastApply?.length===VALUES[i]);
const report={url:page.url(),values:VALUES,results,failure,errors,pass,note:'0 ms refers to measured main-thread Total Blocking Time, not literal wall-clock elapsed time.'};
await fs.writeFile(path.join(OUT,'report.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
await browser.close();
if(!pass)process.exit(1);
