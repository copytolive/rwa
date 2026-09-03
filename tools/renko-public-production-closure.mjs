import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';

const BASE=(process.env.RWA_TEST_URL||'https://copytolive.github.io/rwa').replace(/\/$/,'');
const OUT=path.resolve('artifacts/renko-public-production-closure');
await fs.mkdir(OUT,{recursive:true});
const lw=await fs.readFile(path.resolve('node_modules/lightweight-charts/dist/lightweight-charts.standalone.production.js'),'utf8');
const browser=await chromium.launch({headless:true});
const results=[];
const INTERVAL_MS={'1s':1000,'1m':60000,'3m':180000,'5m':300000,'15m':900000,'30m':1800000,'1h':3600000,'4h':14400000,'1d':86400000};

function rowsFor(url){
  const u=new URL(url),interval=u.searchParams.get('interval')||'1m',step=INTERVAL_MS[interval]||60000,now=Date.now();
  const rawEnd=u.searchParams.get('endTime'),rawStart=u.searchParams.get('startTime');
  const requestedEnd=rawEnd===null?NaN:Number(rawEnd),requestedStart=rawStart===null?NaN:Number(rawStart);
  let end=Number.isFinite(requestedEnd)?requestedEnd:now-step*2;
  if(Number.isFinite(requestedStart)&&!Number.isFinite(requestedEnd))end=requestedStart+999*step+step-1;
  const lastOpen=Math.floor((end-step+1)/step)*step,rows=[];
  for(let j=999;j>=0;j--){
    const t=lastOpen-j*step,idx=Math.floor(t/step),base=100+Math.sin(idx/19)*2.8+Math.sin(idx/61)*1.1;
    const open=base+Math.sin(idx/5)*.12,close=base+Math.sin(idx/7)*.18;
    const high=Math.max(open,close)+.65+Math.abs(Math.sin(idx/11))*.25;
    const low=Math.min(open,close)-.61-Math.abs(Math.cos(idx/13))*.25;
    rows.push([t,String(open),String(high),String(low),String(close),'100',t+step-1,'0',1,'0','0','0']);
  }
  return rows;
}

async function installMocks(page,{ladderMode=false}={}){
  const klineRequests=[];
  const oldCounts=new Map();
  let initial1mOldest=0;
  await page.route('https://unpkg.com/lightweight-charts@5.1.0/dist/lightweight-charts.standalone.production.js',r=>r.fulfill({status:200,contentType:'application/javascript',body:lw}));
  await page.addInitScript(()=>{
    window.__renkoFakeSockets=[];
    class FakeWebSocket{
      constructor(url){this.url=url;this.readyState=0;window.__renkoFakeSockets.push(this);setTimeout(()=>{this.readyState=1;this.onopen?.({type:'open'})},15)}
      send(){}
      close(){this.readyState=3;this.onclose?.({type:'close'})}
    }
    FakeWebSocket.CONNECTING=0;FakeWebSocket.OPEN=1;FakeWebSocket.CLOSING=2;FakeWebSocket.CLOSED=3;
    window.WebSocket=FakeWebSocket;
  });
  await page.route('https://data-api.binance.vision/api/v3/**',async r=>{
    const u=new URL(r.request().url()),p=u.pathname,symbol=u.searchParams.get('symbol');
    if(p.endsWith('/klines')){
      const interval=u.searchParams.get('interval')||'1m',hasEnd=u.searchParams.has('endTime');
      klineRequests.push({interval,hasEnd,endTime:u.searchParams.get('endTime'),url:u.href});
      if(ladderMode&&hasEnd){
        const c=(oldCounts.get(interval)||0)+1;oldCounts.set(interval,c);
        if(interval==='1m')return r.fulfill({status:200,contentType:'application/json',body:'[]'});
        if(interval==='3m'&&c===1)return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(rowsFor(u.href))});
        return r.fulfill({status:200,contentType:'application/json',body:'[]'});
      }
      const rows=rowsFor(u.href);
      if(interval==='1m'&&!hasEnd&&rows.length)initial1mOldest=Number(rows[0][0]);
      return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(symbol==='GOLD20Y'?[]:rows)});
    }
    if(p.endsWith('/exchangeInfo')){
      const names=symbol?[symbol]:['SOLUSDT','BTCUSDT','ETHUSDT','XRPUSDT','BNBUSDT','DOGEUSDT'];
      return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({symbols:names.map(name=>({symbol:name,status:'TRADING',baseAsset:name.replace(/USDT$/,''),quoteAsset:'USDT',isSpotTradingAllowed:true,filters:[{filterType:'PRICE_FILTER',tickSize:'0.01'}]}))})});
    }
    if(p.endsWith('/ticker/price'))return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({symbol:symbol||'SOLUSDT',price:'216.00'})});
    if(p.endsWith('/ticker/24hr'))return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(['SOLUSDT','BTCUSDT','ETHUSDT','XRPUSDT','BNBUSDT','DOGEUSDT'].map((name,i)=>({symbol:name,lastPrice:String(100+i),priceChangePercent:String(i/10),quoteVolume:String(1000000-i*10000)}))) });
    return r.continue();
  });
  await page.route('https://api.binance.com/api/v3/**',r=>r.abort());
  return {klineRequests,get initial1mOldest(){return initial1mOldest}};
}

function collectErrors(page){
  const errors=[];
  page.on('pageerror',e=>errors.push(String(e?.message||e)));
  page.on('console',m=>{const t=m.text();if(m.type()==='error'&&!/Failed to load resource|WebSocket/i.test(t))errors.push(t)});
  return errors;
}

async function waitLive(page){
  await page.waitForFunction(()=>window.RWARenkoTV?.state?.status==='live'&&window.RWARenkoTVEngine?.version==='1.3.0'&&window.RWARenkoStableChart?.version==='2.0.0'&&window.RWARenkoHistoryLadder?.version==='1.0.1'&&window.RWARenkoPercentageLTP?.version==='1.0.0'&&window.RWARenkoATRParity?.version==='3.0.0',null,{timeout:60000});
}

async function modelStabilityRun(){
  const context=await browser.newContext({viewport:{width:1900,height:1000},deviceScaleFactor:1});
  const page=await context.newPage(),net=await installMocks(page),errors=collectErrors(page);
  const url=`${BASE}/renko/?symbol=SOL&publicClosure=1&ts=${Date.now()}`;
  await page.goto(url,{waitUntil:'domcontentloaded',timeout:60000});
  await waitLive(page);
  await page.waitForTimeout(900);
  await page.evaluate(()=>{
    const E=window.RWARenkoTVEngine,orig=E.build.bind(E);window.__renkoClosureBuildCalls=0;
    E.build=(...a)=>{window.__renkoClosureBuildCalls++;return orig(...a)};
  });
  const initial=await page.evaluate(()=>{
    const T=RWARenkoTV,E=RWARenkoTVEngine,b=T.state.closedBars,delta=b.length>1?b.at(-1).openTime-b.at(-2).openTime:0;
    const fp=JSON.stringify((T.state.confirmed||[]).slice(-24).map(x=>[x.open,x.high,x.low,x.close,x.direction]));
    return{source:T.settings.source,interval:T.settings.interval,generation:T.state.generation,delta,buildCalls:window.__renkoClosureBuildCalls,fp,audit:E.audit(T.state.confirmed),count:T.state.confirmed.length,stable:{...RWARenkoStableChart.stats}};
  });

  await page.selectOption('#sourceSelect','ohlc');
  await page.waitForFunction(()=>RWARenkoTV.settings.source==='ohlc'&&window.__renkoClosureBuildCalls>=1);
  await page.waitForTimeout(180);
  const afterSource=await page.evaluate(()=>{
    const T=RWARenkoTV,E=RWARenkoTVEngine;
    return{source:T.settings.source,interval:T.settings.interval,generation:T.state.generation,buildCalls:window.__renkoClosureBuildCalls,fp:JSON.stringify((T.state.confirmed||[]).slice(-24).map(x=>[x.open,x.high,x.low,x.close,x.direction])),audit:E.audit(T.state.confirmed),domSource:document.querySelector('#currentSource')?.textContent};
  });

  const genBeforeInterval=afterSource.generation,callsBeforeInterval=afterSource.buildCalls;
  await page.selectOption('#intervalSelect','5m');
  await page.waitForFunction(({g,c})=>RWARenkoTV.settings.interval==='5m'&&RWARenkoTV.state.status==='live'&&RWARenkoTV.state.generation>g&&window.__renkoClosureBuildCalls>c,{g:genBeforeInterval,c:callsBeforeInterval},{timeout:60000});
  await page.waitForTimeout(700);
  const afterInterval=await page.evaluate(()=>{
    const T=RWARenkoTV,b=T.state.closedBars,delta=b.length>1?b.at(-1).openTime-b.at(-2).openTime:0;
    return{source:T.settings.source,interval:T.settings.interval,generation:T.state.generation,buildCalls:window.__renkoClosureBuildCalls,delta,bars:b.length,lastOpen:b.at(-1)?.openTime,domInterval:document.querySelector('#currentInterval')?.textContent};
  });

  const beforePct=await page.evaluate(()=>({ltp:RWARenkoTV.state.percentageLtpSnapshot,lastClosed:RWARenkoTV.state.closedBars.at(-1)?.close}));
  await page.fill('#percentageValue','1');
  await page.click('[data-apply-method="percentage"]');
  await page.waitForFunction(()=>RWARenkoTV.settings.method==='percentage'&&Math.abs(RWARenkoTV.state.box-2)<1e-12,{},{timeout:30000});
  const percentage=await page.evaluate(()=>({method:RWARenkoTV.settings.method,box:RWARenkoTV.state.box,ltp:RWARenkoTV.state.percentageLtpSnapshot,lastClosed:RWARenkoTV.state.closedBars.at(-1)?.close,projectionLegend:!!document.querySelector('.legend-proj')}));

  await page.fill('#atrLength','1200');
  await page.click('[data-apply-method="atr"]');
  await page.waitForFunction(()=>RWARenkoTV.settings.method==='atr'&&RWARenkoTV.settings.atrLength===1200&&document.documentElement.dataset.atrAppliedLength==='1200'&&window.RWARenkoATRParity?.applying===false,null,{timeout:60000});
  await page.waitForTimeout(300);
  const atr=await page.evaluate(()=>({length:RWARenkoTV.settings.atrLength,requested:RWARenkoTV.state.atrRequestedLength,applied:RWARenkoTV.state.atrAppliedLength,satisfied:RWARenkoTV.state.atrHistorySatisfied,box:RWARenkoTV.state.box,atr:RWARenkoTV.state.atr,bars:RWARenkoTV.state.closedBars.length,chartRebuilt:document.documentElement.dataset.atrChartRebuilt,audit:RWARenkoTVEngine.audit(RWARenkoTV.state.confirmed)}));

  await page.waitForTimeout(500);
  const requestsBeforeReset=net.klineRequests.length;
  await page.click('#tvReset');await page.click('#tvReset');await page.click('#tvReset');
  await page.waitForTimeout(350);
  const requestsAfterReset=net.klineRequests.length;

  await page.click('#tvZoomOut');await page.click('#tvPanOlder');await page.waitForTimeout(120);
  const beforeHeartbeat=await page.evaluate(()=>({...RWARenkoStableChart.stats}));
  await page.evaluate(()=>{
    const T=RWARenkoTV,s=window.__renkoFakeSockets.at(-1),last=T.state.closedBars.at(-1),step=({ '1s':1000,'1m':60000,'3m':180000,'5m':300000,'15m':900000,'30m':1800000,'1h':3600000,'4h':14400000,'1d':86400000})[T.settings.interval]||60000,p=Number(last?.close||100),t=Number(last?.closeTime||Date.now())+1;
    const ev={e:'kline',k:{t,T:t+step-1,o:String(p),h:String(p),l:String(p),c:String(p),v:'1',x:false}};
    for(let i=0;i<3;i++)s?.onmessage?.({data:JSON.stringify(ev)});
  });
  await page.waitForTimeout(220);
  const afterHeartbeat=await page.evaluate(()=>({...RWARenkoStableChart.stats}));
  await page.waitForTimeout(500);
  const settled=await page.evaluate(()=>({...RWARenkoStableChart.stats}));

  const synthetic=await page.evaluate(()=>{
    const E=RWARenkoTVEngine;
    const bars=[
      {openTime:0,closeTime:999,open:100,high:100,low:100,close:100},
      {openTime:1000,closeTime:1999,open:100,high:111,low:99,close:110},
      {openTime:2000,closeTime:2999,open:110,high:111,low:89,close:90},
      {openTime:3000,closeTime:3999,open:90,high:101,low:89,close:100}
    ];
    const close=E.build(bars,{method:'traditional',boxSize:10,source:'close',wicks:true},1),ohlc=E.build(bars,{method:'traditional',boxSize:10,source:'ohlc',wicks:true},1);
    const proj=E.project(close,{openTime:4000,closeTime:4999,open:100,high:131,low:99,close:130},{method:'traditional',boxSize:10,source:'close',wicks:true},1);
    return{closeAudit:E.audit(close.bricks),ohlcAudit:E.audit(ohlc.bricks),projectionCount:proj.length,projectionSeparate:proj.every(x=>x.projection===true)};
  });

  await page.screenshot({path:path.join(OUT,'public-stability-desktop.png'),fullPage:true});
  const checks={
    sourceControlRebuild:afterSource.buildCalls>initial.buildCalls&&afterSource.source==='ohlc',
    sourceGeometryRebuilt:afterSource.fp!==initial.fp,
    sourceNoGenerationSwap:afterSource.generation===initial.generation,
    intervalReloaded:afterInterval.generation>genBeforeInterval&&afterInterval.buildCalls>callsBeforeInterval&&afterInterval.interval==='5m',
    intervalFreshBars:afterInterval.delta===INTERVAL_MS['5m']&&afterInterval.domInterval==='5m',
    percentageOfficialExample:percentage.box===2&&percentage.ltp===216&&Math.abs(Number(beforePct.lastClosed)-216)>1,
    percentageLtpSeparated:Math.abs(Number(beforePct.ltp)-216)<1e-12&&Math.abs(Number(percentage.lastClosed)-216)>1,
    atrUnclamped:atr.length===1200&&atr.requested===1200&&atr.applied===1200,
    atrRawPositive:atr.atr>0&&Math.abs(Number(atr.box)-Number(atr.atr))<1e-12,
    atrHistorySatisfied:atr.satisfied===true&&atr.bars>=1200&&atr.chartRebuilt==='true',
    continuationReversalWicks:!!synthetic.closeAudit?.continuation&&!!synthetic.closeAudit?.reversal&&!!synthetic.closeAudit?.wicksDirectional&&!!synthetic.ohlcAudit?.wicksDirectional,
    projectionSeparate:synthetic.projectionCount>0&&synthetic.projectionSeparate===true&&percentage.projectionLegend,
    heartbeatSuppressed:afterHeartbeat.partialSuppressed>=beforeHeartbeat.partialSuppressed+3,
    heartbeatNoDataWrite:afterHeartbeat.dataWrites===beforeHeartbeat.dataWrites,
    heartbeatNoRangeSnapback:afterHeartbeat.rangeWrites===beforeHeartbeat.rangeWrites&&settled.rangeWrites===afterHeartbeat.rangeWrites,
    programmaticRangeCallbacksSuppressed:afterHeartbeat.programmaticRangeCallbacksSuppressed>=1,
    noRepeatedOldHistoryFromReset:requestsAfterReset===requestsBeforeReset
  };
  const pass=errors.length===0&&Object.values(checks).every(Boolean);
  const result={kind:'public-model-stability',url,errors,initial,afterSource,afterInterval,beforePct,percentage,atr,beforeHeartbeat,afterHeartbeat,settled,synthetic,requestsBeforeReset,requestsAfterReset,klineRequests:net.klineRequests,checks,pass};
  results.push(result);await context.close();
}

async function historyLadderRun(){
  const context=await browser.newContext({viewport:{width:1900,height:1000},deviceScaleFactor:1});
  const page=await context.newPage(),net=await installMocks(page,{ladderMode:true}),errors=collectErrors(page);
  const url=`${BASE}/renko/?symbol=SOL&publicClosure=ladder&ts=${Date.now()}`;
  await page.goto(url,{waitUntil:'domcontentloaded',timeout:60000});
  await waitLive(page);
  await page.waitForFunction(()=>Array.isArray(RWARenkoTV.state.historyLadderTiers)&&RWARenkoTV.state.historyLadderTiers.includes('3m')&&!RWARenkoHistoryLadder.busy,null,{timeout:30000});
  await page.waitForTimeout(250);
  const snap=await page.evaluate(()=>{
    const T=RWARenkoTV,L=RWARenkoHistoryLadder,b=T.state.closedBars,older=b.filter(x=>x._renkoSourceInterval==='3m');
    return{selected:T.settings.interval,tiers:T.state.historyLadderTiers,active:T.state.historyLadderActive,oldestInterval:T.state.historyLadderOldestInterval,rule:T.state.historyLadderRule,dataset:document.documentElement.dataset.renkoHistoryLadder,coverage:L.coverage(T),ladder1s:L.ladder('1s'),ladder1m:L.ladder('1m'),ladder1h:L.ladder('1h'),olderCount:older.length,olderMaxClose:Math.max(0,...older.map(x=>Number(x.closeTime)||0)),firstOpen:Number(b[0]?.openTime)||0};
  });
  const checks={
    ladderFunctions:JSON.stringify(snap.ladder1s)===JSON.stringify(['1s','1m','3m','5m','15m','30m','1h'])&&JSON.stringify(snap.ladder1m)===JSON.stringify(['1m','3m','5m','15m','30m','1h','4h'])&&JSON.stringify(snap.ladder1h)===JSON.stringify(['1h','4h','1d']),
    fallbackActivated:snap.selected==='1m'&&snap.active===true&&snap.tiers[0]==='1m'&&snap.tiers.includes('3m')&&snap.dataset.includes('1m>3m'),
    higherTierTagged:snap.olderCount>0&&snap.oldestInterval==='3m',
    nonOverlap:snap.olderMaxClose>0&&net.initial1mOldest>0&&snap.olderMaxClose<net.initial1mOldest,
    olderHistoryExtended:snap.firstOpen<net.initial1mOldest&&snap.coverage.from===snap.firstOpen,
    documentedRule:snap.rule==='finest-selected-then-documented-higher-timeframes'
  };
  await page.screenshot({path:path.join(OUT,'public-history-ladder-desktop.png'),fullPage:true});
  const pass=errors.length===0&&Object.values(checks).every(Boolean);
  results.push({kind:'public-history-ladder',url,errors,initial1mOldest:net.initial1mOldest,klineRequests:net.klineRequests,snap,checks,pass});
  await context.close();
}

try{await modelStabilityRun();await historyLadderRun()}finally{await browser.close()}
const report={schema:'renko-public-production-closure-v1',generatedAt:new Date().toISOString(),base:BASE,targetSha:process.env.GITHUB_SHA||null,renkoMergeSha:'7b4146c5473e5042a288bf700db873b0c09d5d04',status:results.every(x=>x.pass)?'PASS':'FAIL',results,claimBoundary:'Public-production proof covers observable/documented Renko behavior, current public runtime assets, stability, history fallback, and official examples. It does not claim TradingView proprietary source-code identity.'};
await fs.writeFile(path.join(OUT,'closure-report.json'),JSON.stringify(report,null,2));
console.log('RENKO_PUBLIC_PRODUCTION_CLOSURE',JSON.stringify(report));
if(report.status!=='PASS')process.exitCode=2;
