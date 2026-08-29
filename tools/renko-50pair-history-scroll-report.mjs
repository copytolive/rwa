import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const base=(process.env.RWA_TEST_URL||'http://127.0.0.1:8080/rwa').replace(/\/$/,'');
const out=process.env.RENKO_HISTORY_SCROLL_OUT||'artifacts/renko-50pair-history-scroll';
const viewport={width:1900,height:1000};
const shots=path.join(out,'settled-far-scroll');
fs.mkdirSync(shots,{recursive:true});
const safe=s=>String(s).replace(/[^A-Z0-9_-]/gi,'_');
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport,deviceScaleFactor:1});
const page=await context.newPage();
const pageErrors=[],consoleErrors=[],requestFailures=[];
page.on('pageerror',e=>pageErrors.push(String(e?.message||e)));
page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text())});
page.on('requestfailed',r=>requestFailures.push({url:r.url(),error:r.failure()?.errorText||''}));
await page.addInitScript(()=>{try{localStorage.setItem('rwa_renko_tradingview_settings_v1',JSON.stringify({interval:'1s',source:'close',method:'traditional',atrLength:14,boxSize:1,percentage:.01,wicks:true}))}catch{}});

let httpStatus=0,fatal='',symbols=[],rows=[],revisits=[];
async function waitLive(symbol,timeout=20000){await page.waitForFunction(s=>window.RWARenkoTV?.state?.symbol===s&&window.RWARenkoTV?.state?.status==='live'&&document.documentElement.dataset.pairSwitching!=='true',symbol,{timeout})}
async function switchTo(symbol){
  const first=await page.evaluate(symbol=>{const same=RWARenkoTV.state.symbol===symbol&&RWARenkoTV.state.status==='live';if(same)return{same:true,firstFrameMs:0};void RWARenkoSwitchFast.load(symbol,{fit:true});return{same:false,firstFrameMs:Number(document.documentElement.dataset.pairSwitchFirstFrameMs)||0,target:document.documentElement.dataset.pairSwitchTarget,switching:document.documentElement.dataset.pairSwitching}},symbol);
  await waitLive(symbol);
  await page.waitForTimeout(50);
  return first;
}
async function ensureVisibleHistory(){
  return await page.evaluate(async()=>{
    const T=RWARenkoTV,C=RWARenkoTraditionalControl;
    C.prepareSymbol('history-scroll-proof');
    let olderLoads=0;
    const beforeBars=T.state.closedBars.length;
    let rendered=Number(T.state.confirmed?.length)||0,total=Number(T.state.confirmedTotal);if(!Number.isFinite(total))total=rendered;
    for(let i=0;i<4;i++){
      if(i===0||rendered===0){const ok=await T.loadOlderPage();if(ok)olderLoads++;}
      if(rendered===0){C.activate(Number(T.state.tickSize),'proof-min-tick',false,false);rendered=Number(T.state.confirmed?.length)||0;total=Number(T.state.confirmedTotal);if(!Number.isFinite(total))total=rendered;}
      if(i>0&&rendered>0)break;
    }
    C.prepareSymbol('history-scroll-proof-final');
    RWARenkoSwitchFast.snapshotCurrent('proof-deep-history');
    rendered=Number(T.state.confirmed?.length)||0;total=Number(T.state.confirmedTotal);if(!Number.isFinite(total))total=rendered;
    return{beforeBars,afterBars:T.state.closedBars.length,historyPages:Number(T.state.historyPages)||0,olderLoads,rendered,total,tick:Number(T.state.tickSize),box:Number(T.state.box),last:Number(T.state.lastPrice),traditional:C.resolve(T)};
  });
}
async function farZoomAndScroll(){
  for(let i=0;i<7;i++)await page.locator('#tvZoomOut').click();
  const box=await page.locator('#chartHost').boundingBox();if(!box)throw new Error('chartHost has no bounding box');
  await page.mouse.move(box.x+box.width*.55,box.y+box.height*.55);
  const before=await page.evaluate(()=>({events:RWARenkoSwitchFast.scrollStats.events,losses:RWARenkoSwitchFast.scrollStats.losses,maxAckMs:RWARenkoSwitchFast.scrollStats.maxAckMs,bars:RWARenkoTV.state.closedBars.length,total:Number(RWARenkoTV.state.confirmedTotal)||Number(RWARenkoTV.state.confirmed?.length)||0}));
  await page.mouse.wheel(900,0);await page.waitForTimeout(45);await page.mouse.wheel(-900,0);await page.waitForTimeout(100);
  const after=await page.evaluate(()=>({events:RWARenkoSwitchFast.scrollStats.events,losses:RWARenkoSwitchFast.scrollStats.losses,lastAckMs:RWARenkoSwitchFast.scrollStats.lastAckMs,maxAckMs:RWARenkoSwitchFast.scrollStats.maxAckMs,stable:document.documentElement.dataset.renkoScrollHistoryStable,bars:RWARenkoTV.state.closedBars.length,total:Number(RWARenkoTV.state.confirmedTotal)||Number(RWARenkoTV.state.confirmed?.length)||0,rendered:Number(RWARenkoTV.state.confirmed?.length)||0,visible:Number(String(document.getElementById('brickCount')?.textContent||'0').replace(/[^0-9]/g,''))||0,canvas:document.querySelectorAll('#chartHost canvas').length,empty:getComputedStyle(document.getElementById('chartEmpty')).display,coverage:document.getElementById('tvCoverage')?.textContent||''}));
  return{before,after,zoomOutClicks:7,scrollEventsAdded:after.events-before.events,lossesAdded:after.losses-before.losses};
}

try{
  const response=await page.goto(`${base}/renko/?symbol=SOL&historyScroll50=1&ts=${Date.now()}`,{waitUntil:'domcontentloaded',timeout:60000});httpStatus=response?.status()||0;
  await page.waitForFunction(()=>window.RWARenkoTV?.state?.status==='live'&&window.RWARenkoSwitchFast?.version==='1.2.0-history-scroll'&&window.RWARenkoTraditionalControl?.version&&document.querySelectorAll('.pair-row[data-symbol]').length>=50,null,{timeout:90000});
  symbols=await page.evaluate(()=>[...(RWARenkoTV.launchPairs||[])]);if(symbols.length!==50)throw new Error(`Expected 50 launch pairs, got ${symbols.length}`);
  for(let i=0;i<symbols.length;i++){
    const symbol=symbols[i],first=await switchTo(symbol),history=await ensureVisibleHistory(),scroll=await farZoomAndScroll();
    const state=await page.evaluate(()=>({symbol:RWARenkoTV.state.symbol,status:RWARenkoTV.state.status,cacheSize:RWARenkoSwitchFast.cacheSize,cacheVersion:RWARenkoSwitchFast.version,workerActive:!!RWARenkoATRFixed1s?.workerActive,entryCount:Number(RWARenkoATRFixed1s?.entryCount)||0,universeRequested:!!RWARenkoUltraUI?.stats?.universeRequested,pagePair:document.getElementById('pairName')?.textContent||''}));
    const screenshot=`${String(i+1).padStart(2,'0')}-${safe(symbol)}.png`;await page.screenshot({path:path.join(shots,screenshot),fullPage:true});
    const countValid=history.total===0?history.rendered===0:(history.rendered>0&&history.total>=history.rendered);
    const visibleValid=scroll.after.visible===scroll.after.total;
    const pass=state.symbol===symbol&&state.status==='live'&&history.afterBars>=900&&history.afterBars>=history.beforeBars&&history.historyPages>=1&&history.box>0&&history.last>0&&countValid&&visibleValid&&scroll.after.canvas>0&&(scroll.after.total===0||scroll.after.empty==='none')&&scroll.scrollEventsAdded>=2&&scroll.lossesAdded===0&&scroll.after.stable==='true'&&scroll.after.maxAckMs<=1&&!state.workerActive&&state.entryCount===0&&!state.universeRequested&&(first.same||first.firstFrameMs<=1);
    rows.push({index:i+1,symbol,first,history,scroll,state,screenshot,pass});
  }
  for(let i=0;i<symbols.length;i++){
    const symbol=symbols[i],expected=rows[i].history.afterBars,first=await switchTo(symbol);
    const beforeScroll=await page.evaluate(()=>({cacheHit:document.documentElement.dataset.renkoHistoryCacheHit,cacheMerged:document.documentElement.dataset.renkoHistoryCacheMerged,bars:RWARenkoTV.state.closedBars.length,total:Number(RWARenkoTV.state.confirmedTotal)||Number(RWARenkoTV.state.confirmed?.length)||0,losses:RWARenkoSwitchFast.scrollStats.losses}));
    const box=await page.locator('#chartHost').boundingBox();if(!box)throw new Error(`revisit ${symbol}: no chart box`);await page.mouse.move(box.x+box.width*.5,box.y+box.height*.5);await page.mouse.wheel(600,0);await page.waitForTimeout(90);
    const after=await page.evaluate(()=>({symbol:RWARenkoTV.state.symbol,status:RWARenkoTV.state.status,bars:RWARenkoTV.state.closedBars.length,total:Number(RWARenkoTV.state.confirmedTotal)||Number(RWARenkoTV.state.confirmed?.length)||0,lastAckMs:RWARenkoSwitchFast.scrollStats.lastAckMs,maxAckMs:RWARenkoSwitchFast.scrollStats.maxAckMs,losses:RWARenkoSwitchFast.scrollStats.losses,stable:document.documentElement.dataset.renkoScrollHistoryStable,canvas:document.querySelectorAll('#chartHost canvas').length,empty:getComputedStyle(document.getElementById('chartEmpty')).display}));
    const pass=beforeScroll.cacheHit==='true'&&beforeScroll.cacheMerged==='true'&&beforeScroll.bars>=expected&&after.symbol===symbol&&after.status==='live'&&after.bars>=expected&&after.canvas>0&&(after.total===0||after.empty==='none')&&after.losses===beforeScroll.losses&&after.stable==='true'&&after.maxAckMs<=1&&(first.same||first.firstFrameMs<=1);
    revisits.push({index:i+1,symbol,expectedBars:expected,first,beforeScroll,after,pass});
  }
}catch(e){fatal=String(e?.stack||e)}
const criticalConsole=consoleErrors.filter(x=>!/favicon|ERR_FAILED|Failed to load resource/i.test(x));
const criticalRequests=requestFailures.filter(x=>/renko\/|data-api\.binance\.vision|okx\.com/i.test(x.url)&&!/ERR_ABORTED/.test(x.error));
const firstFrames=[...rows.map(r=>r.first?.firstFrameMs||0),...revisits.map(r=>r.first?.firstFrameMs||0)];
const scrollMax=Math.max(0,...rows.map(r=>Number(r.scroll?.after?.maxAckMs)||0),...revisits.map(r=>Number(r.after?.maxAckMs)||0));
const screenshotCount=fs.existsSync(shots)?fs.readdirSync(shots).filter(x=>x.endsWith('.png')).length:0;
const summary={pairs:symbols.length,firstPass:rows.length,firstPassPass:rows.filter(x=>x.pass).length,revisits:revisits.length,revisitPass:revisits.filter(x=>x.pass).length,screenshotCount,firstFrameMaxMs:Math.max(0,...firstFrames),scrollAckMaxMs:scrollMax,scrollLosses:Math.max(0,...rows.map(r=>Number(r.scroll?.after?.losses)||0),...revisits.map(r=>Number(r.after?.losses)||0)),minHistoryBars:rows.length?Math.min(...rows.map(r=>r.history.afterBars)):0,maxHistoryBars:rows.length?Math.max(...rows.map(r=>r.history.afterBars)):0,zeroTotalSymbols:rows.filter(r=>r.history.total===0).map(r=>r.symbol)};
const status=!fatal&&httpStatus>=200&&httpStatus<400&&symbols.length===50&&rows.length===50&&rows.every(r=>r.pass)&&revisits.length===50&&revisits.every(r=>r.pass)&&screenshotCount===50&&summary.firstFrameMaxMs<=1&&summary.scrollAckMaxMs<=1&&summary.scrollLosses===0&&!pageErrors.length&&!criticalConsole.length&&!criticalRequests.length?'PASS':'FAIL';
const report={schema:'renko-50pair-history-scroll-continuity-v1',generatedAt:new Date().toISOString(),base,httpStatus,status,contract:'All 50 launch pairs must settle with fixed-1s history, retain already-loaded older history after switching away and back, survive trusted horizontal wheel/trackpad scrolling without losing chart/history, acknowledge pair switching and scrolling in strict 0ms-class <=1ms, and produce one settled zoomed-out screenshot per pair. Mathematical zero-brick output is accepted only when total/rendered/visible are consistently zero; source history must still be present.',summary,pageErrors,consoleErrors:criticalConsole,requestFailures:criticalRequests,fatal,symbols,rows,revisits};
fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));
console.log('RENKO_50PAIR_HISTORY_SCROLL_REPORT '+JSON.stringify({status,summary,fatal,failed:rows.filter(x=>!x.pass).map(x=>x.symbol),failedRevisits:revisits.filter(x=>!x.pass).map(x=>x.symbol)}));
await context.close();await browser.close();if(status!=='PASS')process.exit(2);
