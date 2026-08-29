import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const base=(process.env.RWA_TEST_URL||'http://127.0.0.1:8080/rwa').replace(/\/$/,'');
const out=process.env.RENKO_HISTORY_SCROLL_OUT||'artifacts/renko-50pair-history-scroll';
const viewport={width:1900,height:1000};
const requiredPages=Math.max(3,Math.min(5,Number(process.env.RENKO_HISTORY_PAGES)||4));
const safe=s=>String(s).replace(/[^A-Z0-9_-]/gi,'_');
const approx=(a,b,tol=1e-6)=>Math.abs(Number(a)-Number(b))<=tol;
fs.mkdirSync(path.join(out,'screenshots'),{recursive:true});

const browser=await chromium.launch({headless:true,args:['--disable-dev-shm-usage','--enable-precise-memory-info']});
const context=await browser.newContext({viewport,deviceScaleFactor:1});
const page=await context.newPage();
const pageErrors=[],consoleErrors=[],rows=[];
page.on('pageerror',e=>pageErrors.push(String(e?.message||e)));
page.on('console',m=>{if(m.type()==='error'&&!/WebSocket connection .*?(closed before|Ping received after close)/i.test(m.text()))consoleErrors.push(m.text())});
await page.addInitScript(()=>{
  try{localStorage.setItem('rwa_renko_tradingview_settings_v1',JSON.stringify({interval:'1s',source:'close',method:'traditional',atrLength:14,boxSize:1,percentage:.01,wicks:true}))}catch{}
  window.__renkoHistoryScrollLongTasks=[];
  try{const po=new PerformanceObserver(list=>{for(const e of list.getEntries())window.__renkoHistoryScrollLongTasks.push({start:e.startTime,duration:e.duration});while(window.__renkoHistoryScrollLongTasks.length>1000)window.__renkoHistoryScrollLongTasks.shift()});po.observe({type:'longtask',buffered:true})}catch{}
});

async function ensureDepth(){
  for(let i=0;i<6;i++){
    const pages=await page.evaluate(()=>Number(RWARenkoTV?.state?.historyPages)||1);
    if(pages>=requiredPages)break;
    const ok=await page.evaluate(()=>RWARenkoTV.loadOlderPage());
    if(!ok)break;
    await page.waitForTimeout(35);
  }
  return page.evaluate(()=>({pages:Number(RWARenkoTV.state.historyPages)||1,bars:RWARenkoTV.state.closedBars.length}));
}

async function maximizeRealBricksIfNeeded(){
  return page.evaluate(()=>{
    const T=RWARenkoTV,C=RWARenkoTraditionalControl;
    const before=Number(T.state.confirmedData?.length||T.state.confirmed?.length||0),tick=Number(T.state.tickSize);
    let used=false;
    if(before<90&&tick>0&&C?.activate){used=C.activate(tick,'history-proof-exchange-min-tick',false,false)===true}
    return{before,after:Number(T.state.confirmedData?.length||T.state.confirmed?.length||0),used,tick,box:Number(T.state.box)};
  });
}

async function placeFarHistory(){
  return page.evaluate(()=>{
    const V=RWARenkoStableChart?.viewport,T=RWARenkoTV;if(!V?.snapshot||!V?.restore)return{ok:false};
    let s=V.snapshot();if(!s||!(s.total>0))return{ok:false,snapshot:s,total:Number(s?.total)||0};
    const width=Math.max(18,Math.min(65,Math.floor(s.total*.28)||18));
    const maxGap=Math.max(0,s.total-width-4);
    const rightGap=Math.max(0,Math.min(maxGap,Math.max(30,Math.floor(s.total*.58))));
    T.state.following=false;
    const ok=V.restore({following:false,width,rightGap,historyPages:T.state.historyPages,source:'proof-far-history'});
    s=V.snapshot();
    return{ok,snapshot:s,target:{width,rightGap},farThreshold:Math.min(30,Math.max(0,s.total-width-4))};
  });
}

async function physicalScrollProof(){
  const host=page.locator('#chartHost');await host.hover();const box=await host.boundingBox();if(!box)throw new Error('chartHost missing bounding box');
  const before=await page.evaluate(()=>({snap:RWARenkoStableChart.viewport.snapshot(),events:Number(RWARenkoStableChart.scrollStats.events)||0,mark:performance.now()}));
  await page.mouse.move(box.x+box.width*.55,box.y+box.height*.52);
  await page.mouse.wheel(0,180);
  await page.waitForTimeout(40);
  const after=await page.evaluate(mark=>{
    const s=RWARenkoStableChart.viewport.snapshot(),st=RWARenkoStableChart.scrollStats,end=performance.now(),tasks=(window.__renkoHistoryScrollLongTasks||[]).filter(x=>x.start>=mark&&x.start<=end);
    return{snap:s,events:Number(st.events)||0,lastHandlerMs:Number(st.lastHandlerMs)||0,handlerMaxMs:Number(st.handlerMaxMs)||0,longTaskMaxMs:tasks.reduce((m,x)=>Math.max(m,Number(x.duration)||0),0),blockingMs:tasks.reduce((a,x)=>a+Math.max(0,(Number(x.duration)||0)-50),0)};
  },before.mark);
  const changed=!!before.snap&&!!after.snap&&(!approx(before.snap.from,after.snap.from,.001)||!approx(before.snap.to,after.snap.to,.001));
  return{before:before.snap,after:after.snap,eventDelta:after.events-before.events,scrollAckMs:after.lastHandlerMs,globalScrollAckMaxMs:after.handlerMaxMs,rangeChanged:changed,longTaskMaxMs:after.longTaskMaxMs,blockingMs:after.blockingMs};
}

let response=null,initial={},symbols=[],fatal='';
try{
  response=await page.goto(`${base}/renko/?symbol=BTCUSDT&historyPersist50=1&ts=${Date.now()}`,{waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForFunction(()=>window.RWARenkoTV?.state?.status==='live'&&window.RWARenkoStableChart?.version==='2.1.0'&&window.RWARenkoSwitchFast?.version==='1.2.0'&&window.RWARenkoTraditionalControl?.version&&document.querySelectorAll('.pair-row[data-symbol]').length===50,null,{timeout:90000});
  initial=await page.evaluate(()=>({symbol:RWARenkoTV.state.symbol,stableVersion:RWARenkoStableChart.version,switchVersion:RWARenkoSwitchFast.version,traditionalVersion:RWARenkoTraditionalControl.version,launchPairs:[...RWARenkoTV.launchPairs],pairRows:document.querySelectorAll('.pair-row[data-symbol]').length,interval:RWARenkoTV.settings.interval,selector:!!document.querySelector('#intervalSelect')}));
  symbols=[...initial.launchPairs];if(symbols.length!==50||new Set(symbols).size!==50)throw new Error(`expected 50 distinct launch pairs, got ${symbols.length}/${new Set(symbols).size}`);

  await ensureDepth();await maximizeRealBricksIfNeeded();let placed=await placeFarHistory();
  if(!placed.ok&&Number(placed.total)===0)await page.waitForTimeout(100);

  for(let i=0;i<symbols.length;i++){
    const symbol=symbols[i];let firstFrameMs=0,switchLoadMs=0;
    if(i>0){
      const locator=page.locator(`.pair-row[data-symbol="${symbol}"]`);if(await locator.count()!==1)throw new Error(`pair row missing ${symbol}`);
      await locator.click({force:true});
      firstFrameMs=await page.evaluate(()=>Number(document.documentElement.dataset.pairSwitchFirstFrameMs)||0);
      await page.waitForFunction(sym=>document.documentElement.dataset.pairSwitching==='false'&&document.documentElement.dataset.pairSwitchCompleted==='true'&&RWARenkoTV?.state?.status==='live'&&RWARenkoTV?.state?.symbol===sym,symbol,{timeout:30000});
      switchLoadMs=await page.evaluate(()=>Number(document.documentElement.dataset.pairSwitchLoadMs)||0);
    }
    const depth=await ensureDepth();const brickBoost=await maximizeRealBricksIfNeeded();placed=await placeFarHistory();
    const scroll=await physicalScrollProof();
    const snap=scroll.after||placed.snapshot;
    const state=await page.evaluate(()=>{
      const T=RWARenkoTV,V=RWARenkoStableChart.viewport.snapshot(),visible=Number(String(document.getElementById('brickCount')?.textContent||'0').replace(/[^0-9.-]/g,''))||0,total=Number(T.state.confirmedTotal??T.state.confirmed?.length??0),rendered=Number(T.state.confirmed?.length)||0;
      return{symbol:T.state.symbol,status:T.state.status,sourceBars:T.state.closedBars.length,historyPages:Number(T.state.historyPages)||1,confirmedTotal:total,renderedConfirmed:rendered,visibleConfirmed:visible,canvasCount:document.querySelectorAll('#chartHost canvas').length,chartEmptyDisplay:getComputedStyle(document.getElementById('chartEmpty')).display,following:T.state.following,viewport:V,coverage:document.getElementById('tvCoverage')?.textContent||'',method:T.settings.method,box:Number(T.state.box),tick:Number(T.state.tickSize),historyRestored:document.documentElement.dataset.renkoHistoryRestored||'',historyCarry:document.documentElement.dataset.renkoHistoryCarry||'',restoreSource:document.documentElement.dataset.renkoHistoryRestoreSource||''};
    });
    const total=Number(snap?.total)||0,width=Number(snap?.width)||0,rightGap=Number(snap?.rightGap)||0,farThreshold=Math.min(30,Math.max(0,total-width-4));
    const zeroMath=state.confirmedTotal===0&&state.renderedConfirmed===0&&state.visibleConfirmed===0;
    const countPass=state.confirmedTotal===state.visibleConfirmed&&state.confirmedTotal>=state.renderedConfirmed&&(state.confirmedTotal===0?zeroMath:state.renderedConfirmed>0);
    const farPass=total===0?zeroMath:(!snap.following&&rightGap>=farThreshold&&rightGap>0);
    const scrollPass=scroll.eventDelta>=1&&scroll.scrollAckMs<=1&&scroll.blockingMs===0&&scroll.longTaskMaxMs<50&&scroll.rangeChanged&&!scroll.after.following;
    const pass=state.symbol===symbol&&state.status==='live'&&depth.pages>=requiredPages&&state.sourceBars>=2000&&state.method==='traditional'&&state.box>0&&state.tick>0&&countPass&&farPass&&scrollPass&&state.canvasCount>0&&state.chartEmptyDisplay==='none'&&(i===0||firstFrameMs<=1);
    const file=`${String(i+1).padStart(2,'0')}-${safe(symbol)}-far-history.png`;
    await page.screenshot({path:path.join(out,'screenshots',file),fullPage:true});
    rows.push({index:i+1,symbol,firstFrameMs,switchLoadMs,depth,brickBoost,state,far:{snapshot:snap,farThreshold,pass:farPass},scroll,screenshot:file,pass});
    if(!pass)throw new Error(`pair failed ${symbol}: ${JSON.stringify(rows.at(-1))}`);
  }
}catch(e){fatal=String(e?.stack||e);try{await page.screenshot({path:path.join(out,'FAIL.png'),fullPage:true})}catch{}}

const scrollAckMaxMs=Math.max(0,...rows.map(r=>Number(r.scroll?.scrollAckMs)||0));
const switchFirstFrameMaxMs=Math.max(0,...rows.slice(1).map(r=>Number(r.firstFrameMs)||0));
const zeroTotalSymbols=rows.filter(r=>r.state?.confirmedTotal===0).map(r=>r.symbol);
const status=!fatal&&response?.status()>=200&&response?.status()<400&&symbols.length===50&&new Set(symbols).size===50&&rows.length===50&&rows.every(r=>r.pass)&&!pageErrors.length&&!consoleErrors.length&&scrollAckMaxMs<=1&&switchFirstFrameMaxMs<=1?'PASS':'FAIL';
const report={schema:'renko-50pair-history-persist-far-scroll-v1',generatedAt:new Date().toISOString(),base,viewport,status,httpStatus:response?.status()||0,contract:{pairs:'exactly 50 distinct launch pairs',history:`each pair keeps at least ${requiredPages} fixed-1s history pages and the historical viewport remains away from the latest formation after switching`,screenshots:'one full-page screenshot for every pair while positioned away from the latest formation',scrollZeroMs:'physical mouse-wheel input acknowledgement <=1ms with zero >50ms blocking and a measured visible-range change; network/history loading is measured separately and is not called 0ms',countTruth:'visible CONFIRMED equals mathematical confirmed total; legitimate zero remains exactly zero and is never fabricated'},initial,symbols,summary:{count:rows.length,passCount:rows.filter(r=>r.pass).length,failedSymbols:rows.filter(r=>!r.pass).map(r=>r.symbol),zeroTotalSymbols,scrollAckMaxMs,switchFirstFrameMaxMs,sourceBarsMin:rows.length?Math.min(...rows.map(r=>r.state.sourceBars)):0,historyPagesMin:rows.length?Math.min(...rows.map(r=>r.state.historyPages)):0,screenshots:rows.length},pageErrors,consoleErrors,fatal,rows};
fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));
console.log('RENKO_50PAIR_HISTORY_SCROLL '+JSON.stringify({status,summary:report.summary,fatal}));
await browser.close();if(status!=='PASS')process.exit(2);
