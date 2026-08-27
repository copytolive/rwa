import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';

const BASE=(process.env.RWA_TEST_URL||'https://copytolive.github.io/rwa').replace(/\/$/,'');
const OUT=path.resolve('artifacts/renko-atr-zero-blocking');
const VALUES=[1,10,100,1000,10000,100000,1000000];
await fs.mkdir(OUT,{recursive:true});
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1900,height:1000},deviceScaleFactor:1});
const errors=[];
page.on('pageerror',e=>errors.push(String(e?.message||e)));
page.on('console',m=>{if(m.type()==='error'&&!/Failed to load resource|WebSocket connection/i.test(m.text()))errors.push(m.text())});
await page.goto(`${BASE}/renko/?symbol=SOL&atrZeroBlocking=1&ts=${Date.now()}`,{waitUntil:'domcontentloaded',timeout:60000});
await page.waitForFunction(()=>window.RWARenkoTV?.state?.status==='live'&&window.RWARenkoATRParity?.version==='3.0.0'&&window.RWARenkoATRInstant?.version==='2.0.0'&&window.RWARenko1sCloseLock?.version==='1.0.0'&&RWARenkoTV.settings.interval==='1s'&&RWARenkoTV.settings.source==='close',null,{timeout:60000});

async function warmExactCurrentRevision(){
  await page.evaluate(()=>RWARenkoATRInstant.warm());
  await page.waitForFunction(()=>document.documentElement.dataset.atrInstantReady==='true'&&RWARenkoATRInstant.warmContext===RWARenkoATRInstant.contextKey()&&RWARenkoTV.settings.interval==='1s'&&RWARenkoTV.settings.source==='close',null,{timeout:360000});
  return page.evaluate(()=>RWARenkoATRInstant.contextKey());
}

async function snapshot(){
  return page.evaluate(()=>({
    atrLength:RWARenkoTV?.settings?.atrLength,
    interval:RWARenkoTV?.settings?.interval,
    source:RWARenkoTV?.settings?.source,
    fixedSource:RWARenkoTV?.state?.fixedSourceProfile===true,
    intervalControlHidden:!!document.querySelector('.source-grid')?.hidden,
    atr:RWARenkoTV?.state?.atr,
    box:RWARenkoTV?.state?.box,
    confirmed:RWARenkoTV?.state?.confirmed?.length,
    sourceBars:RWARenkoTV?.state?.atrHistorySourceCount||RWARenkoTV?.state?.closedBars?.length,
    displayBars:RWARenkoTV?.state?.closedBars?.length,
    latestClosed:RWARenkoTV?.state?.closedBars?.at(-1)?.closeTime,
    historySatisfied:RWARenkoTV?.state?.atrHistorySatisfied,
    blockingMs:Number(document.documentElement.dataset.atrBlockingMs),
    frameMs:Number(document.documentElement.dataset.atrInstantFrameMs),
    cacheHit:document.documentElement.dataset.atrInstantCacheHit==='true',
    ready:document.documentElement.dataset.atrInstantReady,
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

await warmExactCurrentRevision();
const sourceProfile=await page.evaluate(()=>({interval:RWARenkoTV.settings.interval,source:RWARenkoTV.settings.source,fixed:RWARenkoTV.state.fixedSourceProfile===true,gridHidden:!!document.querySelector('.source-grid')?.hidden,sourceText:document.querySelector('#sourceText')?.textContent}));
const results=[];
let failure=null;
for(const length of VALUES){
  let passed=null,lastError=null;
  for(let attempt=1;attempt<=12&&!passed;attempt++){
    const preparedContext=await warmExactCurrentRevision();
    await page.fill('#atrLength',String(length));
    const contextBeforeClick=await page.evaluate(()=>RWARenkoATRInstant.contextKey());
    if(contextBeforeClick!==preparedContext)continue;
    const started=Date.now();
    await page.click('[data-apply-method="atr"]');
    try{
      await page.waitForFunction(({n,ctx})=>RWARenkoATRInstant.contextKey()===ctx&&RWARenkoATRInstant.warmContext===ctx&&RWARenkoTV.settings.interval==='1s'&&RWARenkoTV.settings.source==='close'&&RWARenkoTV.settings.atrLength===n&&RWARenkoTV.state.atrLastApply?.length===n&&RWARenkoTV.state.atrInstantMetric?.length===n&&RWARenkoTV.state.atrHistorySatisfied===true&&(RWARenkoTV.state.atrHistorySourceCount||0)>=n&&document.documentElement.dataset.atrInstantCacheHit==='true'&&document.documentElement.dataset.atrBlockingMs==='0',{n:length,ctx:preparedContext},{timeout:10000});
      const snap=await snapshot();
      if(snap.currentContext!==preparedContext||snap.warmContext!==preparedContext)continue;
      passed={...snap,wallMs:Date.now()-started,preparedContext,attempt};
    }catch(e){
      lastError=e;
      const nowContext=await page.evaluate(()=>RWARenkoATRInstant.contextKey());
      if(nowContext!==preparedContext)continue;
      break;
    }
  }
  if(!passed){
    failure={length,error:String(lastError?.message||lastError||'prepared current-revision 0ms assertion failed'),state:await snapshot()};
    await page.screenshot({path:path.join(OUT,`FAILED-atr-${length}.png`),fullPage:true});
    break;
  }
  results.push(passed);
  await page.screenshot({path:path.join(OUT,`atr-${length}-0ms-blocking.png`),fullPage:true});
}
const sourcePass=sourceProfile.interval==='1s'&&sourceProfile.source==='close'&&sourceProfile.fixed&&sourceProfile.gridHidden;
const pass=!failure&&errors.length===0&&sourcePass&&results.length===VALUES.length&&results.every((x,i)=>x.cacheHit&&x.blockingMs===0&&x.atrLength===VALUES[i]&&x.lastApply?.length===VALUES[i]&&x.interval==='1s'&&x.source==='close'&&x.fixedSource&&x.intervalControlHidden&&x.historySatisfied&&x.sourceBars>=VALUES[i]&&x.warmContext===x.currentContext&&x.currentContext===x.preparedContext);
const report={url:page.url(),values:VALUES,sourceProfile,results,failure,errors,pass,note:'All seven proofs use the fixed Binance 1-second CLOSED-kline Close source. 0 ms means measured main-thread Total Blocking Time for a prepared exact-current-revision cache switch, not literal wall-clock elapsed time. Deep Wilder ATR history is acquired/calculated in a Web Worker; the main thread does not materialize one million source objects.'};
await fs.writeFile(path.join(OUT,'report.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
await browser.close();
if(!pass)process.exit(1);
