import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';

const BASE=(process.env.RWA_TEST_URL||'https://copytolive.github.io/rwa/').replace(/\/$/,'');
const OUT=path.resolve('artifacts/renko-tv-official-report');
const READY_LIMIT_MS=8000;
const LOCAL=/^https?:\/\/(127\.0\.0\.1|localhost)(:|\/|$)/.test(BASE);
await fs.mkdir(OUT,{recursive:true});
const browser=await chromium.launch({headless:true});
const results=[];

function intervalMs(v){return({ '1s':1000,'1m':60000,'3m':180000,'5m':300000,'15m':900000,'30m':1800000,'1h':3600000,'4h':14400000,'1d':86400000 })[v]||60000}
function mockKlines(url){
  const u=new URL(url),step=intervalMs(u.searchParams.get('interval')||'1m'),now=Date.now();
  const requestedRaw=u.searchParams.get('endTime');
  const requested=requestedRaw===null?NaN:Number(requestedRaw);
  const end=Number.isFinite(requested)?requested:now-step*2;
  const lastOpen=Math.floor((end-step+1)/step)*step;
  const rows=[];
  for(let j=999;j>=0;j--){
    const openTime=lastOpen-j*step,idx=Math.floor(openTime/step),age=Math.max(0,(now-openTime)/step);
    const vol=age<250?6:age<1000?3:1.2;
    const open=100+Math.sin(idx/17)*8+Math.sin(idx/53)*4;
    const close=open+Math.sin(idx/7)*vol*.45;
    const high=Math.max(open,close)+vol;
    const low=Math.min(open,close)-vol;
    rows.push([openTime,String(open),String(high),String(low),String(close),'100',openTime+step-1,'0',1,'0','0','0']);
  }
  return rows;
}
async function installLocalMocks(page){
  if(!LOCAL)return;
  await page.addInitScript(()=>{
    class FakeWebSocket{
      constructor(url){this.url=url;this.readyState=0;setTimeout(()=>{this.readyState=1;this.onopen?.({type:'open'})},10)}
      close(){this.readyState=3;this.onclose?.({type:'close'})}
      send(){}
    }
    window.WebSocket=FakeWebSocket;
  });
  await page.route('https://unpkg.com/lightweight-charts@5.1.0/dist/lightweight-charts.standalone.production.js',route=>route.fulfill({status:200,contentType:'application/javascript',body:`(()=>{let range={from:0,to:65};const ts={subscribeVisibleLogicalRangeChange(){},setVisibleLogicalRange(r){range=r},getVisibleLogicalRange(){return range}};const series=()=>({setData(){},createPriceLine(o){return{applyOptions(){}}}});window.LightweightCharts={CandlestickSeries:{},createChart(){return{addSeries(){return series()},addCandlestickSeries(){return series()},applyOptions(){},timeScale(){return ts}}}}})();`}));
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

async function runViewport(label,viewport){
  const context=await browser.newContext({viewport,deviceScaleFactor:1});
  const page=await context.newPage();
  await installLocalMocks(page);
  const errors=[];
  page.on('pageerror',e=>errors.push(String(e?.message||e)));
  page.on('console',m=>{if(m.type()==='error'&&!/Failed to load resource|WebSocket connection/i.test(m.text()))errors.push(m.text())});
  const started=Date.now(),url=`${BASE}/renko/?symbol=SOL&tvOfficialReport=1&ts=${Date.now()}`;
  await page.goto(url,{waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForFunction(()=>window.RWARenkoTV?.version==='1.0.0'&&window.RWARenkoATRParity?.version==='1.0.0'&&window.RWARenkoTV?.state?.confirmed?.length>10&&window.RWARenkoTV?.state?.box>0&&document.querySelector('#tvLoadState')?.textContent?.includes('LIVE'),null,{timeout:60000});
  const readyMs=Date.now()-started;

  const contract=await page.evaluate(()=>{
    const E=window.RWARenkoTVEngine,TV=window.RWARenkoTV;
    const bars=closes=>closes.map((c,i)=>({open:c,high:c,low:c,close:c,openTime:i*60000,closeTime:(i+1)*60000-1}));
    const traditional=E.build(bars([100,110,120,100,90]),{method:'traditional',boxSize:10,source:'close',wicks:false},1);
    const traditionalPass=traditional.bricks.length===4&&traditional.bricks[0].open===100&&traditional.bricks[0].close===110&&traditional.bricks[2].isReversal===true&&traditional.bricks[2].open===110&&traditional.bricks[2].close===100;
    const percentage=E.computeBox([{open:100,high:110,low:90,close:104.05,openTime:0,closeTime:1}],{method:'percentage',percentage:.1},.01);
    const percentagePass=Math.abs(percentage-10.41)<1e-12;
    const atrBars=[{open:10,high:12,low:9,close:11},{open:11,high:13,low:10,close:12},{open:12,high:14,low:11,close:13}];
    const atr=E.latestAtr(atrBars,3,.01),atrPass=Math.abs(atr-3)<1e-12;
    const base=E.build(bars([100,110]),{method:'traditional',boxSize:10,source:'close',wicks:false},1);
    const projFar=E.project(base,{open:110,high:130,low:110,close:130,openTime:120000,closeTime:179999},{method:'traditional',boxSize:10,source:'close',wicks:false},1);
    const projBack=E.project(base,{open:110,high:130,low:105,close:105,openTime:120000,closeTime:179999},{method:'traditional',boxSize:10,source:'close',wicks:false},1);
    const projectionPass=base.bricks.length===1&&projFar.length===2&&projBack.length===0;
    const wickOn=E.build(bars([100,99,110]),{method:'traditional',boxSize:10,source:'close',wicks:true},1),wickOff=E.build(bars([100,99,110]),{method:'traditional',boxSize:10,source:'close',wicks:false},1);
    const wicksPass=wickOn.bricks[0].low===99&&wickOff.bricks[0].low===100;
    const ohlcPath=E.ohlcPath({open:100,high:108,low:90,close:105}),ohlcPass=ohlcPath[0]===100&&ohlcPath.at(-1)===105&&ohlcPath.includes(108)&&ohlcPath.includes(90);
    const source=document.querySelector('#sourceSelect'),interval=document.querySelector('#intervalSelect');
    const controlsPass=!!source&&!!interval&&[...source.options].some(o=>o.value==='close')&&[...source.options].some(o=>o.value==='ohlc')&&[...interval.options].some(o=>o.value==='1m')&&document.querySelectorAll('[data-apply-method]').length===3;
    const text=document.body.innerText;
    const labelsPass=/PROJECTION/.test(text)&&/PERCENTAGE \(LTP\)/.test(text)&&/SOURCE INTERVAL/.test(text)&&!/every trade locks/i.test(text)&&!/no timeframe/i.test(text);
    const s=TV.state;
    const runtimeContractPass=s.formationSource==='source-interval-close-or-ohlc'&&s.confirmationRule==='source-interval-close'&&s.projectionRule==='realtime-provisional-until-source-interval-close'&&s.publicDocsParity===true&&s.exactProprietaryOutputParity===false;
    const atrParityScriptPass=window.RWARenkoATRParity?.version==='1.0.0';
    const a=document.querySelector('.instrument')?.getBoundingClientRect(),b=document.querySelector('.stats')?.getBoundingClientRect();
    const layoutNoOverlap=!!a&&!!b&&(a.bottom<=b.top+.5||b.bottom<=a.top+.5||a.right<=b.left+.5||b.right<=a.left+.5);
    return {traditionalPass,percentage,percentagePass,atr,atrPass,projectionPass,projFar:projFar.length,projBack:projBack.length,wicksPass,ohlcPath,ohlcPass,controlsPass,labelsPass,runtimeContractPass,atrParityScriptPass,layoutNoOverlap,live:{symbol:s.symbol,interval:TV.settings.interval,source:TV.settings.source,method:TV.settings.method,box:s.box,atr:s.atr,confirmed:s.confirmed.length,projection:s.projection.length,sourceBars:s.closedBars.length,status:s.status},bodyText:text.slice(0,3000)};
  });

  await page.selectOption('#sourceSelect','ohlc');
  await page.waitForTimeout(100);
  const ohlcLive=await page.evaluate(()=>({source:RWARenkoTV.settings.source,count:RWARenkoTV.state.confirmed.length,box:RWARenkoTV.state.box}));
  await page.selectOption('#sourceSelect','close');
  await page.waitForTimeout(100);
  await page.fill('#traditionalBox','1');
  await page.click('[data-apply-method="traditional"]');
  await page.waitForTimeout(100);
  const traditionalLive=await page.evaluate(()=>({method:RWARenkoTV.settings.method,box:RWARenkoTV.state.box,count:RWARenkoTV.state.confirmed.length}));
  await page.fill('#percentageValue','1');
  await page.click('[data-apply-method="percentage"]');
  await page.waitForTimeout(100);
  const percentageLive=await page.evaluate(()=>({method:RWARenkoTV.settings.method,box:RWARenkoTV.state.box,lastClosed:RWARenkoTV.state.closedBars.at(-1)?.close,tick:RWARenkoTV.state.tickSize,count:RWARenkoTV.state.confirmed.length}));

  await page.fill('#atrLength','14');
  await page.click('[data-apply-method="atr"]');
  await page.waitForFunction(()=>RWARenkoTV.settings.method==='atr'&&RWARenkoTV.settings.atrLength===14&&RWARenkoTV.state.box>0,null,{timeout:15000});
  await page.waitForTimeout(150);
  const atrLive=await page.evaluate(()=>({method:RWARenkoTV.settings.method,atrLength:RWARenkoTV.settings.atrLength,box:RWARenkoTV.state.box,atr:RWARenkoTV.state.atr,tick:RWARenkoTV.state.tickSize,count:RWARenkoTV.state.confirmed.length,sourceBars:RWARenkoTV.state.closedBars.length,coverageStart:RWARenkoTV.state.closedBars[0]?.openTime,coverageEnd:RWARenkoTV.state.closedBars.at(-1)?.closeTime}));

  await page.fill('#atrLength','2000');
  await page.click('[data-apply-method="atr"]');
  await page.waitForFunction(()=>RWARenkoTV.settings.method==='atr'&&RWARenkoTV.settings.atrLength===2000&&RWARenkoTV.state.atrHistorySatisfied===true&&RWARenkoTV.state.closedBars.length>=2000&&document.documentElement.dataset.atrLength==='2000',null,{timeout:30000});
  await page.waitForTimeout(150);
  const atrLarge=await page.evaluate(()=>({method:RWARenkoTV.settings.method,atrLength:RWARenkoTV.settings.atrLength,box:RWARenkoTV.state.box,atr:RWARenkoTV.state.atr,count:RWARenkoTV.state.confirmed.length,sourceBars:RWARenkoTV.state.closedBars.length,coverageStart:RWARenkoTV.state.closedBars[0]?.openTime,coverageEnd:RWARenkoTV.state.closedBars.at(-1)?.closeTime,historySatisfied:RWARenkoTV.state.atrHistorySatisfied,inputValue:document.querySelector('#atrLength')?.value,coverageText:document.querySelector('#tvCoverage')?.textContent,loadText:document.querySelector('#tvLoadState')?.textContent}));

  const liveMutationPass=ohlcLive.source==='ohlc'&&ohlcLive.count>=0&&traditionalLive.method==='traditional'&&traditionalLive.box===1&&percentageLive.method==='percentage'&&Math.abs(percentageLive.box-(Math.round((percentageLive.lastClosed*.01)/percentageLive.tick)*percentageLive.tick))<Math.max(1e-9,percentageLive.tick*1e-6)&&atrLive.method==='atr'&&Math.abs(atrLive.box-atrLive.atr)<Math.max(1e-9,Number(atrLive.tick||0)*1e-6);
  const largeAtrPass=atrLarge.method==='atr'&&atrLarge.atrLength===2000&&atrLarge.inputValue==='2000'&&atrLarge.historySatisfied===true&&atrLarge.sourceBars>=2000&&atrLarge.coverageStart<atrLive.coverageStart&&Math.abs(atrLarge.box-atrLive.box)>Math.max(1e-9,Number(atrLive.tick||0)*.5)&&atrLarge.count!==atrLive.count;
  await page.screenshot({path:path.join(OUT,`${label}-official-parity.png`),fullPage:true});
  const pass=readyMs<=READY_LIMIT_MS&&errors.length===0&&Object.entries(contract).filter(([k])=>k.endsWith('Pass')||k==='layoutNoOverlap').every(([,v])=>v===true)&&liveMutationPass&&largeAtrPass;
  results.push({label,viewport,url,readyMs,readyLimitMs:READY_LIMIT_MS,errors,contract,ohlcLive,traditionalLive,percentageLive,atrLive,atrLarge,liveMutationPass,largeAtrPass,pass});
  await context.close();
}

try{await runViewport('desktop',{width:1900,height:1000});await runViewport('mobile',{width:390,height:844})}finally{await browser.close()}
const report={generatedAt:new Date().toISOString(),url:`${BASE}/renko/`,reference:'TradingView public Renko documentation',scope:'documented-contract parity, not proprietary byte-for-byte output identity',required:{historicalSource:'chart resolution Close/OHLC',realtime:'projection until source interval closes',methods:['ATR','Traditional','Percentage (LTP)'],continuation:'1x box',reversal:'2x box',percentage:'latest close x percent -> nearest min tick -> fixed across rebuild',atr:'Wilder ATR from ordinary source OHLC; ATR Length is the look-back and large values must not be silently capped',wicks:'source-dependent actual extrema',mobileDesktop:true,largeAtrRegression:'ATR 14 -> 2000 must preserve 2000, load older source history, move coverage start backward, and materially rebuild Renko'},status:results.every(x=>x.pass)?'PASS':'FAIL',results};
await fs.writeFile(path.join(OUT,'report.json'),JSON.stringify(report,null,2));
console.log('RENKO_TRADINGVIEW_OFFICIAL_REPORT',JSON.stringify(report));
if(report.status!=='PASS')process.exitCode=2;
