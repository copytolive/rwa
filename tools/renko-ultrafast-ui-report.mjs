import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';

const BASE=(process.env.RWA_TEST_URL||'https://copytolive.github.io/rwa').replace(/\/$/,'');
const OUT=path.resolve('artifacts/renko-ultrafast-ui');
const LOCAL=/^https?:\/\/(127\.0\.0\.1|localhost)(:|\/|$)/.test(BASE);
await fs.mkdir(OUT,{recursive:true});

function mockKlines(url){const u=new URL(url),step=1000,now=Date.now(),raw=u.searchParams.get('endTime'),requested=raw===null?NaN:Number(raw),end=Number.isFinite(requested)?requested:now-step*2,lastOpen=Math.floor((end-step+1)/step)*step,rows=[];for(let j=999;j>=0;j--){const t=lastOpen-j*step,i=Math.floor(t/step),o=100+Math.sin(i/17)*8,c=o+Math.sin(i/7)*1.5,h=Math.max(o,c)+2,l=Math.min(o,c)-2;rows.push([t,String(o),String(h),String(l),String(c),'100',t+999,'0',1,'0','0','0'])}return rows}
function markets(n=1600){const symbols=[];for(let i=0;i<n;i++){const base=`C${String(i).padStart(4,'0')}`,symbol=`${base}USDT`;symbols.push({symbol,status:'TRADING',baseAsset:base,quoteAsset:'USDT',isSpotTradingAllowed:true,filters:[{filterType:'PRICE_FILTER',tickSize:'0.01'}]})}return symbols}
async function installMocks(page){
  if(!LOCAL)return;
  await page.addInitScript(()=>{class FakeWebSocket{constructor(url){this.url=url;this.readyState=0;setTimeout(()=>{this.readyState=1;this.onopen?.({type:'open'})},10)}close(){this.readyState=3;this.onclose?.({type:'close'})}send(){}}window.WebSocket=FakeWebSocket});
  await page.route('https://unpkg.com/lightweight-charts@5.1.0/dist/lightweight-charts.standalone.production.js',route=>route.fulfill({status:200,contentType:'application/javascript',body:`(()=>{let range={from:0,to:65},subs=[];const ts={subscribeVisibleLogicalRangeChange(cb){subs.push(cb)},setVisibleLogicalRange(r){range={...r};for(const cb of subs)cb(range)},getVisibleLogicalRange(){return {...range}}};const series=()=>({setData(){},applyOptions(){},createPriceLine(){return{applyOptions(){}}}});window.LightweightCharts={CandlestickSeries:{},createChart(){return{addSeries(){return series()},addCandlestickSeries(){return series()},applyOptions(){},timeScale(){return ts}}}}})();`}));
  const syms=markets();
  await page.route('**/api/v3/**',route=>{const u=new URL(route.request().url()),p=u.pathname;if(p.endsWith('/klines'))return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(mockKlines(u.href))});if(p.endsWith('/exchangeInfo')){const one=u.searchParams.get('symbol');return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({symbols:one?[{symbol:one,status:'TRADING',baseAsset:one.replace(/USDT$/,''),quoteAsset:'USDT',isSpotTradingAllowed:true,filters:[{filterType:'PRICE_FILTER',tickSize:'0.01'}]}]:syms})})}if(p.endsWith('/ticker/24hr'))return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(syms.map((s,i)=>({symbol:s.symbol,lastPrice:String(1+i/10),priceChangePercent:String((i%21)-10),quoteVolume:String(100000000-i*1000)})))});return route.continue()});
}

async function run(label,viewport){
  const browser=await chromium.launch({headless:true});
  const context=await browser.newContext({viewport});
  const page=await context.newPage();await installMocks(page);
  const errors=[];page.on('pageerror',e=>errors.push(String(e?.message||e)));page.on('console',m=>{if(m.type()==='error'&&!/Failed to load resource|WebSocket connection|Invalid language tag/i.test(m.text()))errors.push(m.text())});
  const url=`${BASE}/renko/?symbol=SOL&ultrafastReport=3&ts=${Date.now()}`,started=Date.now();
  await page.goto(url,{waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForFunction(()=>/^3\.1\./.test(window.RWARenkoTV?.version||'')&&window.RWARenkoUltraUI?.version==='1.1.1'&&window.RWARenkoTV?.state?.status==='live'&&window.RWARenkoTV?.state?.closedBars?.length>=100&&window.RWARenkoTV?.state?.box>0&&window.RWARenkoTV?.settings?.interval==='1s',null,{timeout:60000});
  await page.waitForFunction(()=>document.querySelectorAll('#pairList .pair-row').length===50&&document.documentElement.dataset.renkoUniverseDormant==='true',null,{timeout:5000});
  const readyMs=Date.now()-started,before=await page.evaluate(()=>({...RWARenkoUltraUI.stats}));

  // Opening/focusing the market drawer must be cheap: exactly 50 launch rows stay present
  // and the full universe remains dormant until the user actually types a search term.
  const open=page.locator('#openPairs'),search=page.locator('#pairSearch');if(await open.isVisible())await open.click();else await search.focus();
  await page.waitForFunction(()=>document.querySelectorAll('#pairList .pair-row').length===50,null,{timeout:5000});
  const dormant=await page.evaluate(()=>({requested:RWARenkoUltraUI.stats.universeRequested,loaded:RWARenkoUltraUI.stats.universeLoaded,launchRows:document.querySelectorAll('#pairList .pair-row').length,dormant:document.documentElement.dataset.renkoUniverseDormant}));
  const dormantPass=!dormant.requested&&!dormant.loaded&&dormant.launchRows===50&&dormant.dormant==='true';

  // Focusing the empty search field must still keep the Fast 50 and must not invoke the
  // app's legacy full-universe loader.
  await search.focus();await page.waitForTimeout(30);
  const focusState=await page.evaluate(()=>({requested:RWARenkoUltraUI.stats.universeRequested,loaded:RWARenkoUltraUI.stats.universeLoaded,launchRows:document.querySelectorAll('#pairList .pair-row').length,dormant:document.documentElement.dataset.renkoUniverseDormant}));
  const focusPass=!focusState.requested&&!focusState.loaded&&focusState.launchRows===50&&focusState.dormant==='true';

  // Typing is the explicit signal that may load the full universe.
  const marketStarted=Date.now();await search.fill(LOCAL?'C0':'BTC');
  await page.waitForFunction(()=>RWARenkoUltraUI.stats.universeLoaded&&RWARenkoUltraUI.stats.totalRows>1000,null,{timeout:30000});
  const marketReadyMs=Date.now()-marketStarted;
  // Use a broad term to exercise a genuinely scrollable virtual result set.
  await search.fill('USDT');await page.waitForTimeout(80);
  const market=await page.evaluate(()=>({stats:{...RWARenkoUltraUI.stats},domRows:document.querySelectorAll('#pairList .pair-row').length,pairTotal:document.querySelector('#pairTotal')?.textContent,scrollHeight:document.querySelector('#pairList')?.scrollHeight,clientHeight:document.querySelector('#pairList')?.clientHeight}));
  await page.evaluate(()=>{const h=document.querySelector('#pairList');h.scrollTop=h.scrollHeight;h.dispatchEvent(new Event('scroll'))});await page.waitForTimeout(100);
  const scrollState=await page.evaluate(()=>({domRows:document.querySelectorAll('#pairList .pair-row').length,scrollTop:document.querySelector('#pairList')?.scrollTop,scrollHeight:document.querySelector('#pairList')?.scrollHeight,clientHeight:document.querySelector('#pairList')?.clientHeight,stats:{...RWARenkoUltraUI.stats}}));

  await search.fill(LOCAL?'C00':'BTC');await page.waitForTimeout(60);
  const searchState=await page.evaluate(()=>({filtered:RWARenkoUltraUI.stats.filteredRows,domRows:document.querySelectorAll('#pairList .pair-row').length,searchMs:RWARenkoUltraUI.stats.searchMs}));
  await search.fill('');await page.waitForFunction(()=>document.querySelectorAll('#pairList .pair-row').length===50,null,{timeout:5000});
  const launchAfterClear=await page.evaluate(()=>({rows:document.querySelectorAll('#pairList .pair-row').length,text:document.querySelector('#pairShown')?.textContent||'',dormant:document.documentElement.dataset.renkoUniverseDormant}));

  const zoom=await page.evaluate(async()=>{const U=RWARenkoUltraUI,T=RWARenkoTV,locks0=U.stats.manualViewLocks,prevented0=U.stats.zoomSnapPrevented;document.querySelector('#tvZoomOut').click();await new Promise(r=>setTimeout(r,30));const afterClick={manualLocked:U.manualViewLocked,following:T.state.following,locks:U.stats.manualViewLocks};T.state.following=true;const afterFollowAttempt={following:T.state.following,prevented:U.stats.zoomSnapPrevented};T.rebuild();T.rebuild();await new Promise(r=>setTimeout(r,80));const afterRebuild={manualLocked:U.manualViewLocked,following:T.state.following,prevented:U.stats.zoomSnapPrevented};return{locks0,prevented0,afterClick,afterFollowAttempt,afterRebuild}});
  const after=await page.evaluate(()=>({...RWARenkoUltraUI.stats})),longTaskDelta=after.longTasks-before.longTasks,blockingDelta=after.blockingMs-before.blockingMs;
  const virtualPass=market.stats.totalRows>1000&&market.stats.filteredRows>60&&market.domRows<=60&&market.domRows<market.stats.filteredRows&&market.clientHeight<=900;
  const scrollPass=scrollState.domRows<=60&&scrollState.clientHeight<=900&&scrollState.scrollTop>0;
  const blockingPass=blockingDelta===0;
  const searchPass=searchState.filtered>0&&searchState.domRows<=60&&searchState.searchMs<25;
  const launchPass=launchAfterClear.rows===50;
  const zoomPass=zoom.afterClick.manualLocked===true&&zoom.afterClick.following===false&&zoom.afterClick.locks>zoom.locks0&&zoom.afterFollowAttempt.following===false&&zoom.afterFollowAttempt.prevented>zoom.prevented0&&zoom.afterRebuild.manualLocked===true&&zoom.afterRebuild.following===false;
  const pass=errors.length===0&&readyMs<7000&&dormantPass&&focusPass&&virtualPass&&scrollPass&&blockingPass&&searchPass&&launchPass&&zoomPass;
  const result={label,url,readyMs,marketReadyMs,errors,dormant,dormantPass,focusState,focusPass,market,scrollState,longTaskDelta,blockingDelta,searchState,launchAfterClear,zoom,virtualPass,scrollPass,blockingPass,searchPass,launchPass,zoomPass,pass};
  await page.screenshot({path:path.join(OUT,`${label}.png`),fullPage:true});await context.close();await browser.close();return result;
}

const results=[];for(const [label,viewport] of [['desktop',{width:1900,height:1000}],['mobile',{width:390,height:844}]])results.push(await run(label,viewport));
const report={generatedAt:new Date().toISOString(),scope:'current fixed-1s RENKO: Fast-50 startup/open/focus, search-only full-universe worker parsing, bounded virtual scroll, zero long-task blocking, and manual zoom no-snap',zeroMsDefinition:'0 ms main-thread blocking above the 50 ms Long Task threshold during this interaction window; elapsed network/worker time is allowed',status:results.every(x=>x.pass)?'PASS':'FAIL',results};
await fs.writeFile(path.join(OUT,'report.json'),JSON.stringify(report,null,2));console.log('RENKO_ULTRAFAST_UI_REPORT',JSON.stringify(report));if(report.status!=='PASS')process.exitCode=1;
