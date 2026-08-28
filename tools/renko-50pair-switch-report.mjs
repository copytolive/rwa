import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const base=(process.env.RWA_TEST_URL||'http://127.0.0.1:8080/rwa').replace(/\/$/,'');
const out=process.env.RENKO_50PAIR_OUT||'artifacts/renko-50pair-switch';
fs.mkdirSync(path.join(out,'00ms-first-frames'),{recursive:true});
const percentile=(a,p)=>{const x=[...a].sort((m,n)=>m-n);if(!x.length)return 0;return x[Math.min(x.length-1,Math.max(0,Math.ceil(p*x.length)-1))]};
const browser=await chromium.launch({headless:true,args:['--enable-precise-memory-info']});
const context=await browser.newContext({viewport:{width:1900,height:1000},deviceScaleFactor:1});
const page=await context.newPage();
let reportFinished=false,crashed=false,closedUnexpectedly=false;
const pageErrors=[],consoleErrors=[],requestFailures=[];
page.on('crash',()=>{crashed=true});
page.on('close',()=>{if(!reportFinished)closedUnexpectedly=true});
page.on('pageerror',e=>pageErrors.push(String(e?.message||e)));
page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text())});
page.on('requestfailed',r=>requestFailures.push({url:r.url(),error:r.failure()?.errorText||''}));
await page.addInitScript(()=>{
  try{localStorage.setItem('rwa_renko_tradingview_settings_v1',JSON.stringify({interval:'1s',source:'close',method:'atr',atrLength:14,boxSize:1,percentage:.01,wicks:true}))}catch{}
  window.__renkoSwitchLongTasks=[];
  try{const po=new PerformanceObserver(list=>{for(const e of list.getEntries())window.__renkoSwitchLongTasks.push({start:e.startTime,duration:e.duration});while(window.__renkoSwitchLongTasks.length>2000)window.__renkoSwitchLongTasks.shift()});po.observe({type:'longtask',buffered:true})}catch{}
});
const cdp=await context.newCDPSession(page);await cdp.send('Performance.enable');try{await cdp.send('HeapProfiler.enable')}catch{}
async function gc(){try{await cdp.send('HeapProfiler.collectGarbage')}catch{}await page.waitForTimeout(40)}
async function metrics(){const r=await cdp.send('Performance.getMetrics');const m=Object.fromEntries(r.metrics.map(x=>[x.name,x.value]));return{jsHeapUsedMB:(m.JSHeapUsedSize||0)/1048576,jsHeapTotalMB:(m.JSHeapTotalSize||0)/1048576,nodes:m.Nodes||0,documents:m.Documents||0,frames:m.Frames||0}}
const safe=s=>String(s).replace(/[^A-Z0-9_-]/gi,'_');
const url=`${base}/renko/?symbol=XAUT&switch50=1&ts=${Date.now()}`;
let httpStatus=0,initial={},symbols=[],rows=[],returnXaut=null,startMetrics={},endMetrics={},fatal='';
try{
  const response=await page.goto(url,{waitUntil:'domcontentloaded',timeout:60000});httpStatus=response?.status()||0;
  await page.waitForFunction(()=>window.RWARenkoTV?.state?.symbol==='XAUTUSDT'&&window.RWARenkoTV?.state?.status==='live'&&window.RWARenkoTV?.state?.closedBars?.length>100&&window.RWARenkoSwitchFast?.version&&window.RWARenkoATRFixed1s?.version&&window.RWARenkoATRFixed1s.workerActive===false&&document.documentElement.dataset.atrMatrixReady==='idle'&&document.querySelectorAll('.pair-row[data-symbol]').length>=50,null,{timeout:90000});
  initial=await page.evaluate(()=>({symbol:RWARenkoTV.state.symbol,status:RWARenkoTV.state.status,bars:RWARenkoTV.state.closedBars.length,box:RWARenkoTV.state.box,last:RWARenkoTV.state.lastPrice,appVersion:RWARenkoTV.version,switchVersion:RWARenkoSwitchFast.version,atrVersion:RWARenkoATRFixed1s.version,atrWorkerActive:RWARenkoATRFixed1s.workerActive,atrEntryCount:RWARenkoATRFixed1s.entryCount,chartEmptyDisplay:getComputedStyle(document.getElementById('chartEmpty')).display,canvases:document.querySelectorAll('#chartHost canvas').length,pairRows:document.querySelectorAll('.pair-row[data-symbol]').length,launchPairs:[...(RWARenkoTV.launchPairs||[])]}));
  symbols=[...initial.launchPairs];if(symbols.length!==50)throw new Error(`Expected exact 50 launch pairs, got ${symbols.length}`);
  await gc();startMetrics=await metrics();
  for(let i=0;i<symbols.length;i++){
    const symbol=symbols[i];
    const first=await page.evaluate(symbol=>{
      const row=document.querySelector(`.pair-row[data-symbol="${symbol}"]`);if(!row)return{found:false};
      const start=performance.now();window.__switchProofMark=start;row.click();
      const empty=document.getElementById('chartEmpty'),overlay=document.getElementById('switchOverlay'),wrap=document.getElementById('chartWrap');
      return{found:true,mark:start,syncCallMs:performance.now()-start,firstFrameMs:Number(document.documentElement.dataset.pairSwitchFirstFrameMs)||0,switching:document.documentElement.dataset.pairSwitching,target:document.documentElement.dataset.pairSwitchTarget,pair:document.getElementById('pairName')?.textContent||'',chartEmptyDisplay:empty?getComputedStyle(empty).display:'missing',overlayVisible:!!overlay&&!overlay.hidden&&getComputedStyle(overlay).display!=='none',overlayText:overlay?.textContent?.trim()||'',chartSwitchingClass:!!wrap?.classList.contains('switching'),canvasCount:document.querySelectorAll('#chartHost canvas').length,workerActive:!!window.RWARenkoATRFixed1s?.workerActive};
    },symbol);
    await page.screenshot({path:path.join(out,'00ms-first-frames',`${String(i+1).padStart(2,'0')}-${safe(symbol)}.png`),fullPage:true});
    await page.waitForFunction(symbol=>window.RWARenkoTV?.state?.symbol===symbol&&window.RWARenkoTV?.state?.status==='live'&&document.documentElement.dataset.pairSwitching==='false'&&window.RWARenkoTV?.state?.closedBars?.length>50&&Number(window.RWARenkoTV?.state?.box)>0&&Number(window.RWARenkoTV?.state?.lastPrice)>0,symbol,{timeout:20000});
    await page.waitForTimeout(80);
    const done=await page.evaluate(({symbol,mark})=>{const end=performance.now(),tasks=(window.__renkoSwitchLongTasks||[]).filter(x=>x.start>=mark&&x.start<=end);return{symbol:RWARenkoTV.state.symbol,status:RWARenkoTV.state.status,bars:RWARenkoTV.state.closedBars.length,box:Number(RWARenkoTV.state.box),last:Number(RWARenkoTV.state.lastPrice),loadMs:Number(document.documentElement.dataset.pairSwitchLoadMs)||0,completed:document.documentElement.dataset.pairSwitchCompleted,chartEmptyDisplay:getComputedStyle(document.getElementById('chartEmpty')).display,overlayHidden:!!document.getElementById('switchOverlay')?.hidden,canvasCount:document.querySelectorAll('#chartHost canvas').length,workerActive:!!RWARenkoATRFixed1s?.workerActive,entryCount:Number(RWARenkoATRFixed1s?.entryCount)||0,longTasks:tasks,longTaskMaxMs:tasks.reduce((m,x)=>Math.max(m,Number(x.duration)||0),0),longTaskBlockingMs:tasks.reduce((a,x)=>a+Math.max(0,(Number(x.duration)||0)-50),0),switchStats:{...RWARenkoSwitchFast.stats}}},{symbol,mark:first.mark});
    let mem=null;if((i+1)%10===0||i===symbols.length-1){await gc();mem=await metrics()}
    const pass=first.found&&first.switching==='true'&&first.target===symbol&&first.firstFrameMs<=16&&first.chartEmptyDisplay==='none'&&first.overlayVisible&&first.chartSwitchingClass&&first.canvasCount>0&&!first.workerActive&&done.symbol===symbol&&done.status==='live'&&done.bars>50&&done.box>0&&done.last>0&&done.completed==='true'&&done.chartEmptyDisplay==='none'&&done.overlayHidden&&done.canvasCount>0&&!done.workerActive&&done.entryCount===0&&done.loadMs<12000&&done.longTaskMaxMs<120;
    rows.push({index:i+1,symbol,first,done,memoryAfterGC:mem,pass});
  }
  const retFirst=await page.evaluate(()=>{const start=performance.now();window.__switchProofMark=start;void RWARenkoSwitchFast.load('XAUTUSDT',{fit:true});const o=document.getElementById('switchOverlay'),e=document.getElementById('chartEmpty');return{mark:start,firstFrameMs:Number(document.documentElement.dataset.pairSwitchFirstFrameMs)||0,target:document.documentElement.dataset.pairSwitchTarget,switching:document.documentElement.dataset.pairSwitching,chartEmptyDisplay:getComputedStyle(e).display,overlayVisible:!!o&&!o.hidden,canvasCount:document.querySelectorAll('#chartHost canvas').length,workerActive:RWARenkoATRFixed1s.workerActive}});
  await page.screenshot({path:path.join(out,'00ms-first-frames','51-return-XAUTUSDT.png'),fullPage:true});
  await page.waitForFunction(()=>RWARenkoTV?.state?.symbol==='XAUTUSDT'&&RWARenkoTV?.state?.status==='live'&&document.documentElement.dataset.pairSwitching==='false'&&RWARenkoATRFixed1s?.workerActive===false,null,{timeout:25000});
  returnXaut=await page.evaluate(mark=>{const end=performance.now(),tasks=(window.__renkoSwitchLongTasks||[]).filter(x=>x.start>=mark&&x.start<=end);return{symbol:RWARenkoTV.state.symbol,status:RWARenkoTV.state.status,bars:RWARenkoTV.state.closedBars.length,last:RWARenkoTV.state.lastPrice,box:RWARenkoTV.state.box,loadMs:Number(document.documentElement.dataset.pairSwitchLoadMs)||0,chartEmptyDisplay:getComputedStyle(document.getElementById('chartEmpty')).display,workerActive:RWARenkoATRFixed1s.workerActive,entryCount:RWARenkoATRFixed1s.entryCount,longTaskMaxMs:tasks.reduce((m,x)=>Math.max(m,x.duration),0),switchStats:{...RWARenkoSwitchFast.stats}}},retFirst.mark);
  await gc();endMetrics=await metrics();
}catch(e){fatal=String(e?.stack||e)}
const loads=rows.map(r=>r.done?.loadMs||0),firstFrames=rows.map(r=>r.first?.firstFrameMs||Infinity),longMax=Math.max(0,...rows.map(r=>r.done?.longTaskMaxMs||0));
const heapGrowthMB=(endMetrics.jsHeapUsedMB||0)-(startMetrics.jsHeapUsedMB||0);
const criticalConsole=consoleErrors.filter(x=>!/favicon|ERR_FAILED|Failed to load resource/i.test(x));
const criticalRequests=requestFailures.filter(x=>/renko\/|data-api\.binance\.vision|okx\.com/i.test(x.url)&&!/ERR_ABORTED/.test(x.error));
const summary={count:rows.length,passCount:rows.filter(r=>r.pass).length,firstFrameMaxMs:Math.max(0,...firstFrames.filter(Number.isFinite)),loadP50Ms:percentile(loads,.50),loadP95Ms:percentile(loads,.95),loadMaxMs:Math.max(0,...loads),longTaskMaxMs:longMax,heapGrowthMB,heapStartMB:startMetrics.jsHeapUsedMB||0,heapEndMB:endMetrics.jsHeapUsedMB||0};
const returnPass=!!returnXaut&&returnXaut.symbol==='XAUTUSDT'&&returnXaut.status==='live'&&returnXaut.bars>50&&returnXaut.box>0&&returnXaut.last>0&&returnXaut.chartEmptyDisplay==='none'&&!returnXaut.workerActive&&returnXaut.entryCount===0;
const status=!fatal&&httpStatus>=200&&httpStatus<400&&initial.symbol==='XAUTUSDT'&&!initial.atrWorkerActive&&initial.atrEntryCount===0&&initial.chartEmptyDisplay==='none'&&initial.canvases>0&&initial.pairRows>=50&&symbols.length===50&&rows.length===50&&rows.every(r=>r.pass)&&returnPass&&!crashed&&!closedUnexpectedly&&!pageErrors.length&&!criticalConsole.length&&summary.firstFrameMaxMs<=16&&summary.loadP95Ms<6000&&summary.loadMaxMs<12000&&summary.longTaskMaxMs<120&&summary.heapEndMB<256&&heapGrowthMB<96?'PASS':'FAIL';
const report={schema:'renko-50pair-zero-ms-switch-browser-v2',generatedAt:new Date().toISOString(),base,url,status,contract:'Start live on XAUT, then click all 50 launch-pair DOM rows. The synchronous first frame must acknowledge the target in <=16ms, keep the previous chart visible, never expose the full-screen loader, keep the million-row XAUT ATR worker idle, finish each target live, avoid Chrome crash, and remain memory-bounded. Return to XAUT as an extra 51st proof.',httpStatus,initial,symbols,summary,startMetrics,endMetrics,returnXaut,returnPass,crashed,closedUnexpectedly,pageErrors,consoleErrors:criticalConsole,requestFailures:criticalRequests.slice(0,100),requestFailureCount:criticalRequests.length,fatal,rows};
fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));
console.log('RENKO_50PAIR_SWITCH_REPORT '+JSON.stringify({...report,rows:rows.map(r=>({index:r.index,symbol:r.symbol,pass:r.pass,firstFrameMs:r.first.firstFrameMs,loadMs:r.done.loadMs,longTaskMaxMs:r.done.longTaskMaxMs,memoryAfterGC:r.memoryAfterGC}))}));
reportFinished=true;await context.close();await browser.close();if(status!=='PASS')process.exit(2);
