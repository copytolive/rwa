import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const base=(process.env.RWA_TEST_URL||'http://127.0.0.1:8080/rwa').replace(/\/$/,'');
const out=process.env.RENKO_TOTAL_HISTORY_OUT||'artifacts/renko-total-history';
const shots=path.join(out,'far-history');
fs.mkdirSync(shots,{recursive:true});

const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:1900,height:1000},deviceScaleFactor:1});
await context.addInitScript(()=>{try{localStorage.setItem('rwa_renko_tradingview_settings_v1',JSON.stringify({interval:'1s',source:'close',method:'traditional',atrLength:14,boxSize:1,percentage:.01,wicks:true}))}catch{}});

let page=null,fatal='',httpStatus=0,symbols=[],desktop=[],mobile=[],gold=null;
const pageErrors=[],consoleErrors=[],requestFailures=[];
const safe=s=>String(s).replace(/[^A-Z0-9_-]/gi,'_');
function instrument(p){
  p.on('pageerror',e=>pageErrors.push(String(e?.message||e)));
  p.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text())});
  p.on('requestfailed',r=>requestFailures.push({url:r.url(),error:r.failure()?.errorText||''}));
}
async function openFresh(viewport,tag){
  if(page&&!page.isClosed())await page.close();
  page=await context.newPage();instrument(page);await page.setViewportSize(viewport);
  const resp=await page.goto(`${base}/renko/?symbol=SOL&totalHistory50=1&mode=${encodeURIComponent(tag)}&ts=${Date.now()}`,{waitUntil:'domcontentloaded',timeout:60000});
  const status=resp?.status()||0;if(!httpStatus)httpStatus=status;
  if(status<200||status>=400)throw Error(`${tag} HTTP ${status}`);
  await page.waitForFunction(()=>RWARenkoTV?.state?.status==='live'&&RWARenkoSwitchFast?.version==='1.3.0-total-history'&&/^2\.[0-9]+\.[0-9]+-origin-chunks$/.test(RWARenkoTotalHistory?.version||'')&&RWARenkoTotalHistory?.rule?.includes('authoritative-earliest-fixed-1s-rest')&&RWARenkoScrollZeroLock?.version==='1.1.0-total-history'&&window.RWARenkoScrollBlocking?.stats?.supported===true&&document.querySelectorAll('.pair-row[data-symbol]').length>=50,null,{timeout:90000});
  return page;
}
async function waitLive(s){await page.waitForFunction(x=>RWARenkoTV?.state?.symbol===x&&RWARenkoTV?.state?.status==='live'&&document.documentElement.dataset.pairSwitching!=='true',s,{timeout:45000})}
async function switchTo(s){
  const a=await page.evaluate(s=>{const same=RWARenkoTV.state.symbol===s&&RWARenkoTV.state.status==='live';if(same)return{same:true,firstFrameMs:0};void RWARenkoSwitchFast.load(s,{fit:true});return{same:false,firstFrameMs:Number(document.documentElement.dataset.pairSwitchFirstFrameMs)||0}},s);
  await waitLive(s);return a
}
async function origin(s){return await page.evaluate(async s=>{const m=await RWARenkoTotalHistory.jumpOrigin(s);return{meta:m,state:{symbol:RWARenkoTV.state.symbol,status:RWARenkoTV.state.status,bars:RWARenkoTV.state.closedBars.length,total:Number(RWARenkoTV.state.confirmedTotal??RWARenkoTV.state.confirmed?.length??0),rendered:Number(RWARenkoTV.state.confirmed?.length||0),visible:Number(String(document.getElementById('brickCount')?.textContent||'0').replace(/[^0-9]/g,''))||0,box:Number(RWARenkoTV.state.box),coverage:document.getElementById('tvCoverage')?.textContent||'',canvas:document.querySelectorAll('#chartHost canvas').length,empty:getComputedStyle(document.getElementById('chartEmpty')).display}}},s)}
async function wheelGate(){
  const b=await page.locator('#chartHost').boundingBox();if(!b)throw Error('no chart box');
  await page.mouse.move(b.x+b.width*.55,b.y+b.height*.55);
  const before=await page.evaluate(()=>({losses:RWARenkoSwitchFast.scrollStats.losses,events:RWARenkoSwitchFast.scrollStats.events}));
  await page.mouse.wheel(700,0);await page.waitForTimeout(60);await page.mouse.wheel(-700,0);await page.waitForTimeout(140);
  return await page.evaluate(before=>({eventsAdded:RWARenkoSwitchFast.scrollStats.events-before.events,lossesAdded:RWARenkoSwitchFast.scrollStats.losses-before.losses,maxAckMs:RWARenkoSwitchFast.scrollStats.maxAckMs,lastAckMs:RWARenkoSwitchFast.scrollStats.lastAckMs,stable:document.documentElement.dataset.renkoScrollHistoryStable,blockingMs:Number(window.RWARenkoScrollBlocking?.stats?.maxBlockingMs||document.documentElement.dataset.renkoScrollBlockingMs||0),blockingSupported:!!window.RWARenkoScrollBlocking?.stats?.supported}),before)
}
async function runMode(name,capture){
  const rows=[];
  for(let i=0;i<symbols.length;i++){
    const s=symbols[i],sw=await switchTo(s),o=await origin(s);
    for(let z=0;z<5;z++)await page.locator('#tvZoomOut').click();
    const w=await wheelGate(),meta=o.meta,st=o.state;
    const countOk=st.total===0?(st.rendered===0&&st.visible===0):(st.total>=st.rendered&&st.visible===st.total);
    const pass=st.symbol===s&&st.status==='history-origin'&&st.bars>=900&&meta?.provider==='Binance Spot'&&meta?.interval==='1s'&&Number(meta?.earliestAvailableMs)>0&&Number(meta?.latestAvailableMs)>=Number(meta?.earliestAvailableMs)&&Number(meta?.coverageDays)>0&&Number(meta?.loadedChunkCount)===1&&Number(meta?.totalSourceChunks)>=1&&meta?.cachePersisted===true&&String(meta?.integrityChecksum||'').length>20&&st.canvas>0&&(st.total===0||st.empty==='none')&&countOk&&w.eventsAdded>=2&&w.lossesAdded===0&&w.stable==='true'&&w.maxAckMs<=1&&w.blockingSupported===true&&w.blockingMs===0&&(sw.same||sw.firstFrameMs<=1);
    let screenshot='';if(capture){screenshot=`${name}-${String(i+1).padStart(2,'0')}-${safe(s)}.png`;await page.screenshot({path:path.join(shots,screenshot),fullPage:true})}
    rows.push({index:i+1,symbol:s,switch:sw,history:meta,state:st,wheel:w,screenshot,pass});
  }
  return rows
}

try{
  await openFresh({width:1900,height:1000},'desktop');
  symbols=await page.evaluate(()=>[...(RWARenkoTV.launchPairs||[])]);if(symbols.length!==50)throw Error(`Expected 50 pairs got ${symbols.length}`);
  desktop=await runMode('desktop',true);

  // Fresh Chromium page, same BrowserContext: chart internals are reset, but IndexedDB persists.
  // This makes the mobile pass a real persistent origin-cache revisit rather than an in-memory reuse.
  await openFresh({width:430,height:932},'mobile');
  const mobileSymbols=await page.evaluate(()=>[...(RWARenkoTV.launchPairs||[])]);if(JSON.stringify(mobileSymbols)!==JSON.stringify(symbols))throw Error('mobile launch-pair set drift');
  mobile=await runMode('mobile',true);
  const desktopBySymbol=new Map(desktop.map(r=>[r.symbol,r]));
  for(const r of mobile){const d=desktopBySymbol.get(r.symbol);const continuity=!!d&&r.history?.cacheHit===true&&Number(r.history?.earliestAvailableMs)===Number(d.history?.earliestAvailableMs)&&Number(r.history?.loadedOldestMs)===Number(d.history?.loadedOldestMs)&&Number(r.state?.bars)>=Number(d.state?.bars);r.revisitContinuity={cacheHit:r.history?.cacheHit===true,earliestSame:!!d&&Number(r.history?.earliestAvailableMs)===Number(d.history?.earliestAvailableMs),loadedOldestSame:!!d&&Number(r.history?.loadedOldestMs)===Number(d.history?.loadedOldestMs),barsNotLost:!!d&&Number(r.state?.bars)>=Number(d.state?.bars),pass:continuity};r.pass=!!r.pass&&continuity}

  await openFresh({width:1900,height:1000},'gold');
  const g=await page.evaluate(async()=>{const m=await RWARenkoTotalHistory.jumpOrigin('XAUUSD');return{meta:m,state:{symbol:RWARenkoTV.state.symbol,status:RWARenkoTV.state.status,bars:RWARenkoTV.state.closedBars.length,total:Number(RWARenkoTV.state.confirmedTotal??RWARenkoTV.state.confirmed?.length??0),rendered:Number(RWARenkoTV.state.confirmed?.length||0),coverage:document.getElementById('tvCoverage')?.textContent||'',canvas:document.querySelectorAll('#chartHost canvas').length,empty:getComputedStyle(document.getElementById('chartEmpty')).display}}});
  const gw=await wheelGate();await page.screenshot({path:path.join(shots,'gold-xauusd-origin-2003.png'),fullPage:true});
  const years=(Date.now()-Number(g.meta?.earliestAvailableMs||0))/(365.2425*86400000);
  gold={...g,wheel:gw,coverageYears:years,screenshot:'gold-xauusd-origin-2003.png',pass:g.state.symbol==='XAUUSD'&&g.state.status==='history-origin'&&g.meta?.provider==='Dukascopy'&&g.meta?.instrumentCode==='XAU-USD'&&g.meta?.interval==='1s'&&Number(g.meta?.documentedEarliestS1Ms)===Date.UTC(2003,4,5,0,1,3,421)&&Number(g.meta?.earliestAvailableMs)<=Date.UTC(2003,4,5,0,5)&&years>=23&&Number(g.meta?.totalSourceChunks)>=1&&g.state.bars>100&&g.state.canvas>0&&(g.state.total===0||g.state.empty==='none')&&gw.maxAckMs<=1&&gw.blockingSupported===true&&gw.blockingMs===0&&gw.lossesAdded===0};
}catch(e){fatal=String(e?.stack||e)}

const all=[...desktop,...mobile];
const summary={pairs:symbols.length,desktopPass:desktop.filter(x=>x.pass).length,mobilePass:mobile.filter(x=>x.pass).length,revisitContinuityPass:mobile.filter(x=>x.revisitContinuity?.pass).length,screenshotCount:fs.existsSync(shots)?fs.readdirSync(shots).filter(x=>x.endsWith('.png')).length:0,firstFrameMaxMs:Math.max(0,...all.map(x=>Number(x.switch?.firstFrameMs)||0)),scrollAckMaxMs:Math.max(0,...all.map(x=>Number(x.wheel?.maxAckMs)||0),Number(gold?.wheel?.maxAckMs)||0),scrollBlockingMeasured:all.length===100&&all.every(x=>x.wheel?.blockingSupported===true)&&gold?.wheel?.blockingSupported===true,scrollBlockingMaxMs:Math.max(0,...all.map(x=>Number(x.wheel?.blockingMs)||0),Number(gold?.wheel?.blockingMs)||0),scrollLosses:all.reduce((a,x)=>a+(Number(x.wheel?.lossesAdded)||0),0)+(Number(gold?.wheel?.lossesAdded)||0),goldPass:!!gold?.pass,goldCoverageYears:Number(gold?.coverageYears)||0};
const criticalConsole=consoleErrors.filter(x=>!/favicon|WebSocket connection .* failed|ERR_FAILED|Failed to load resource|Ping received after close/i.test(x));
const criticalRequests=requestFailures.filter(x=>/\/renko\/|data-api\.binance\.vision|data\.binance\.vision|jetta\.dukascopy\.com/i.test(x.url)&&!/ERR_ABORTED/.test(x.error));
const status=!fatal&&httpStatus>=200&&httpStatus<400&&symbols.length===50&&desktop.length===50&&desktop.every(x=>x.pass)&&mobile.length===50&&mobile.every(x=>x.pass)&&summary.revisitContinuityPass===50&&gold?.pass&&summary.screenshotCount>=101&&summary.firstFrameMaxMs<=1&&summary.scrollAckMaxMs<=1&&summary.scrollBlockingMeasured===true&&summary.scrollBlockingMaxMs===0&&summary.scrollLosses===0&&!pageErrors.length&&!criticalConsole.length&&!criticalRequests.length?'PASS':'FAIL';
const report={schema:'renko-total-available-history-v2.3',generatedAt:new Date().toISOString(),base,httpStatus,status,contract:'50 Binance Spot launch pairs expose official fixed-1s total available origin coverage through earliest-row discovery, archive checksum integrity, and bounded persistent origin windows. Desktop and mobile run in fresh Chromium pages within one BrowserContext, so mobile proves IndexedDB persistence across page recreation plus switch-away/back origin continuity. XAUUSD uses Dukascopy XAU-USD public ticks aggregated to S1 from 2003-05-05. Wheel ACK <=1ms with PerformanceObserver long-task blocking measured at 0ms.',summary,pageErrors,consoleErrors:criticalConsole,requestFailures:criticalRequests,fatal,symbols,desktop,mobile,gold};
fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));
console.log('RENKO_TOTAL_HISTORY '+JSON.stringify({status,summary,fatal,desktopFailed:desktop.filter(x=>!x.pass).map(x=>x.symbol),mobileFailed:mobile.filter(x=>!x.pass).map(x=>x.symbol),gold:gold&&{pass:gold.pass,years:gold.coverageYears,earliest:gold.meta?.earliestAvailableMs}}));
if(page&&!page.isClosed())await page.close();await context.close();await browser.close();if(status!=='PASS')process.exit(2);
