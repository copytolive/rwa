import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { chromium, devices } from 'playwright';

const baseUrl=process.env.RENKO_BASE_URL||'http://127.0.0.1:4173/renko/';
const expectedSha=process.env.RENKO_EXPECTED_SHA||process.env.GITHUB_SHA||'';
const cycles=Number(process.env.RENKO_CYCLES||10);
const mobile=process.env.RENKO_MOBILE==='1';
const outDir=process.env.RENKO_OUTPUT_DIR||'artifacts/renko-scroll-prepend';
const label=mobile?'mobile':'desktop';
await fs.mkdir(outDir,{recursive:true});

const browser=await chromium.launch({headless:true});
const context=await browser.newContext(mobile?{...devices['iPhone 13']}:{viewport:{width:1672,height:941}});
const page=await context.newPage();
const pageErrors=[];page.on('pageerror',e=>pageErrors.push(String(e)));
const consoleErrors=[];page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text())});
const wait=(fn,arg=null,timeout=120000)=>page.waitForFunction(fn,arg,{timeout});
const url=new URL(baseUrl);url.searchParams.set('gold','1');url.searchParams.set('scrollPrependProof','1');url.searchParams.set('cb',String(Date.now()));
await page.goto(url.toString(),{waitUntil:'domcontentloaded',timeout:120000});
try{
  await wait(()=>document.querySelector('#chartHost canvas')&&window.RWARenkoTV?.state?.symbol==='XAUUSD'&&window.RWARenkoGoldTotalHistory&&window.RWARenkoGoldManualViewport&&document.documentElement.dataset.renkoGoldRecent==='true',null,120000);
}catch(e){
  const diag=await page.evaluate(()=>({readyState:document.readyState,goldOnly:window.RENKO_GOLD_ONLY,recent:document.documentElement.dataset.renkoGoldRecent,symbol:window.RWARenkoTV?.state?.symbol,status:window.RWARenkoTV?.state?.status,bars:window.RWARenkoTV?.state?.closedBars?.length,total:!!window.RWARenkoGoldTotalHistory,manual:!!window.RWARenkoGoldManualViewport,canvas:!!document.querySelector('#chartHost canvas'),bodyText:document.body?.innerText?.slice(0,1000)})).catch(()=>({evaluateFailed:true}));
  await page.screenshot({path:path.join(outDir,`RENKO_GOLD_SCROLL_${label}_READINESS_FAILURE.png`),fullPage:true}).catch(()=>{});
  await fs.writeFile(path.join(outDir,`RENKO_GOLD_SCROLL_${label}_readiness.json`),JSON.stringify({diag,pageErrors,consoleErrors},null,2));
  throw new Error(`RENKO readiness timeout: ${JSON.stringify(diag)} :: ${e}`);
}
await page.evaluate(()=>window.RWARenkoGoldTotalHistory.loadManifest(true));

if(expectedSha&&baseUrl.startsWith('https://copytolive.github.io/')){
  const got=(await (await fetch(new URL('deployment-sha.txt?proof=1',baseUrl))).text()).trim();
  if(!/^[0-9a-f]{40}$/.test(got)||got!==expectedSha)throw new Error(`public SHA mismatch ${got} != ${expectedSha}`);
}

const manifest=await page.evaluate(()=>({dataVersion:RWARenkoGoldTotalHistory.manifest?.dataVersion,versionSha256:RWARenkoGoldTotalHistory.manifest?.versionSha256,months:RWARenkoGoldTotalHistory.manifest?.months?.length,provider:RWARenkoGoldTotalHistory.manifest?.provider,instrument:RWARenkoGoldTotalHistory.manifest?.instrumentCode,side:RWARenkoGoldTotalHistory.manifest?.priceSide,interval:RWARenkoGoldTotalHistory.manifest?.interval}));
if(manifest.dataVersion!=='dukascopy-xauusd-s1-f25a24e5d7994131'||manifest.versionSha256!=='f25a24e5d7994131ada7b69c237d355794e73e86d642d4630307035b8417790f'||manifest.months!==281||manifest.provider!=='Dukascopy'||manifest.instrument!=='XAU-USD'||manifest.side!=='bid'||manifest.interval!=='1s')throw new Error('canonical GOLD identity drift '+JSON.stringify(manifest));

await page.evaluate(()=>{
  const ts=window.__RWARenkoChart?.timeScale?.();window.__RENKO_SCROLL_FIT_CALLS=0;window.__RENKO_SCROLL_FIT_PATCHED=false;
  if(ts?.fitContent){
    try{const original=ts.fitContent.bind(ts);ts.fitContent=(...args)=>{window.__RENKO_SCROLL_FIT_CALLS++;return original(...args)};window.__RENKO_SCROLL_FIT_PATCHED=true}catch(_){ }
  }
});

async function state(){return page.evaluate(()=>{const H=RWARenkoGoldTotalHistory,M=RWARenkoGoldManualViewport,T=RWARenkoTV,ts=__RWARenkoChart.timeScale(),o=ts.options?.()||{};return{prepends:H.stats.prepends,busy:H.busy,oldest:Math.floor(T.state.closedBars[0].openTime/1000),newest:Math.floor(T.state.closedBars.at(-1).closeTime/1000),bars:T.state.closedBars.length,decoded:H.stats.decodedMonths,workerBuilds:H.stats.workerBuilds,workerBuildFailures:H.stats.workerBuildFailures,logical:ts.getVisibleLogicalRange?.()||null,time:ts.getVisibleRange?.()||null,barSpacing:Number(o.barSpacing),rightOffset:Number(o.rightOffset),scrollPosition:Number(ts.scrollPosition?.()),wheelEvents:M.stats.wheelEvents,locked:M.locked,following:T.state.following,last:H.stats.lastPrepend,transactions:H.stats.prependTransactions.slice(),manual:M.stats,fitCalls:Number(window.__RENKO_SCROLL_FIT_CALLS||0),fitPatched:!!window.__RENKO_SCROLL_FIT_PATCHED};});}
async function overlay(stage){
  const s=await state();const tx=s.last;const lines=[
    `RENKO GOLD SCROLL PREPEND ${stage}`,
    `SHA ${expectedSha||'branch-local'}`,
    `cycles ${s.prepends}/${cycles}  oldest ${s.oldest}  sourceBars ${s.bars}  decoded ${s.decoded}`,
    `barSpacing ${s.barSpacing}  rightOffset ${s.rightOffset}  following ${s.following}`,
    tx?`last TBT ${tx.tbtMs} ms  spanΔ ${tx.viewport?.timeSpanDeltaPct ?? 'n/a'}%  barΔ ${tx.viewport?.barSpacingDelta ?? 'n/a'}  rightΔ ${tx.viewport?.rightOffsetDelta ?? 'n/a'}  fromΔ ${tx.viewport?.fromDelta ?? 'n/a'}  toΔ ${tx.viewport?.toDelta ?? 'n/a'}`:'last prepend —',
    `fitContent calls after baseline ${s.fitCalls}`,
    'PASS target: 0 TBT / no viewport drift / no fit / bounded memory'
  ];
  await page.evaluate(({lines,stage})=>{let el=document.getElementById('__renkoScrollProof');if(!el){el=document.createElement('pre');el.id='__renkoScrollProof';Object.assign(el.style,{position:'fixed',left:'12px',top:'12px',zIndex:'2147483647',margin:'0',padding:'10px 12px',background:'rgba(0,0,0,.88)',color:'#fff',font:'12px/1.45 monospace',border:'1px solid #7cffb2',borderRadius:'6px',pointerEvents:'none',maxWidth:'92vw',whiteSpace:'pre-wrap'});document.body.appendChild(el)}el.textContent=lines.join('\n');el.dataset.stage=stage;},{lines,stage});
}
async function shot(stage){await overlay(stage);await page.screenshot({path:path.join(outDir,`RENKO_GOLD_SCROLL_${label}_${stage}.png`),fullPage:true});}

await shot('BEFORE');
const box=await page.locator('#chartHost').boundingBox();if(!box)throw new Error('chartHost has no bounding box');
await page.mouse.move(box.x+box.width*.55,box.y+box.height*.45);

const candidates=[[0,3200],[0,-3200],[3200,0],[-3200,0]];let vector=null,best=0;
for(const [dx,dy] of candidates){
  const a=(await state()).logical?.from;await page.mouse.wheel(dx,dy);await page.waitForTimeout(180);const b=(await state()).logical?.from;
  if(Number.isFinite(a)&&Number.isFinite(b)&&b-a<best){best=b-a;vector=[dx,dy]}
}
if(!vector)throw new Error('real wheel did not move viewport toward older history');

const startPrepends=(await state()).prepends;
const rows=[];
for(let cycle=1;cycle<=cycles;cycle++){
  const target=startPrepends+cycle;let triggered=false;
  for(let n=0;n<220;n++){
    const s=await state();
    if(s.prepends>=target){triggered=true;break}
    if(s.busy){await page.waitForTimeout(80);continue}
    await page.mouse.wheel(vector[0]*3,vector[1]*3);
    await page.waitForTimeout(32);
  }
  if(!triggered){await page.waitForTimeout(250);triggered=(await state()).prepends>=target}
  if(!triggered)throw new Error(`real scroll-left failed to trigger prepend cycle ${cycle}: ${JSON.stringify(await state())}`);
  await wait(n=>!RWARenkoGoldTotalHistory.busy&&RWARenkoGoldTotalHistory.stats.prepends>=n,target,180000);
  await page.waitForTimeout(180);
  const s=await state(),tx=s.last;
  console.log('RENKO_GOLD_SCROLL_CYCLE_METRICS',JSON.stringify({cycle,tx,current:{time:s.time,logical:s.logical,barSpacing:s.barSpacing,rightOffset:s.rightOffset,scrollPosition:s.scrollPosition,following:s.following,workerBuilds:s.workerBuilds,workerBuildFailures:s.workerBuildFailures}}));
  if(!tx||tx.index!==target)throw new Error(`missing transaction ${cycle}`);
  if(tx.panOlder!==false)throw new Error(`auto prepend unexpectedly panned viewport cycle ${cycle}`);
  if(!(tx.oldestAfter<tx.oldestBefore))throw new Error(`oldest did not decrease cycle ${cycle}: ${tx.oldestBefore} -> ${tx.oldestAfter}`);
  if(tx.sourceBars>140000||s.bars>140000)throw new Error(`source memory cap exceeded cycle ${cycle}`);
  if(tx.decodedMonths>2||s.decoded>2)throw new Error(`decoded LRU cap exceeded cycle ${cycle}`);
  if(Number(tx.tbtMs)!==0)throw new Error(`TBT drift cycle ${cycle}: ${tx.tbtMs}`);
  if(Number(tx.preparedBuildCalls)!==1||s.workerBuilds<cycle||s.workerBuildFailures!==0)throw new Error(`worker/prepared rebuild contract failed cycle ${cycle}: ${JSON.stringify({preparedBuildCalls:tx.preparedBuildCalls,workerBuilds:s.workerBuilds,workerBuildFailures:s.workerBuildFailures})}`);
  if(s.fitCalls!==0)throw new Error(`fitContent called during prepend cycle ${cycle}: ${s.fitCalls}`);
  const v=tx.viewport||{};
  if(v.barSpacingDelta!=null&&Number(v.barSpacingDelta)>1e-9)throw new Error(`barSpacing drift cycle ${cycle}: ${v.barSpacingDelta}`);
  if(v.rightOffsetDelta!=null&&Number(v.rightOffsetDelta)>1e-9)throw new Error(`rightOffset drift cycle ${cycle}: ${v.rightOffsetDelta}`);
  if(v.timeSpanDeltaPct!=null&&Number(v.timeSpanDeltaPct)>0.01)throw new Error(`time span drift cycle ${cycle}: ${v.timeSpanDeltaPct}%`);
  if(v.fromDelta!=null&&Number(v.fromDelta)>1)throw new Error(`visible from drift cycle ${cycle}: ${v.fromDelta}s`);
  if(v.toDelta!=null&&Number(v.toDelta)>1)throw new Error(`visible to drift cycle ${cycle}: ${v.toDelta}s`);
  if(v.anchorDelta!=null&&Number(v.anchorDelta)>1)throw new Error(`time anchor drift cycle ${cycle}: ${v.anchorDelta}s`);
  if(s.following!==false)throw new Error(`following re-enabled during manual history cycle ${cycle}`);
  rows.push({cycle,oldestBefore:tx.oldestBefore,oldestAfter:tx.oldestAfter,tbtMs:tx.tbtMs,maxLongTaskMs:tx.maxLongTaskMs,workerBuildMs:tx.workerBuildMs,renderMs:tx.renderMs,preparedBuildCalls:tx.preparedBuildCalls,sourceBars:tx.sourceBars,decodedMonths:tx.decodedMonths,fitCalls:s.fitCalls,barSpacingDelta:v.barSpacingDelta,rightOffsetDelta:v.rightOffsetDelta,timeSpanDeltaPct:v.timeSpanDeltaPct,fromDelta:v.fromDelta,toDelta:v.toDelta,anchorDelta:v.anchorDelta});
  if(cycle===Math.ceil(cycles/2))await shot('MID');
}
await shot('AFTER');

const final=await state();
if(final.wheelEvents<cycles)throw new Error(`insufficient real-user wheel evidence ${final.wheelEvents}/${cycles}`);
if(final.fitCalls!==0)throw new Error(`fitContent called after baseline: ${final.fitCalls}`);
for(let i=1;i<rows.length;i++)if(!(rows[i].oldestAfter<rows[i-1].oldestAfter))throw new Error(`oldest monotonicity failed ${i}`);
const monotonic=await page.evaluate(()=>{const b=RWARenkoTV.state.closedBars;for(let i=1;i<b.length;i++)if(Number(b[i].openTime)<=Number(b[i-1].openTime))return false;return true});
if(!monotonic)throw new Error('loaded source bars duplicate/non-monotonic');

await page.fill('#traditionalBox','1');await page.click('[data-apply-method="traditional"]');
await wait(()=>RWARenkoTV?.settings?.method==='traditional'&&Number(RWARenkoTV?.state?.box)>0,null,60000);
await page.fill('#atrLength','14');await page.click('[data-apply-method="atr"]');
await wait(()=>RWARenkoTV?.settings?.method==='atr'&&Number(RWARenkoTV?.state?.box)>0,null,60000);
const methods=await page.evaluate(()=>({method:RWARenkoTV.settings.method,box:Number(RWARenkoTV.state.box),atrLength:Number(RWARenkoTV.settings.atrLength),symbol:RWARenkoTV.state.symbol,interval:RWARenkoTV.settings.interval}));
if(methods.method!=='atr'||!(methods.box>0)||methods.atrLength!==14||methods.symbol!=='XAUUSD'||methods.interval!=='1s')throw new Error('ATR/Traditional regression '+JSON.stringify(methods));
if(pageErrors.length)throw new Error('page errors '+JSON.stringify(pageErrors));

const report={token:'RENKO_GOLD_SCROLL_PREPEND_ZERO_TBT_NO_DRIFT_PASS',label,sha:expectedSha||null,baseUrl,cycles,manifest,vector,rows,final:{oldest:final.oldest,newest:final.newest,bars:final.bars,decoded:final.decoded,wheelEvents:final.wheelEvents,fitCalls:final.fitCalls,fitPatched:final.fitPatched,workerBuilds:final.workerBuilds,workerBuildFailures:final.workerBuildFailures,manualHistoryMutations:final.manual.historyMutations,manualHistoryCorrections:final.manual.historyCorrections,suppressedRangeChanges:final.manual.suppressedRangeChanges},methods,consoleErrors:consoleErrors.slice(-20)};
await fs.writeFile(path.join(outDir,`RENKO_GOLD_SCROLL_${label}_report.json`),JSON.stringify(report,null,2));
console.log(report.token,JSON.stringify(report));
await browser.close();