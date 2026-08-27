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
page.on('console',m=>{if(m.type()==='error'&&!/Failed to load resource|WebSocket connection|Invalid language tag: en-US@posix/i.test(m.text()))errors.push(m.text())});
await page.goto(`${BASE}/renko/?symbol=SOL&atrZeroBlocking=1&ts=${Date.now()}`,{waitUntil:'domcontentloaded',timeout:60000});
await page.waitForFunction(()=>window.RWARenkoTV?.state?.status==='live'&&window.RWARenkoATRParity?.version==='3.0.0'&&window.RWARenkoATRInstant?.version==='2.1.0'&&window.RWARenkoStableChart?.version==='1.0.0'&&window.RWARenko1sCloseLock?.version==='1.0.0'&&RWARenkoTV.settings.interval==='1s'&&RWARenkoTV.settings.source==='close',null,{timeout:60000});

async function warmExact(){
  await page.evaluate(()=>RWARenkoATRInstant.warm());
  await page.waitForFunction(()=>document.documentElement.dataset.atrInstantReady==='true'&&RWARenkoATRInstant.warmContext===RWARenkoATRInstant.contextKey()&&RWARenkoTV.settings.interval==='1s'&&RWARenkoTV.settings.source==='close',null,{timeout:360000});
  return page.evaluate(()=>RWARenkoATRInstant.contextKey());
}
async function snapshot(){return page.evaluate(()=>({
  atrLength:RWARenkoTV.settings.atrLength,interval:RWARenkoTV.settings.interval,source:RWARenkoTV.settings.source,
  fixedSource:RWARenkoTV.state.fixedSourceProfile===true,noTimeframeControls:!document.querySelector('#intervalSelect')&&!document.querySelector('#sourceSelect'),
  atr:RWARenkoTV.state.atr,atrRaw:RWARenkoTV.state.atrRaw,box:RWARenkoTV.state.box,confirmed:RWARenkoTV.state.confirmed.length,
  sourceBars:RWARenkoTV.state.atrHistorySourceCount||RWARenkoTV.state.closedBars.length,displayBars:RWARenkoTV.state.closedBars.length,
  latestClosed:RWARenkoTV.state.closedBars.at(-1)?.closeTime,historySatisfied:RWARenkoTV.state.atrHistorySatisfied,
  blockingMs:Number(document.documentElement.dataset.atrBlockingMs),frameMs:Number(document.documentElement.dataset.atrInstantFrameMs),
  cacheHit:document.documentElement.dataset.atrInstantCacheHit==='true',metric:document.querySelector('#atrInstantMetric')?.textContent,
  coverage:document.querySelector('#tvCoverage')?.textContent,badge:document.querySelector('.method[data-method="atr"] .method-title span')?.textContent,
  lastApply:RWARenkoTV.state.atrLastApply||null,instantMetric:RWARenkoTV.state.atrInstantMetric||null,
  warmContext:RWARenkoATRInstant.warmContext,currentContext:RWARenkoATRInstant.contextKey(),liveStats:{...RWARenkoATRInstant.liveStats},stableStats:{...RWARenkoStableChart.stats},
  exactEntry:(()=>{const e=RWARenkoATRInstant.entryFor(RWARenkoTV.settings.atrLength);return e?{length:e.length,box:e.box,rawAtr:e.rawAtr,revision:e.revision,sourceCount:e.sourceCount}:null})()
}))}

await warmExact();
const sourceProfile=await page.evaluate(()=>({interval:RWARenkoTV.settings.interval,source:RWARenkoTV.settings.source,fixed:RWARenkoTV.state.fixedSourceProfile===true,noTimeframeControls:!document.querySelector('#intervalSelect')&&!document.querySelector('#sourceSelect'),stableLayer:RWARenkoStableChart.version,deepCache:RWARenkoATRInstant.version,modePill:document.querySelector('#modePill')?.textContent}));
const results=[];let failure=null;
for(const length of VALUES){
  let passed=null,lastError=null;
  for(let attempt=1;attempt<=12&&!passed;attempt++){
    const preparedContext=await warmExact();
    await page.fill('#atrLength',String(length));
    if(await page.evaluate(()=>RWARenkoATRInstant.contextKey())!==preparedContext)continue;
    const started=Date.now();await page.click('[data-apply-method="atr"]');
    try{
      await page.waitForFunction(({n,ctx})=>RWARenkoATRInstant.contextKey()===ctx&&RWARenkoATRInstant.warmContext===ctx&&RWARenkoTV.settings.interval==='1s'&&RWARenkoTV.settings.source==='close'&&RWARenkoTV.settings.atrLength===n&&RWARenkoTV.state.atrLastApply?.length===n&&RWARenkoTV.state.atrHistorySatisfied===true&&(RWARenkoTV.state.atrHistorySourceCount||0)>=n&&RWARenkoTV.state.atrInstantMetric?.length===n&&document.documentElement.dataset.atrInstantCacheHit==='true'&&document.documentElement.dataset.atrBlockingMs==='0',{n:length,ctx:preparedContext},{timeout:12000});
      const snap=await snapshot();if(snap.currentContext!==preparedContext||snap.warmContext!==preparedContext||!snap.exactEntry)continue;
      passed={...snap,wallMs:Date.now()-started,preparedContext,attempt};
    }catch(e){lastError=e;if(await page.evaluate(()=>RWARenkoATRInstant.contextKey())!==preparedContext)continue;break}
  }
  if(!passed){failure={length,error:String(lastError?.message||lastError||'exact-current-revision 0ms assertion failed'),state:await snapshot()};await page.screenshot({path:path.join(OUT,`FAILED-atr-${length}.png`),fullPage:true});break}
  results.push(passed);await page.screenshot({path:path.join(OUT,`atr-${length}-0ms-blocking.png`),fullPage:true});
}

let livePersistence=null;
if(!failure&&results.length===VALUES.length){
  const before=await snapshot(),startRev=before.latestClosed;
  await page.waitForFunction(r=>Number(RWARenkoTV.state.closedBars.at(-1)?.closeTime)>Number(r),startRev,{timeout:12000});
  await page.waitForFunction(()=>RWARenkoATRInstant.contextKey()===RWARenkoATRInstant.warmContext&&!!RWARenkoATRInstant.entryFor(1000000),null,{timeout:12000});
  await page.waitForTimeout(1800);
  await page.waitForFunction(()=>RWARenkoATRInstant.contextKey()===RWARenkoATRInstant.warmContext&&!!RWARenkoATRInstant.entryFor(1000000),null,{timeout:12000});
  const after=await snapshot();
  const heartbeatPass=after.stableStats.dataWritesSkipped>before.stableStats.dataWritesSkipped&&after.stableStats.rangeWritesSkipped>=before.stableStats.rangeWritesSkipped&&(after.stableStats.partialEvents===before.stableStats.partialEvents||after.stableStats.partialSuppressed>before.stableStats.partialSuppressed);
  const exactLivePass=after.atrLength===1000000&&after.interval==='1s'&&after.source==='close'&&after.historySatisfied&&after.sourceBars>=1000000&&after.exactEntry&&Math.abs(Number(after.box)-Number(after.exactEntry.box))<1e-12&&after.liveStats.fallbackPrevented>=before.liveStats.fallbackPrevented&&heartbeatPass;
  livePersistence={before,after,heartbeatPass,exactLivePass};
  await page.screenshot({path:path.join(OUT,'atr-1000000-live-stable-after-source-closes.png'),fullPage:true});
  if(!exactLivePass)failure={length:1000000,error:'deep ATR did not remain exact/stable across live 1s closes',state:after};
}
const sourcePass=sourceProfile.interval==='1s'&&sourceProfile.source==='close'&&sourceProfile.fixed&&sourceProfile.noTimeframeControls&&sourceProfile.stableLayer==='1.0.0'&&sourceProfile.deepCache==='2.1.0';
const pass=!failure&&errors.length===0&&sourcePass&&results.length===VALUES.length&&results.every((x,i)=>x.cacheHit&&x.blockingMs===0&&x.atrLength===VALUES[i]&&x.lastApply?.length===VALUES[i]&&x.interval==='1s'&&x.source==='close'&&x.fixedSource&&x.noTimeframeControls&&x.historySatisfied&&x.sourceBars>=VALUES[i]&&x.exactEntry?.length===VALUES[i]&&Math.abs(Number(x.box)-Number(x.exactEntry.box))<1e-12&&x.warmContext===x.currentContext&&x.currentContext===x.preparedContext)&&livePersistence?.exactLivePass===true;
const report={url:page.url(),values:VALUES,sourceProfile,results,livePersistence,failure,errors,pass,note:'All seven ATR values use fixed Binance 1-second CLOSED-kline Close. 0 ms is measured main-thread Total Blocking Time for an exact prepared-cache switch. Live persistence additionally proves a deep ATR does not fall back to short resident history on the next 1s close, and the stable-chart layer suppresses identical chart/range writes so the chart does not heartbeat unless Renko geometry changes.'};
await fs.writeFile(path.join(OUT,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
await browser.close();if(!pass)process.exit(1);
