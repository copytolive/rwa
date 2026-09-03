import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';

const BASE=(process.env.RWA_TEST_URL||'http://127.0.0.1:8080/rwa').replace(/\/$/,'');
const OUT=path.resolve('artifacts/renko-observable-parity');
await fs.mkdir(OUT,{recursive:true});
const lw=await fs.readFile(path.resolve('node_modules/lightweight-charts/dist/lightweight-charts.standalone.production.js'),'utf8');
const browser=await chromium.launch({headless:true});
const results=[];
const STEP=1000;

function mockKlines(url){
  const u=new URL(url),now=Date.now(),rawEnd=u.searchParams.get('endTime'),requestedEnd=rawEnd===null?NaN:Number(rawEnd),end=Number.isFinite(requestedEnd)?requestedEnd:now-STEP*2,lastOpen=Math.floor((end-STEP+1)/STEP)*STEP,rows=[];
  for(let j=999;j>=0;j--){
    const t=lastOpen-j*STEP,idx=Math.floor(t/STEP),base=100+Math.sin(idx/19)*2.8+Math.sin(idx/61)*1.1,open=base+Math.sin(idx/5)*.12,close=base+Math.sin(idx/7)*.18,high=Math.max(open,close)+.35,low=Math.min(open,close)-.31;
    rows.push([t,String(open),String(high),String(low),String(close),'100',t+999,'0',1,'0','0','0']);
  }
  return rows;
}

async function installMocks(page){
  await page.route('https://unpkg.com/lightweight-charts@5.1.0/dist/lightweight-charts.standalone.production.js',r=>r.fulfill({status:200,contentType:'application/javascript',body:lw}));
  await page.addInitScript(()=>{
    try{localStorage.setItem('rwa_renko_tradingview_settings_v1',JSON.stringify({interval:'1d',source:'close',method:'atr',atrLength:14}))}catch{}
    class FakeWebSocket{constructor(url){this.url=url;this.readyState=0;setTimeout(()=>{this.readyState=1;this.onopen?.({type:'open'})},15)}send(){}close(){this.readyState=3;this.onclose?.({type:'close'})}}
    window.WebSocket=FakeWebSocket;
  });
  await page.route('**/api/v3/**',async r=>{
    const u=new URL(r.request().url()),p=u.pathname,symbol=u.searchParams.get('symbol');
    if(p.endsWith('/klines'))return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(symbol==='GOLD20Y'?[]:mockKlines(u.href))});
    if(p.endsWith('/exchangeInfo')){
      const names=symbol?[symbol]:['SOLUSDT','BTCUSDT','ETHUSDT','XRPUSDT','BNBUSDT','DOGEUSDT'];
      return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({symbols:names.map(s=>({symbol:s,status:'TRADING',baseAsset:s.replace(/USDT$/,''),quoteAsset:'USDT',isSpotTradingAllowed:true,filters:[{filterType:'PRICE_FILTER',tickSize:'0.01'}]}))})});
    }
    if(p.endsWith('/ticker/price'))return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({symbol:symbol||'SOLUSDT',price:'216.00'})});
    if(p.endsWith('/ticker/24hr'))return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(['SOLUSDT','BTCUSDT','ETHUSDT','XRPUSDT','BNBUSDT','DOGEUSDT'].map((s,i)=>({symbol:s,lastPrice:String(100+i),priceChangePercent:String(i/10),quoteVolume:String(1000000-i*10000)})))});
    return r.continue();
  });
}

function collectErrors(page){
  const errors=[];
  page.on('pageerror',e=>errors.push(String(e?.message||e)));
  page.on('console',m=>{const t=m.text();if(m.type()==='error'&&!/Failed to load resource|WebSocket|Invalid language tag/i.test(t))errors.push(t)});
  return errors;
}

async function fixtureRun(label,viewport){
  const context=await browser.newContext({viewport,deviceScaleFactor:1}),page=await context.newPage();
  await installMocks(page);
  const errors=collectErrors(page),url=`${BASE}/renko/?fixture=gold20y&parityBrowser=4&ts=${Date.now()}`;
  await page.goto(url,{waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForFunction(()=>window.RWARenkoTV?.state?.status==='live'&&document.documentElement.dataset.renkoParityFixtureReady==='true',null,{timeout:60000});
  await page.waitForTimeout(500);
  const snap=()=>page.evaluate(()=>({count:RWARenkoTV.state.confirmed.length,box:RWARenkoTV.state.box,method:RWARenkoTV.settings.method,source:RWARenkoTV.settings.source,interval:RWARenkoTV.settings.interval,sourceBars:RWARenkoTV.state.closedBars.length,fixtureBars:RENKO_GOLD20Y_FIXTURE.bars.length,spanYears:Number(document.documentElement.dataset.renkoParityFixtureSpanYears),coverage:document.querySelector('#tvCoverage')?.textContent,pair:document.querySelector('#pairName')?.textContent,sourceText:document.querySelector('#sourceText')?.textContent,sourceVisible:!!document.querySelector('#sourceSelect'),intervalExists:!!document.querySelector('#intervalSelect'),profile:window.RENKO_PARITY_PROFILE,fixture:window.RENKO_GOLD20Y_FIXTURE?.fixture?.schema,ready:document.documentElement.dataset.renkoParityFixtureReady}));
  const applyTraditional=async(box,count)=>{
    await page.fill('#traditionalBox',String(box));
    await page.click('[data-apply-method="traditional"]');
    await page.waitForFunction(({box,count})=>RWARenkoTV.settings.method==='traditional'&&RWARenkoTV.state.box===box&&RWARenkoTV.state.confirmed.length===count,{box,count},{timeout:10000});
    await page.waitForTimeout(120);
    return snap();
  };
  const initial=await snap();
  const s800=await applyTraditional(800,6);
  const s900=await applyTraditional(900,5);
  const s1000=await applyTraditional(1000,5);
  const s1200=await applyTraditional(1200,4);
  const final=await applyTraditional(900,5);
  await page.waitForTimeout(130);
  await page.screenshot({path:path.join(OUT,`gold20y-${label}.png`),fullPage:true});
  const pure=x=>x.sourceBars===x.fixtureBars&&x.ready==='true'&&x.interval==='1s'&&!x.intervalExists;
  const fixtureIdentity=x=>x.fixture==='renko-gold-long-history-visual-fixture-v1'&&x.source==='close'&&x.interval==='1s'&&x.spanYears>=20&&x.sourceVisible&&!x.intervalExists&&x.profile?.observableParity===true&&pure(x);
  const pass=errors.length===0&&initial.method==='traditional'&&fixtureIdentity(initial)&&s800.count===6&&s800.box===800&&fixtureIdentity(s800)&&s900.count===5&&s900.box===900&&fixtureIdentity(s900)&&s1000.count===5&&s1000.box===1000&&fixtureIdentity(s1000)&&s1200.count===4&&s1200.box===1200&&fixtureIdentity(s1200)&&final.count===5&&final.box===900&&fixtureIdentity(final)&&/SOURCE RANGE 2002/.test(final.coverage||'')&&/2026/.test(final.coverage||'')&&/20Y PARITY WITNESS/.test(final.pair||'');
  results.push({kind:'gold20y',label,viewport,url,errors,initial,witnessMatrix:{s800,s900,s1000,s1200,final900:final},pass});
  await context.close();
}

async function modelRun(label,viewport){
  const context=await browser.newContext({viewport,deviceScaleFactor:1}),page=await context.newPage();
  await installMocks(page);
  const errors=collectErrors(page),url=`${BASE}/renko/?symbol=SOL&parityModel=4&ts=${Date.now()}`;
  await page.goto(url,{waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForFunction(()=>window.RWARenkoTV?.state?.status==='live'&&window.RWARenkoTVEngine?.version==='1.4.0-fixed-1s'&&window.RWARenkoPercentageLTP?.version==='1.0.0'&&window.RWARenkoTV?.settings?.interval==='1s'&&window.RWARenkoTV?.state?.box>0,null,{timeout:60000});

  const contract=await page.evaluate(()=>{
    const E=RWARenkoTVEngine;
    const b=[{openTime:0,closeTime:999,open:216,high:216,low:216,close:216}],pct=E.computeBox(b,{method:'percentage',percentage:.01},.01);
    const base=E.build([{openTime:0,closeTime:999,open:100,high:100,low:100,close:100},{openTime:1000,closeTime:1999,open:100,high:111,low:99,close:110}],{method:'traditional',boxSize:10,source:'close',wicks:true},1);
    const proj=E.project(base,{openTime:2000,closeTime:2999,open:110,high:131,low:109,close:130},{method:'traditional',boxSize:10,source:'close',wicks:true},1);
    const percentageCard=document.querySelector('.method[data-method="percentage"]'),percentageButton=document.querySelector('[data-apply-method="percentage"]');
    const percentageUiHidden=!!percentageCard&&getComputedStyle(percentageCard).display==='none'&&!!percentageButton&&!percentageButton.getClientRects().length;
    RWARenkoTV.settings.interval='5m';
    return{percentageBox:pct,percentagePass:Math.abs(pct-2)<1e-12,percentageUiHidden,projectionCount:proj.length,projectionSeparate:proj.every(x=>x.projection===true),sourceVisible:!!document.querySelector('#sourceSelect'),intervalExists:!!document.querySelector('#intervalSelect'),mutationLock:RWARenkoTV.settings.interval,fixedInterval:window.RENKO_FIXED_INTERVAL};
  });

  await page.selectOption('#sourceSelect','ohlc');
  await page.waitForFunction(()=>RWARenkoTV.settings.source==='ohlc'&&RWARenkoTV.settings.interval==='1s'&&RWARenkoTV.state.status==='live',null,{timeout:15000});
  await page.waitForTimeout(350);
  const percentageEngine=await page.evaluate(()=>{
    let ltp=Number(RWARenkoTV.state.percentageLtpSnapshot);
    if(!(ltp>0))ltp=Number(RWARenkoPercentageLTP.snapshotFor(RWARenkoTV));
    const tick=Number(RWARenkoTV.state.tickSize)||.01;
    const card=document.querySelector('.method[data-method="percentage"]'),button=document.querySelector('[data-apply-method="percentage"]');
    return{ltp,lastClosed:Number(RWARenkoTV.state.closedBars.at(-1)?.close),tick,expectedBox:RWARenkoTVEngine.percentageLtpStableRound(ltp*.01,tick),cardPresent:!!card,cardVisible:!!card&&!!card.getClientRects().length,buttonPresent:!!button,buttonVisible:!!button&&!!button.getClientRects().length};
  });
  if(!(percentageEngine.ltp>0&&percentageEngine.expectedBox>0))errors.push(`percentage engine snapshot unavailable: ${JSON.stringify(percentageEngine)}`);

  const ui=await page.evaluate(()=>({source:RWARenkoTV.settings.source,interval:RWARenkoTV.settings.interval,sourceValue:document.querySelector('#sourceSelect')?.value,intervalExists:!!document.querySelector('#intervalSelect'),method:RWARenkoTV.settings.method,box:Number(RWARenkoTV.state.box),ltpSnapshot:Number(RWARenkoTV.state.percentageLtpSnapshot),lastClosed:Number(RWARenkoTV.state.closedBars.at(-1)?.close),tick:Number(RWARenkoTV.state.tickSize)||.01,publicDocsParity:RWARenkoTV.state.publicDocsParity,exactProprietaryOutputParity:RWARenkoTV.state.exactProprietaryOutputParity,profile:window.RENKO_PARITY_PROFILE}));
  await page.screenshot({path:path.join(OUT,`model-${label}.png`),fullPage:true});
  const percentageRemovedPass=contract.percentageUiHidden&&percentageEngine.cardPresent&&!percentageEngine.cardVisible&&percentageEngine.buttonPresent&&!percentageEngine.buttonVisible;
  const pass=errors.length===0&&contract.percentagePass&&percentageRemovedPass&&contract.projectionSeparate&&contract.sourceVisible&&!contract.intervalExists&&contract.mutationLock==='1s'&&contract.fixedInterval==='1s'&&ui.source==='ohlc'&&ui.interval==='1s'&&ui.sourceValue==='ohlc'&&!ui.intervalExists&&ui.method==='atr'&&ui.box>0&&ui.publicDocsParity===true&&ui.exactProprietaryOutputParity===false&&ui.profile?.observableParity===true;
  results.push({kind:'model',label,viewport,url,errors,contract,percentageEngine,percentageRemovedPass,ui,pass});
  await context.close();
}

try{
  await fixtureRun('desktop',{width:1900,height:1000});
  await fixtureRun('mobile',{width:390,height:844});
  await modelRun('desktop',{width:1900,height:1000});
  await modelRun('mobile',{width:390,height:844});
}finally{await browser.close()}

const report={schema:'renko-tradingview-observable-fixed-1s-browser-report-v4',generatedAt:new Date().toISOString(),base:BASE,status:results.every(x=>x.pass)?'PASS':'FAIL',results,claimBoundary:'Browser proof covers observable/documented behavior and official examples with production hard-locked to 1s. Percentage calculation compatibility remains engine-tested while the Percentage (LTP) user control is intentionally hidden on desktop and mobile. GOLD parity is asserted by explicit 800/900/1000/1200 box witness applications. TradingView proprietary source code and unpublished helpers are not available.'};
await fs.writeFile(path.join(OUT,'report.json'),JSON.stringify(report,null,2));
console.log('RENKO_OBSERVABLE_BROWSER_REPORT',JSON.stringify(report));
if(report.status!=='PASS')process.exitCode=2;
