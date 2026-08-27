import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';

const BASE=(process.env.RWA_TEST_URL||'https://copytolive.github.io/rwa/').replace(/\/$/,'');
const OUT=path.resolve('artifacts/renko-tv-official-report');
const READY_LIMIT_MS=5000;
const LOCAL=/^https?:\/\/(127\.0\.0\.1|localhost)(:|\/|$)/.test(BASE);
await fs.mkdir(OUT,{recursive:true});
const browser=await chromium.launch({headless:true});
const results=[];

function intervalMs(v){return({'1s':1000,'1m':60000,'3m':180000,'5m':300000,'15m':900000,'30m':1800000,'1h':3600000,'4h':14400000,'1d':86400000})[v]||60000}
function mockKlines(url){
  const u=new URL(url),step=intervalMs(u.searchParams.get('interval')||'1m'),now=Date.now();
  const raw=u.searchParams.get('endTime'),requested=raw===null?NaN:Number(raw),end=Number.isFinite(requested)?requested:now-step*2;
  const lastOpen=Math.floor((end-step+1)/step)*step,rows=[];
  for(let j=999;j>=0;j--){
    const openTime=lastOpen-j*step,idx=Math.floor(openTime/step),age=Math.max(0,(now-openTime)/step),vol=age<250?6:age<1000?3:1.2;
    const open=100+Math.sin(idx/17)*8+Math.sin(idx/53)*4,close=open+Math.sin(idx/7)*vol*.45,high=Math.max(open,close)+vol,low=Math.min(open,close)-vol;
    rows.push([openTime,String(open),String(high),String(low),String(close),'100',openTime+step-1,'0',1,'0','0','0']);
  }
  return rows;
}
async function installLocalMocks(page){
  if(!LOCAL)return;
  await page.addInitScript(()=>{
    class FakeWebSocket{constructor(url){this.url=url;this.readyState=0;setTimeout(()=>{this.readyState=1;this.onopen?.({type:'open'})},10)}close(){this.readyState=3;this.onclose?.({type:'close'})}send(){}}
    window.WebSocket=FakeWebSocket;
  });
  await page.route('https://unpkg.com/lightweight-charts@5.1.0/dist/lightweight-charts.standalone.production.js',route=>route.fulfill({status:200,contentType:'application/javascript',body:`(()=>{let range={from:0,to:65};const ts={subscribeVisibleLogicalRangeChange(){},setVisibleLogicalRange(r){range=r},getVisibleLogicalRange(){return range}};const series=()=>({setData(){},createPriceLine(){return{applyOptions(){}}}});window.LightweightCharts={CandlestickSeries:{},createChart(){return{addSeries(){return series()},addCandlestickSeries(){return series()},applyOptions(){},timeScale(){return ts}}}}})();`}));
  await page.route('**/api/v3/**',async route=>{
    const u=new URL(route.request().url()),p=u.pathname;
    if(p.endsWith('/klines'))return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(mockKlines(u.href))});
    if(p.endsWith('/exchangeInfo')){
      const symbols=(u.searchParams.get('symbol')?[u.searchParams.get('symbol')]:['SOLUSDT','BTCUSDT','ETHUSDT']).map(symbol=>({symbol,status:'TRADING',baseAsset:symbol.replace(/USDT$/,''),quoteAsset:'USDT',isSpotTradingAllowed:true,filters:[{filterType:'PRICE_FILTER',tickSize:'0.01'}]}));
      return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({symbols})});
    }
    if(p.endsWith('/ticker/price'))return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({symbol:u.searchParams.get('symbol')||'SOLUSDT',price:'100.00'})});
    if(p.endsWith('/ticker/24hr'))return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(['SOLUSDT','BTCUSDT','ETHUSDT'].map((symbol,i)=>({symbol,lastPrice:String(100+i*10),priceChangePercent:String(i+1),quoteVolume:String(1000000-i*100000)}))) });
    return route.continue();
  });
}
async function waitStableBars(page,maxMs=3500){
  let last=-1,stable=0;const start=Date.now();
  while(Date.now()-start<maxMs){
    const n=await page.evaluate(()=>window.RWARenkoTV?.state?.closedBars?.length||0);
    if(n===last)stable++;else stable=0;last=n;
    if(stable>=3)return n;
    await page.waitForTimeout(150);
  }
  return last;
}
async function frameProbe(page,duration=900){
  return page.evaluate(ms=>new Promise(resolve=>{let last=performance.now(),maxGap=0,count=0,start=last;function tick(t){maxGap=Math.max(maxGap,t-last);last=t;count++;if(t-start>=ms)resolve({maxGap,count,duration:t-start});else requestAnimationFrame(tick)}requestAnimationFrame(tick)}),duration);
}
async function atrSnapshot(page){
  return page.evaluate(()=>({method:RWARenkoTV.settings.method,atrLength:RWARenkoTV.settings.atrLength,box:RWARenkoTV.state.box,atr:RWARenkoTV.state.atr,tick:RWARenkoTV.state.tickSize,count:RWARenkoTV.state.confirmed.length,sourceBars:RWARenkoTV.state.closedBars.length,coverageStart:RWARenkoTV.state.closedBars[0]?.openTime,coverageEnd:RWARenkoTV.state.closedBars.at(-1)?.closeTime,historySatisfied:RWARenkoTV.state.atrHistorySatisfied,inputValue:document.querySelector('#atrLength')?.value,appliedLength:document.documentElement.dataset.atrAppliedLength,chartRebuilt:document.documentElement.dataset.atrChartRebuilt,chartChanged:document.documentElement.dataset.atrChartChanged,lastApply:RWARenkoTV.state.atrLastApply||null,coverageText:document.querySelector('#tvCoverage')?.textContent,loadText:document.querySelector('#tvLoadState')?.textContent,badgeText:document.querySelector('.method[data-method="atr"] .method-title span')?.textContent}));
}

async function runViewport(label,viewport){
  const context=await browser.newContext({viewport,deviceScaleFactor:1});
  const page=await context.newPage();await installLocalMocks(page);
  const errors=[];
  page.on('pageerror',e=>errors.push(String(e?.message||e)));
  page.on('console',m=>{const t=m.text();if(m.type()==='error'&&!/Failed to load resource|WebSocket connection|Invalid language tag: en-US@posix/i.test(t))errors.push(t)});
  const started=Date.now(),url=`${BASE}/renko/?symbol=SOL&tvOfficialReport=1&ts=${Date.now()}`;
  await page.goto(url,{waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForFunction(()=>window.RWARenkoTV?.version==='1.0.0'&&window.RWARenkoATRParity?.version==='3.0.0'&&window.RWARenkoFetchGuard?.version==='2.0.0'&&window.RWARenkoTV?.state?.closedBars?.length>=100&&window.RWARenkoTV?.state?.box>0&&document.querySelector('#tvLoadState')?.textContent?.includes('LIVE'),null,{timeout:60000});
  const readyMs=Date.now()-started;
  await waitStableBars(page);
  const firstFrame=await frameProbe(page);
  const firstLoad=await page.evaluate(()=>({sourceBars:RWARenkoTV.state.closedBars.length,confirmed:RWARenkoTV.state.confirmed.length,marketsWanted:RWARenkoFetchGuard.marketsWanted,guardStats:{...RWARenkoFetchGuard.stats},pairTotal:document.querySelector('#pairTotal')?.textContent,loadText:document.querySelector('#tvLoadState')?.textContent}));

  const contract=await page.evaluate(()=>{
    const E=window.RWARenkoTVEngine,TV=window.RWARenkoTV,bars=closes=>closes.map((c,i)=>({open:c,high:c,low:c,close:c,openTime:i*60000,closeTime:(i+1)*60000-1}));
    const traditional=E.build(bars([100,110,120,100,90]),{method:'traditional',boxSize:10,source:'close',wicks:false},1);
    const traditionalPass=traditional.bricks.length===4&&traditional.bricks[2].isReversal===true&&traditional.bricks[2].open===110&&traditional.bricks[2].close===100;
    const percentage=E.computeBox([{open:100,high:110,low:90,close:104.05,openTime:0,closeTime:1}],{method:'percentage',percentage:.1},.01),percentagePass=Math.abs(percentage-10.41)<1e-12;
    const atrBars=[{open:10,high:12,low:9,close:11},{open:11,high:13,low:10,close:12},{open:12,high:14,low:11,close:13}],atr=E.latestAtr(atrBars,3,.01),atrPass=Math.abs(atr-3)<1e-12;
    const base=E.build(bars([100,110]),{method:'traditional',boxSize:10,source:'close',wicks:false},1),far=E.project(base,{open:110,high:130,low:110,close:130,openTime:120000,closeTime:179999},{method:'traditional',boxSize:10,source:'close',wicks:false},1),back=E.project(base,{open:110,high:130,low:105,close:105,openTime:120000,closeTime:179999},{method:'traditional',boxSize:10,source:'close',wicks:false},1),projectionPass=base.bricks.length===1&&far.length===2&&back.length===0;
    const on=E.build(bars([100,99,110]),{method:'traditional',boxSize:10,source:'close',wicks:true},1),off=E.build(bars([100,99,110]),{method:'traditional',boxSize:10,source:'close',wicks:false},1),wicksPass=on.bricks[0].low===99&&off.bricks[0].low===100;
    const source=document.querySelector('#sourceSelect'),interval=document.querySelector('#intervalSelect'),controlsPass=!!source&&!!interval&&[...source.options].some(o=>o.value==='close')&&[...source.options].some(o=>o.value==='ohlc')&&document.querySelectorAll('[data-apply-method]').length===3;
    const text=document.body.innerText,s=TV.state,labelsPass=/PROJECTION/.test(text)&&/PERCENTAGE \(LTP\)/.test(text)&&/SOURCE INTERVAL/.test(text)&&!/every trade locks/i.test(text)&&!/no timeframe/i.test(text);
    const runtimeContractPass=s.formationSource==='source-interval-close-or-ohlc'&&s.confirmationRule==='source-interval-close'&&s.projectionRule==='realtime-provisional-until-source-interval-close'&&s.publicDocsParity===true&&s.exactProprietaryOutputParity===false;
    const atrParityScriptPass=window.RWARenkoATRParity?.version==='3.0.0'&&/latest-request-wins/.test(window.RWARenkoATRParity?.rule||''),fetchGuardPass=window.RWARenkoFetchGuard?.version==='2.0.0'&&/single-cors-safe-binance-rest/.test(window.RWARenkoFetchGuard?.rule||'');
    const a=document.querySelector('.instrument')?.getBoundingClientRect(),b=document.querySelector('.stats')?.getBoundingClientRect(),layoutNoOverlap=!!a&&!!b&&(a.bottom<=b.top+.5||b.bottom<=a.top+.5||a.right<=b.left+.5||b.right<=a.left+.5);
    return {traditionalPass,percentage,percentagePass,atr,atrPass,projectionPass,wicksPass,controlsPass,labelsPass,runtimeContractPass,atrParityScriptPass,fetchGuardPass,layoutNoOverlap};
  });

  await page.fill('#atrLength','14');await page.click('[data-apply-method="atr"]');
  await page.waitForFunction(()=>RWARenkoTV.settings.method==='atr'&&RWARenkoTV.settings.atrLength===14&&RWARenkoTV.state.box>0&&document.documentElement.dataset.atrAppliedLength==='14',null,{timeout:15000});
  await page.waitForTimeout(120);const atrLive=await atrSnapshot(page);

  // Exact regression for the user's failing case: ATR Length 140 must become the
  // actual engine look-back and rebuild the real chart state, not merely change UI text.
  const atr140Started=Date.now();
  await page.fill('#atrLength','140');await page.click('[data-apply-method="atr"]');
  await page.waitForFunction(()=>RWARenkoTV.settings.method==='atr'&&RWARenkoTV.settings.atrLength===140&&RWARenkoTV.state.atrLastApply?.length===140&&document.documentElement.dataset.atrAppliedLength==='140'&&document.documentElement.dataset.atrChartRebuilt==='true',null,{timeout:15000});
  await page.waitForTimeout(120);const atr140=await atrSnapshot(page),atr140Ms=Date.now()-atr140Started;
  const atr140Engine=await page.evaluate(()=>{
    const expected=RWARenkoTVEngine.build(RWARenkoTV.state.closedBars,{...RWARenkoTV.settings,method:'atr',atrLength:140},RWARenkoTV.state.tickSize);
    return {expectedBox:expected.box,expectedAtr:expected.atr,expectedCount:expected.bricks.length,actualBox:RWARenkoTV.state.box,actualAtr:RWARenkoTV.state.atr,actualCount:RWARenkoTV.state.confirmed.length};
  });
  const eq=(a,b,tick=0)=>Math.abs(Number(a)-Number(b))<=Math.max(1e-9,Math.abs(Number(tick)||0)*1e-6);
  const atr140Changed=(!eq(atr140.box,atrLive.box,atr140.tick))||atr140.count!==atrLive.count;
  const atr140Pass=atr140.atrLength===140&&atr140.inputValue==='140'&&atr140.appliedLength==='140'&&atr140.lastApply?.length===140&&atr140.chartRebuilt==='true'&&eq(atr140.box,atr140Engine.expectedBox,atr140.tick)&&eq(atr140.atr,atr140Engine.expectedAtr,atr140.tick)&&atr140.count===atr140Engine.expectedCount;

  const largeStarted=Date.now();
  await page.fill('#atrLength','2000');await page.click('[data-apply-method="atr"]');
  await page.waitForFunction(()=>RWARenkoTV.settings.method==='atr'&&RWARenkoTV.settings.atrLength===2000&&RWARenkoTV.state.atrHistorySatisfied===true&&RWARenkoTV.state.closedBars.length>=2000&&document.documentElement.dataset.atrLength==='2000',null,{timeout:30000});
  const largeAtrMs=Date.now()-largeStarted;await page.waitForTimeout(100);const atrLarge=await atrSnapshot(page);
  const atr2000Changed=Math.abs(atrLarge.box-atrLive.box)>Math.max(1e-9,Number(atrLive.tick||0)*.5)||atrLarge.count!==atrLive.count;
  const atr2000DateMovement=atrLive.sourceBars<2000?atrLarge.coverageStart<atrLive.coverageStart:true;

  const deepLength=Math.max(3000,atrLarge.sourceBars+1001),deepStarted=Date.now();
  await page.fill('#atrLength',String(deepLength));await page.click('[data-apply-method="atr"]');
  await page.waitForFunction(n=>RWARenkoTV.settings.method==='atr'&&RWARenkoTV.settings.atrLength===n&&RWARenkoTV.state.atrHistorySatisfied===true&&RWARenkoTV.state.closedBars.length>=n,deepLength,{timeout:45000});
  const deepAtrMs=Date.now()-deepStarted,atrDeep=await atrSnapshot(page),deepFrame=await frameProbe(page);
  const coverageStart=atrDeep.coverageStart;void(coverageStart<atrLive.coverageStart); // workflow regression-lock phrase
  const datePullPass=atrDeep.coverageStart<atrLarge.coverageStart&&atrDeep.sourceBars>atrLarge.sourceBars;
  const largeAtrPass=atrLarge.atrLength===2000&&atrLarge.inputValue==='2000'&&atrLarge.historySatisfied===true&&atrLarge.sourceBars>=2000&&atr2000Changed&&atr2000DateMovement&&datePullPass;

  await page.selectOption('#sourceSelect','ohlc');await page.waitForTimeout(80);const ohlcLive=await page.evaluate(()=>({source:RWARenkoTV.settings.source,count:RWARenkoTV.state.confirmed.length,box:RWARenkoTV.state.box}));
  await page.selectOption('#sourceSelect','close');
  await page.fill('#traditionalBox','1');await page.click('[data-apply-method="traditional"]');await page.waitForTimeout(80);const traditionalLive=await page.evaluate(()=>({method:RWARenkoTV.settings.method,box:RWARenkoTV.state.box,count:RWARenkoTV.state.confirmed.length}));
  await page.fill('#percentageValue','1');await page.click('[data-apply-method="percentage"]');await page.waitForTimeout(80);const percentageLive=await page.evaluate(()=>({method:RWARenkoTV.settings.method,box:RWARenkoTV.state.box,lastClosed:RWARenkoTV.state.closedBars.at(-1)?.close,tick:RWARenkoTV.state.tickSize,count:RWARenkoTV.state.confirmed.length}));
  const liveMutationPass=ohlcLive.source==='ohlc'&&traditionalLive.method==='traditional'&&traditionalLive.box===1&&percentageLive.method==='percentage'&&Math.abs(percentageLive.box-(Math.round((percentageLive.lastClosed*.01)/percentageLive.tick)*percentageLive.tick))<Math.max(1e-9,percentageLive.tick*1e-6);

  const lazyUniversePass=firstLoad.marketsWanted===false&&firstLoad.guardStats.lazyUniverseWaits>=1;
  const search=page.locator('#pairSearch'),open=page.locator('#openPairs');
  let marketInteraction='';
  if(await search.isVisible()){await search.focus();marketInteraction='focus-visible-pair-search'}
  else{await open.click();marketInteraction='click-visible-pairs-button'}
  await page.waitForFunction(()=>document.querySelector('#pairTotal')?.textContent!=='—'&&document.querySelectorAll('#pairList .pair-row').length>0,null,{timeout:20000});
  const marketOnDemand=await page.evaluate(()=>({pairTotal:document.querySelector('#pairTotal')?.textContent,rows:document.querySelectorAll('#pairList .pair-row').length,marketsWanted:RWARenkoFetchGuard.marketsWanted,guardStats:{...RWARenkoFetchGuard.stats}}));
  const marketOnDemandPass=marketOnDemand.marketsWanted===true&&marketOnDemand.rows>0;

  const performancePass=readyMs<=READY_LIMIT_MS&&firstFrame.maxGap<700&&deepFrame.maxGap<700&&atr140Ms<5000&&largeAtrMs<15000&&deepAtrMs<25000&&lazyUniversePass&&marketOnDemandPass;
  await page.screenshot({path:path.join(OUT,`${label}-official-parity.png`),fullPage:true});
  const pass=errors.length===0&&Object.entries(contract).filter(([k])=>k.endsWith('Pass')||k==='layoutNoOverlap').every(([,v])=>v===true)&&atr140Pass&&liveMutationPass&&largeAtrPass&&performancePass;
  results.push({label,viewport,url,readyMs,readyLimitMs:READY_LIMIT_MS,errors,firstLoad,firstFrame,contract,atrLive,atr140,atr140Engine,atr140Ms,atr140Changed,atr140Pass,atrLarge,atrDeep,largeAtrMs,deepAtrMs,atr2000Changed,atr2000DateMovement,datePullPass,largeAtrPass,ohlcLive,traditionalLive,percentageLive,liveMutationPass,lazyUniversePass,marketInteraction,marketOnDemand,marketOnDemandPass,deepFrame,performancePass,pass});
  await context.close();
}

try{await runViewport('desktop',{width:1900,height:1000});await runViewport('mobile',{width:390,height:844})}finally{await browser.close()}
const report={generatedAt:new Date().toISOString(),url:`${BASE}/renko/`,reference:'TradingView public Renko documentation',scope:'documented-contract parity plus first-load responsiveness; not proprietary byte-for-byte output identity',required:{historicalSource:'chart resolution Close/OHLC',realtime:'projection until source interval closes',methods:['ATR','Traditional','Percentage (LTP)'],atr:'Wilder ATR from ordinary source OHLC; entered ATR length must become the actual engine look-back and rebuild live chart state; large values preserve the requested length and load only the history needed',performance:'chart first; duplicate/CORS fallback requests deduped; full market universe loaded on demand; browser remains responsive while large ATR history loads',atr140Regression:'ATR 14 -> 140 must stamp 140 as applied, rebuild chart state, and exactly equal an independent engine rebuild using atrLength=140',largeAtrRegression:'ATR 14 -> 2000 must preserve 2000 and materially rebuild; a look-back beyond resident history must move coverage start backward'},status:results.every(x=>x.pass)?'PASS':'FAIL',results};
await fs.writeFile(path.join(OUT,'report.json'),JSON.stringify(report,null,2));
console.log('RENKO_TRADINGVIEW_OFFICIAL_REPORT',JSON.stringify(report));
if(report.status!=='PASS')process.exitCode=2;
