import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const BASE=process.env.RWA_TEST_URL||'http://127.0.0.1:4173/renko/';
const core=[
  {symbol:'BTCUSDT',baseAsset:'BTC',quoteAsset:'USDT',status:'TRADING',isSpotTradingAllowed:true},
  {symbol:'ETHUSDT',baseAsset:'ETH',quoteAsset:'USDT',status:'TRADING',isSpotTradingAllowed:true},
  {symbol:'USDCUSDT',baseAsset:'USDC',quoteAsset:'USDT',status:'TRADING',isSpotTradingAllowed:true},
  {symbol:'ETHBTC',baseAsset:'ETH',quoteAsset:'BTC',status:'TRADING',isSpotTradingAllowed:true},
  {symbol:'EURUSDT',baseAsset:'EUR',quoteAsset:'USDT',status:'TRADING',isSpotTradingAllowed:true},
  ...Array.from({length:650},(_,i)=>({symbol:`C${String(i).padStart(3,'0')}USDT`,baseAsset:`C${String(i).padStart(3,'0')}`,quoteAsset:'USDT',status:'TRADING',isSpotTradingAllowed:true}))
];
const tickers=core.map((s,i)=>({symbol:s.symbol,lastPrice:String(100+i/10),priceChangePercent:String((i%19)-9),quoteVolume:String(1e9-i*1e6)}));
const recent=Array.from({length:1000},(_,i)=>({id:i+1,price:String(100+i*.02),qty:'1',time:1700000000000+i*1000}));
const minute=60000,latestStart=1700000000000;
function makeBars(start,count,price0){return Array.from({length:count},(_,i)=>{const t=start+i*minute,c=price0+i*1.2,o=c-.4,h=c+.6,l=c-.8;return [t,String(o),String(h),String(l),String(c),'1',t+minute-1,'1',10,'1','1','0']})}
const latest=makeBars(latestStart,1000,100),older=makeBars(latestStart-1000*minute,1000,-1100);
async function setup(context){
  await context.addInitScript(()=>{
    localStorage.setItem('rwa_renko_traditional_v3',JSON.stringify({selected:'BTCUSDT',visible:160,historyMode:'all',boxes:{BTCUSDT:1}}));
    class FakeWebSocket{static CONNECTING=0;static OPEN=1;static CLOSING=2;static CLOSED=3;constructor(url){this.url=url;this.readyState=0;setTimeout(()=>{this.readyState=1;this.onopen?.({type:'open'});setTimeout(()=>this.onmessage?.({data:JSON.stringify({e:'trade',s:'BTCUSDT',t:9001,p:'1302',q:'0.1',T:1701000000000})}),20)},8)}close(){this.readyState=3;this.onclose?.({type:'close'})}send(){}}
    window.WebSocket=FakeWebSocket;
  });
  await context.route('**/api/v3/exchangeInfo',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({symbols:core})}));
  await context.route('**/api/v3/ticker/24hr',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(tickers)}));
  await context.route('**/api/v3/trades?**',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(recent)}));
  await context.route('**/api/v3/klines?**',r=>{const u=new URL(r.request().url()),end=Number(u.searchParams.get('endTime')||0),rows=end&&end<latestStart?older:latest;r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(rows)})});
}
const browser=await chromium.launch({headless:true});
try{
  const context=await browser.newContext({viewport:{width:1440,height:900}});await setup(context);const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(String(e)));
  await page.goto(BASE,{waitUntil:'domcontentloaded',timeout:20000});
  await page.waitForFunction(()=>window.RWARenkoV6?.version==='6.0.0'&&window.RWARenkoV3?.state?.symbols?.length>600,{timeout:15000});
  await page.waitForFunction(()=>window.RWARenkoV6?.state?.bricks?.length>=50&&!window.RWARenkoV6?.state?.fetching,{timeout:15000});
  const initial=await page.evaluate(()=>({
    v:window.RWARenkoV6.version,mode:window.RWARenkoV6.mode,source:window.RWARenkoV6.historicalSource,raw:window.RWARenkoV6.rawAudit,box:window.RWARenkoV6.state.box,visible:document.querySelector('#fastHistoryCount')?.textContent,coverage:document.querySelector('#fastHistoryCoverage')?.textContent,status:document.querySelector('#fastArchiveStatus')?.textContent,canvas:document.querySelector('#lazyHistoryCanvas')?.getBoundingClientRect().toJSON(),display:document.querySelector('#lazyHistoryCanvas')?.style.display,pairs:window.RWARenkoV6.state.selectedUniverseCount,rows:document.querySelectorAll('.pair-row').length,sourceText:document.querySelector('#sourceText')?.textContent,v5auto:!!window.RWARenkoV5Auto
  }));
  assert.equal(initial.v,'6.0.0');assert.equal(initial.mode,'tradingview-compatible-lazy-50');assert.equal(initial.source,'binance-1m-close');assert.equal(initial.raw,'binance-vision-individual-trades');assert.equal(initial.box,1);assert.match(initial.visible,/50 BRICKS VISIBLE/i);assert.match(initial.coverage,/50-BRICK WINDOW/i);assert.match(initial.status,/50 BRICKS READY/i);assert.ok(initial.canvas?.width>700&&initial.canvas?.height>250);assert.notEqual(initial.display,'none');assert.ok(initial.pairs>=650);assert.equal(initial.rows,500);assert.match(initial.sourceText,/1m CLOSE/i);assert.equal(initial.v5auto,false,'V5 auto lifetime download must not run in fast mode');

  await page.fill('#pairSearch','USDCUSDT');await page.waitForTimeout(100);const search=await page.evaluate(()=>({text:document.querySelector('#pairList')?.textContent,total:document.querySelector('#pairTotal')?.textContent,note:document.querySelector('#universeNote')?.textContent}));assert.match(search.text,/USDC \/ USDT/);assert.match(search.note,/ALL .* spot crypto pairs searchable/i);
  await page.fill('#pairSearch','');await page.waitForTimeout(50);

  const before=await page.evaluate(()=>({bars:window.RWARenkoV6.state.bars.length,bricks:window.RWARenkoV6.state.bricks.length,offset:window.RWARenkoV6.state.offset,fetching:window.RWARenkoV6.state.fetching,exhausted:window.RWARenkoV6.state.exhausted,first:window.RWARenkoV6.state.bars[0]?.[0]}));
  const olderDebug=await page.evaluate(async()=>{const result=await window.RWARenkoV6.loadOlder();for(let i=0;i<8;i++)window.RWARenkoV6.moveOlder();await new Promise(r=>setTimeout(r,200));return {result,bars:window.RWARenkoV6.state.bars.length,bricks:window.RWARenkoV6.state.bricks.length,offset:window.RWARenkoV6.state.offset,fetching:window.RWARenkoV6.state.fetching,exhausted:window.RWARenkoV6.state.exhausted,first:window.RWARenkoV6.state.bars[0]?.[0],status:document.querySelector('#fastArchiveStatus')?.textContent};});
  console.log('older-debug',JSON.stringify({before,olderDebug}));
  assert.ok(olderDebug.bars>before.bars,`older page not appended: ${JSON.stringify({before,olderDebug})}`);assert.ok(olderDebug.bricks>=before.bricks);assert.ok(olderDebug.offset>before.offset);const olderState=await page.evaluate(()=>({bars:window.RWARenkoV6.state.bars.length,bricks:window.RWARenkoV6.state.bricks.length,offset:window.RWARenkoV6.state.offset,visible:document.querySelector('#fastHistoryCount')?.textContent,from:document.querySelector('#fastHistoryFrom')?.textContent,to:document.querySelector('#fastHistoryTo')?.textContent}));assert.match(olderState.visible,/50 BRICKS VISIBLE/i);

  await page.click('#historyLive');await page.waitForTimeout(100);const live=await page.evaluate(()=>({mode:window.RWARenkoV6.state.mode,display:document.querySelector('#lazyHistoryCanvas')?.style.display,coverage:document.querySelector('#fastHistoryCoverage')?.textContent}));assert.equal(live.mode,'live');assert.equal(live.display,'none');assert.match(live.coverage,/LIVE RAW @TRADE/i);
  await page.click('#historyAll');await page.waitForTimeout(100);const back=await page.evaluate(()=>({mode:window.RWARenkoV6.state.mode,offset:window.RWARenkoV6.state.offset,display:document.querySelector('#lazyHistoryCanvas')?.style.display,visible:document.querySelector('#fastHistoryCount')?.textContent}));assert.equal(back.mode,'history');assert.equal(back.offset,0);assert.notEqual(back.display,'none');assert.match(back.visible,/50 BRICKS VISIBLE/i);

  const cache=await page.evaluate(()=>Object.keys(localStorage).filter(k=>k.startsWith('rwa_renko_v6_seed_')).length);assert.ok(cache>=1,'50-brick synchronous cache was not written');
  assert.equal(errors.length,0,errors.join(' | '));
  console.log(JSON.stringify({ok:true,contract:'renko-v6-tradingview-compatible-lazy-50-all-spot-search',initial,search,before,olderDebug,olderState,live,back,cache},null,2));
  await context.close();
}finally{await browser.close()}
