import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const BASE=process.env.RWA_TEST_URL||'http://127.0.0.1:4173/renko/';
const symbols=[
  {symbol:'BTCUSDT',baseAsset:'BTC',quoteAsset:'USDT',status:'TRADING',isSpotTradingAllowed:true},
  {symbol:'ETHUSDT',baseAsset:'ETH',quoteAsset:'USDT',status:'TRADING',isSpotTradingAllowed:true},
  {symbol:'SOLUSDT',baseAsset:'SOL',quoteAsset:'USDT',status:'TRADING',isSpotTradingAllowed:true},
  {symbol:'XRPUSDT',baseAsset:'XRP',quoteAsset:'USDT',status:'TRADING',isSpotTradingAllowed:true},
  {symbol:'BNBUSDT',baseAsset:'BNB',quoteAsset:'USDT',status:'TRADING',isSpotTradingAllowed:true},
  {symbol:'DOGEUSDT',baseAsset:'DOGE',quoteAsset:'USDT',status:'TRADING',isSpotTradingAllowed:true},
  ...Array.from({length:650},(_,i)=>({symbol:`C${String(i).padStart(3,'0')}USDT`,baseAsset:`C${String(i).padStart(3,'0')}`,quoteAsset:'USDT',status:'TRADING',isSpotTradingAllowed:true}))
];
const tickers=symbols.map((s,i)=>({symbol:s.symbol,lastPrice:String(100+i/10),priceChangePercent:String((i%19)-9),quoteVolume:String(1e9-i*1e6)}));
const recent=[100,110,120,111,100,90,110].map((price,i)=>({id:i+1,price:String(price),qty:'1',time:1700000000000+i*1000}));
async function setup(context){
  await context.addInitScript(()=>{
    class FakeWebSocket{
      static CONNECTING=0;static OPEN=1;static CLOSING=2;static CLOSED=3;
      constructor(url){this.url=url;this.readyState=0;setTimeout(()=>{this.readyState=1;this.onopen?.({type:'open'});const sym=(url.match(/\/([^/]+)@trade$/)?.[1]||'btcusdt').toUpperCase();setTimeout(()=>this.onmessage?.({data:JSON.stringify({e:'trade',s:sym,t:1001,p:'111',q:'0.1',T:1700000010000})}),20);setTimeout(()=>this.onmessage?.({data:JSON.stringify({e:'trade',s:sym,t:1002,p:'112',q:'0.1',T:1700000011000})}),50)},8)}
      close(){this.readyState=3;this.onclose?.({type:'close'})}send(){}
    }
    window.WebSocket=FakeWebSocket;
  });
  await context.route('**/api/v3/exchangeInfo',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({symbols})}));
  await context.route('**/api/v3/ticker/24hr',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(tickers)}));
  await context.route('**/api/v3/trades?**',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(recent)}));
}
const browser=await chromium.launch({headless:true});
try{
  const context=await browser.newContext({viewport:{width:1440,height:900}});await setup(context);const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(String(e)));
  await page.goto(BASE,{waitUntil:'domcontentloaded',timeout:20000});
  await page.waitForFunction(()=>window.RWARenko?.version==='5.3.0'&&window.RWARenkoV5Auto?.version==='5.3.0'&&window.RWARenkoV3?.state?.symbols?.length>=650&&window.RWARenkoV3?.state?.tickCount>=9,{timeout:15000});
  const desktop=await page.evaluate(()=>({version:window.RWARenko.version,auto:window.RWARenkoV5Auto.version,preview:window.RWARenkoV5Auto.preview,source:window.RWARenko.source,history:window.RWARenko.history,scope:window.RWARenko.historyScope,pairs:document.querySelectorAll('.pair-row').length,total:window.RWARenkoV3.state.symbols.length,last:window.RWARenkoV3.state.lastPrice,width:document.documentElement.scrollWidth,inner:innerWidth,archive:document.querySelector('.archivebar')?.getBoundingClientRect().toJSON(),button:document.querySelector('#archiveLoad')?.textContent}));
  assert.equal(desktop.version,'5.3.0');assert.equal(desktop.auto,'5.3.0');assert.equal(desktop.preview,'native-event-tradingview-style-bricks');assert.equal(desktop.source,'raw-trade-ticks-only');assert.equal(desktop.history,'raw-tick-lifetime-archives');assert.match(desktop.scope,/oldest-available/);assert.equal(desktop.pairs,500);assert.ok(desktop.total>=650);assert.equal(desktop.last,112);assert.ok(desktop.width<=desktop.inner+2);assert.ok(desktop.archive?.width>700);assert.match(desktop.button,/TOTAL TICK HISTORY/);

  await page.waitForTimeout(900);
  await page.evaluate(()=>{window.RWARenkoV5?.cancel();const a=window.RWARenkoV5Auto,s=window.RWARenkoV3.state;a.state.lastKey=`${s.selected}|${Number(s.box)}`;a.state.armed=true;a.resetPreview()});
  const preview=await page.evaluate(async()=>{
    const first=Date.UTC(2017,7,17),bricks=[];let p=4200;
    for(let i=0;i<800;i++){const d=i%9===0?-1:1,o=p,c=p+d*100;bricks.push([o,c,d,first+i*60000,i]);p=c}
    const s=window.RWARenkoV3.state;
    window.dispatchEvent(new CustomEvent('rwa-renko-archive-chunk',{detail:{symbol:s.selected,box:Number(s.box),bricks,bricksTotal:800,ticks:40000,firstTime:first,lastTime:first+799*60000,done:1,total:100}}));
    await new Promise(r=>setTimeout(r,900));
    const c=document.querySelector('#archivePreview'),ctx=c?.getContext('2d');let colored=0;
    if(ctx){const data=ctx.getImageData(0,0,c.width,c.height).data;for(let i=0;i<data.length;i+=16){const r=data[i],g=data[i+1],b=data[i+2];if(g>100||r>100||b>100)colored++}}
    return {active:window.RWARenkoV5Auto.state.previewActive,count:window.RWARenkoV5Auto.state.previewCount,samples:window.RWARenkoV5Auto.state.previewSamples.length,display:c?.style.display,width:c?.getBoundingClientRect().width,height:c?.getBoundingClientRect().height,history:document.querySelector('#historyCount')?.textContent,coverage:document.querySelector('#historyCoverage')?.textContent,colored,mode:window.RWARenkoV5Auto.state.mode};
  });
  assert.equal(preview.active,true);assert.equal(preview.count,800);assert.ok(preview.samples>100);assert.notEqual(preview.display,'none');assert.ok(preview.width>700&&preview.height>250);assert.match(preview.history,/800.*historical bricks/i);assert.match(preview.coverage,/RAW TICK HISTORY BUILDING/i);assert.ok(preview.colored>500,'preview canvas has no visible brick/grid pixels');assert.equal(preview.mode,'all');

  await page.click('#historyLive');await page.waitForTimeout(150);const liveMode=await page.evaluate(()=>({mode:window.RWARenkoV5Auto.state.mode,display:document.querySelector('#archivePreview')?.style.display}));assert.equal(liveMode.mode,'live');assert.equal(liveMode.display,'none');
  await page.click('#historyAll');await page.waitForTimeout(250);const allMode=await page.evaluate(()=>({mode:window.RWARenkoV5Auto.state.mode,display:document.querySelector('#archivePreview')?.style.display,history:document.querySelector('#historyCount')?.textContent}));assert.equal(allMode.mode,'all');assert.notEqual(allMode.display,'none');assert.match(allMode.history,/800.*historical bricks/i);
  await page.click('#historyStart');await page.waitForTimeout(200);const startMode=await page.evaluate(()=>window.RWARenkoV5Auto.state.mode);assert.equal(startMode,'start');

  const archive=await page.evaluate(async()=>{
    const url='https://data.binance.vision/data/spot/monthly/trades/BTCUSDT/BTCUSDT-trades-2017-08.zip';
    const w=new Worker('archive-worker-v5.js?v=53');
    return await new Promise((resolve,reject)=>{const t=setTimeout(()=>reject(Error('real archive worker timeout')),120000);w.onmessage=e=>{if(e.data?.type==='archiveurltest'){clearTimeout(t);w.terminate();resolve(e.data)}else if(e.data?.type==='error'){clearTimeout(t);w.terminate();reject(Error(e.data.message))}};w.onerror=e=>reject(Error(e.message));w.postMessage({type:'archiveurltest',box:100,url})});
  });
  assert.equal(archive.ok,true);assert.ok(archive.rows>1000,`raw archive rows ${archive.rows}`);assert.equal(archive.ticks,archive.rows);assert.ok(archive.bricks>0);assert.ok(archive.firstTime>=Date.UTC(2017,7,1));assert.ok(archive.lastTime<Date.UTC(2017,8,2));

  await page.setViewportSize({width:390,height:844});await page.waitForTimeout(300);
  const mobile=await page.evaluate(()=>({width:document.documentElement.scrollWidth,inner:innerWidth,archive:document.querySelector('.archivebar')?.getBoundingClientRect().toJSON(),chart:document.querySelector('#chartWrap')?.getBoundingClientRect().toJSON(),preview:document.querySelector('#archivePreview')?.getBoundingClientRect().toJSON(),button:document.querySelector('#archiveLoad')?.getBoundingClientRect().toJSON()}));
  assert.ok(mobile.width<=392,`mobile overflow ${mobile.width}`);assert.ok(mobile.archive.width<=390);assert.ok(mobile.chart.width<=390);assert.ok(mobile.preview.width<=390);assert.ok(mobile.button.width>100);
  assert.equal(errors.length,0,errors.join(' | '));
  console.log(JSON.stringify({ok:true,contract:'rwa-renko-v5.3-native-progressive-raw-tick-traditional',desktop,preview,archive,mobile},null,2));
  await context.close();
}finally{await browser.close()}
