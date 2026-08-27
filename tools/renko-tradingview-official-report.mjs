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

function intervalMs(v){return({'1s':1000,'1m':60000,'3m':180000,'5m':300000,'15m':900000,'30m':1800000,'1h':3600000,'4h':14400000,'1d':86400000})[v]||1000}
function mockKlines(url){
  const u=new URL(url),step=intervalMs(u.searchParams.get('interval')||'1s'),now=Date.now();
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
  await page.route('https://unpkg.com/lightweight-charts@5.1.0/dist/lightweight-charts.standalone.production.js',route=>route.fulfill({status:200,contentType:'application/javascript',body:`(()=>{let range={from:0,to:65};const handlers=[];const ts={subscribeVisibleLogicalRangeChange(fn){handlers.push(fn)},setVisibleLogicalRange(r){range=r;for(const fn of handlers)fn(r)},getVisibleLogicalRange(){return range}};const series=()=>({setData(){},createPriceLine(){return{applyOptions(){}}}});window.LightweightCharts={CandlestickSeries:{},createChart(){return{addSeries(){return series()},addCandlestickSeries(){return series()},applyOptions(){},timeScale(){return ts}}}}})();`}));
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
async function frameProbe(page,duration=700){
  return page.evaluate(ms=>new Promise(resolve=>{let last=performance.now(),maxGap=0,count=0,start=last;function tick(t){maxGap=Math.max(maxGap,t-last);last=t;count++;if(t-start>=ms)resolve({maxGap,count,duration:t-start});else requestAnimationFrame(tick)}requestAnimationFrame(tick)}),duration);
}
async function atrSnapshot(page){
  return page.evaluate(()=>({atrLength:RWARenkoTV.settings.atrLength,interval:RWARenkoTV.settings.interval,source:RWARenkoTV.settings.source,box:RWARenkoTV.state.box,atr:RWARenkoTV.state.atr,tick:RWARenkoTV.state.tickSize,count:RWARenkoTV.state.confirmed.length,sourceBars:RWARenkoTV.state.closedBars.length,inputValue:document.querySelector('#atrLength')?.value,appliedLength:document.documentElement.dataset.atrAppliedLength,chartRebuilt:document.documentElement.dataset.atrChartRebuilt,lastApply:RWARenkoTV.state.atrLastApply||null,badgeText:document.querySelector('.method[data-method="atr"] .method-title span')?.textContent}));
}

async function runViewport(label,viewport){
  const context=await browser.newContext({viewport,deviceScaleFactor:1});
  const page=await context.newPage();await installLocalMocks(page);
  const errors=[];
  page.on('pageerror',e=>errors.push(String(e?.message||e)));
  page.on('console',m=>{const t=m.text();if(m.type()==='error'&&!/Failed to load resource|WebSocket connection|Invalid language tag: en-US@posix/i.test(t))errors.push(t)});
  const started=Date.now(),url=`${BASE}/renko/?symbol=SOL&tvOfficialReport=1&ts=${Date.now()}`;
  await page.goto(url,{waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForFunction(()=>window.RWARenkoTV?.version==='1.0.0'&&window.RWARenkoATRParity?.version==='3.0.0'&&window.RWARenko1sCloseLock?.version==='1.0.0'&&window.RWARenkoATRInstant?.version==='2.0.0'&&window.RWARenkoTV?.state?.status==='live'&&window.RWARenkoTV?.state?.closedBars?.length>=100&&window.RWARenkoTV?.state?.box>0&&RWARenkoTV.settings.interval==='1s'&&RWARenkoTV.settings.source==='close',null,{timeout:60000});
  const readyMs=Date.now()-started,firstFrame=await frameProbe(page);

  const contract=await page.evaluate(()=>{
    const E=window.RWARenkoTVEngine,TV=window.RWARenkoTV,bars=closes=>closes.map((c,i)=>({open:c,high:c,low:c,close:c,openTime:i*1000,closeTime:(i+1)*1000-1}));
    const traditional=E.build(bars([100,110,120,100,90]),{method:'traditional',boxSize:10,source:'close',wicks:false},1);
    const traditionalPass=traditional.bricks.length===4&&traditional.bricks[2].isReversal===true&&traditional.bricks[2].open===110&&traditional.bricks[2].close===100;
    const percentage=E.computeBox([{open:100,high:110,low:90,close:104.05}],{method:'percentage',percentage:.1},.01),percentagePass=Math.abs(percentage-10.41)<1e-12;
    const atr=E.latestAtr([{open:10,high:12,low:9,close:11},{open:11,high:13,low:10,close:12},{open:12,high:14,low:11,close:13}],3,.01),atrPass=Math.abs(atr-3)<1e-12;
    const base=E.build(bars([100,110]),{method:'traditional',boxSize:10,source:'close',wicks:false},1),far=E.project(base,{open:110,high:130,low:110,close:130,openTime:2000,closeTime:2999},{method:'traditional',boxSize:10,source:'close',wicks:false},1),back=E.project(base,{open:110,high:130,low:105,close:105,openTime:2000,closeTime:2999},{method:'traditional',boxSize:10,source:'close',wicks:false},1),projectionPass=base.bricks.length===1&&far.length===2&&back.length===0;
    const on=E.build(bars([100,99,110]),{method:'traditional',boxSize:10,source:'close',wicks:true},1),off=E.build(bars([100,99,110]),{method:'traditional',boxSize:10,source:'close',wicks:false},1),wicksPass=on.bricks[0].low===99&&off.bricks[0].low===100;
    const grid=document.querySelector('.source-grid'),sourceCtl=document.querySelector('#sourceSelect'),intervalCtl=document.querySelector('#intervalSelect');
    const controlsHiddenPass=!!grid?.hidden&&(!sourceCtl||sourceCtl.offsetParent===null)&&(!intervalCtl||intervalCtl.offsetParent===null);
    const fixedSourcePass=TV.settings.interval==='1s'&&TV.settings.source==='close'&&TV.state.fixedSourceProfile===true&&TV.state.formationSource==='fixed-1s-close'&&TV.state.confirmationRule==='1s-close'&&controlsHiddenPass;
    const text=document.body.innerText,labelsPass=/1s CLOSE/i.test(text)&&/PROJECTION/.test(text)&&/PERCENTAGE \(LTP\)/.test(text)&&!/every trade locks/i.test(text)&&!/tick-native chart/i.test(text);
    const publicContractPass=TV.state.publicDocsParity===true&&TV.state.exactProprietaryOutputParity===false&&window.RWARenkoTVEngine?.contract==='tradingview-public-documentation-compatible';
    const atrParityScriptPass=window.RWARenkoATRParity?.version==='3.0.0'&&/latest-request-wins/.test(window.RWARenkoATRParity?.rule||'');
    const deepCachePass=window.RWARenkoATRInstant?.version==='2.0.0'&&JSON.stringify(window.RWARenkoATRInstant?.targets)==='[1,10,100,1000,10000,100000,1000000]';
    return {traditionalPass,percentagePass,atrPass,projectionPass,wicksPass,controlsHiddenPass,fixedSourcePass,labelsPass,publicContractPass,atrParityScriptPass,deepCachePass};
  });

  await page.fill('#atrLength','14');await page.click('[data-apply-method="atr"]');
  await page.waitForFunction(()=>RWARenkoTV.settings.method==='atr'&&RWARenkoTV.settings.atrLength===14&&document.documentElement.dataset.atrAppliedLength==='14',null,{timeout:15000});
  await page.waitForTimeout(80);const atr14=await atrSnapshot(page);
  await page.fill('#atrLength','140');await page.click('[data-apply-method="atr"]');
  await page.waitForFunction(()=>RWARenkoTV.settings.method==='atr'&&RWARenkoTV.settings.atrLength===140&&RWARenkoTV.state.atrLastApply?.length===140&&document.documentElement.dataset.atrAppliedLength==='140',null,{timeout:15000});
  await page.waitForTimeout(80);const atr140=await atrSnapshot(page);
  const atrEngine=await page.evaluate(()=>{const x=RWARenkoTVEngine.build(RWARenkoTV.state.closedBars,{...RWARenkoTV.settings,method:'atr',atrLength:140},RWARenkoTV.state.tickSize);return{box:x.box,atr:x.atr,count:x.bricks.length}});
  const eq=(a,b,tick=0)=>Math.abs(Number(a)-Number(b))<=Math.max(1e-9,Math.abs(Number(tick)||0)*1e-6);
  const atr140Pass=atr140.interval==='1s'&&atr140.source==='close'&&atr140.atrLength===140&&atr140.inputValue==='140'&&atr140.lastApply?.length===140&&eq(atr140.box,atrEngine.box,atr140.tick)&&eq(atr140.atr,atrEngine.atr,atr140.tick)&&atr140.count===atrEngine.count;

  await page.fill('#traditionalBox','1');await page.click('[data-apply-method="traditional"]');await page.waitForTimeout(80);
  const traditionalLive=await page.evaluate(()=>({method:RWARenkoTV.settings.method,interval:RWARenkoTV.settings.interval,source:RWARenkoTV.settings.source,box:RWARenkoTV.state.box}));
  await page.fill('#percentageValue','1');await page.click('[data-apply-method="percentage"]');await page.waitForTimeout(80);
  const percentageLive=await page.evaluate(()=>({method:RWARenkoTV.settings.method,interval:RWARenkoTV.settings.interval,source:RWARenkoTV.settings.source,box:RWARenkoTV.state.box,lastClosed:RWARenkoTV.state.closedBars.at(-1)?.close,tick:RWARenkoTV.state.tickSize}));
  const methodSwitchPass=traditionalLive.method==='traditional'&&traditionalLive.interval==='1s'&&traditionalLive.source==='close'&&traditionalLive.box===1&&percentageLive.method==='percentage'&&percentageLive.interval==='1s'&&percentageLive.source==='close'&&Math.abs(percentageLive.box-(Math.round((percentageLive.lastClosed*.01)/percentageLive.tick)*percentageLive.tick))<Math.max(1e-9,percentageLive.tick*1e-6);

  const firstLoad=await page.evaluate(()=>({marketsWanted:RWARenkoFetchGuard?.marketsWanted,guardStats:{...(RWARenkoFetchGuard?.stats||{})},pairTotal:document.querySelector('#pairTotal')?.textContent}));
  const lazyUniversePass=firstLoad.marketsWanted===false;
  const search=page.locator('#pairSearch'),open=page.locator('#openPairs');
  if(await search.isVisible())await search.focus();else await open.click();
  await page.waitForFunction(()=>document.querySelector('#pairTotal')?.textContent!=='—'&&document.querySelectorAll('#pairList .pair-row').length>0,null,{timeout:20000});
  const marketOnDemand=await page.evaluate(()=>({rows:document.querySelectorAll('#pairList .pair-row').length,marketsWanted:RWARenkoFetchGuard?.marketsWanted}));
  const marketOnDemandPass=marketOnDemand.marketsWanted===true&&marketOnDemand.rows>0;

  const performancePass=readyMs<=READY_LIMIT_MS&&firstFrame.maxGap<700&&lazyUniversePass&&marketOnDemandPass;
  await page.screenshot({path:path.join(OUT,`${label}-official-parity.png`),fullPage:true});
  const pass=errors.length===0&&Object.entries(contract).filter(([k])=>k.endsWith('Pass')).every(([,v])=>v===true)&&atr140Pass&&methodSwitchPass&&performancePass;
  results.push({label,viewport,url,readyMs,readyLimitMs:READY_LIMIT_MS,errors,contract,atr14,atr140,atrEngine,atr140Pass,traditionalLive,percentageLive,methodSwitchPass,firstLoad,lazyUniversePass,marketOnDemand,marketOnDemandPass,firstFrame,performancePass,pass});
  await context.close();
}

try{await runViewport('desktop',{width:1900,height:1000});await runViewport('mobile',{width:390,height:844})}finally{await browser.close()}
const report={generatedAt:new Date().toISOString(),url:`${BASE}/renko/`,reference:'TradingView public Renko documentation',scope:'public Renko calculation contract with product source fixed to Binance 1-second CLOSED-kline Close; no user-selectable timeframe; not proprietary byte-for-byte output identity',required:{fixedSource:'1s Close only; source/timeframe controls hidden and runtime-locked',realtime:'projection until each 1-second source kline closes',methods:['ATR','Traditional','Percentage (LTP)'],atr:'Wilder ATR from ordinary 1-second OHLC source candles; Renko formation consumes their Close values',deepAtr:'1,10,100,1000,10000,100000,1000000 are separately production-gated by RENKO ATR Zero Blocking Gate',performance:'chart first; market universe remains lazy; fixed-source browser stays responsive'},status:results.every(x=>x.pass)?'PASS':'FAIL',results};
await fs.writeFile(path.join(OUT,'report.json'),JSON.stringify(report,null,2));
console.log('RENKO_TRADINGVIEW_OFFICIAL_REPORT',JSON.stringify(report));
if(report.status!=='PASS')process.exitCode=2;
