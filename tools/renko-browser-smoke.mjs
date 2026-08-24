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
  ...Array.from({length:650},(_,i)=>({symbol:`C${String(i).padStart(3,'0')}USDT`,baseAsset:`C${String(i).padStart(3,'0')}`,quoteAsset:'USDT',status:'TRADING',isSpotTradingAllowed:true})),
  {symbol:'EURUSDT',baseAsset:'EUR',quoteAsset:'USDT',status:'TRADING',isSpotTradingAllowed:true},
  {symbol:'USDCUSDT',baseAsset:'USDC',quoteAsset:'USDT',status:'TRADING',isSpotTradingAllowed:true}
];
const tickers=symbols.map((s,i)=>({symbol:s.symbol,lastPrice:String(100+i/10),priceChangePercent:String((i%19)-9),quoteVolume:String(1000000000-i*1000000)}));
const history=[100,110,120,111,100,90,110].map((price,i)=>({id:i+1,price:String(price),qty:'1',time:1700000000000+i*1000}));

async function setup(context){
  await context.addInitScript(()=>{
    class FakeWebSocket{
      static CONNECTING=0;static OPEN=1;static CLOSING=2;static CLOSED=3;
      constructor(url){this.url=url;this.readyState=0;setTimeout(()=>{this.readyState=1;this.onopen?.({type:'open'});const sym=(url.match(/\/([^/]+)@trade$/)?.[1]||'btcusdt').toUpperCase();setTimeout(()=>this.onmessage?.({data:JSON.stringify({e:'trade',s:sym,t:1001,p:'111',q:'0.1',T:1700000010000})}),20);setTimeout(()=>this.onmessage?.({data:JSON.stringify({e:'trade',s:sym,t:1002,p:'112',q:'0.1',T:1700000011000})}),50)},8)}
      close(){this.readyState=3;this.onclose?.({type:'close'})}
      send(){}
    }
    window.WebSocket=FakeWebSocket;
  });
  await context.route('**/api/v3/exchangeInfo',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({symbols})}));
  await context.route('**/api/v3/ticker/24hr',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(tickers)}));
  await context.route('**/api/v3/trades?**',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(history)}));
}

async function desktop(browser){
  const context=await browser.newContext({viewport:{width:1440,height:900}});await setup(context);const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(String(e)));
  await page.goto(BASE,{waitUntil:'domcontentloaded',timeout:20000});
  await page.waitForFunction(()=>window.RWARenko?.version==='3.0.0'&&window.RWARenko.state.symbols.length>=650&&window.RWARenko.state.tickCount>=9,{timeout:10000});
  const universe=await page.evaluate(()=>({count:window.RWARenko.state.symbols.length,rows:document.querySelectorAll('.pair-row').length,source:window.RWARenko.source,method:window.RWARenko.method,reversal:window.RWARenko.reversalBoxes,history:window.RWARenko.history,scope:window.RWARenko.historyScope,selected:window.RWARenko.state.selected,last:window.RWARenko.state.lastPrice,mode:window.RWARenko.state.historyMode}));
  assert.ok(universe.count>=650,`full universe too small ${universe.count}`);assert.equal(universe.rows,500,'default list must render top 500');assert.equal(universe.source,'raw-trade-ticks-only');assert.equal(universe.method,'traditional-fixed-box');assert.equal(universe.reversal,2);assert.equal(universe.history,'all-bricks-from-chart-genesis');assert.equal(universe.scope,'chart-genesis-not-exchange-lifetime');assert.equal(universe.selected,'BTCUSDT');assert.equal(universe.last,112);assert.equal(universe.mode,'all');

  const engine=await page.evaluate(()=>{const r=window.RWARenko,s=r.state;s.historyTicks=[];s.bricks=[];s.tickCount=0;s.lastPrice=NaN;s.lastTickTime=0;s.lastTradeId=null;s.lastClose=NaN;s.direction=0;s.anchor=NaN;s.pan=0;s.box=10;s.historyMode='all';[100,110,120,111,100,90,110].forEach((price,i)=>r.applyTick({id:i+1,price,time:1700000000000+i*1000},true,false));r.setHistoryMode('all');return{bricks:s.bricks.map(b=>({o:b.open,c:b.close,d:b.direction})),tickCount:s.tickCount,bounds:r.historyBounds(),mode:s.historyMode}});
  assert.equal(engine.tickCount,7);assert.deepEqual(engine.bricks,[{o:100,c:110,d:1},{o:110,c:120,d:1},{o:110,c:100,d:-1},{o:100,c:90,d:-1},{o:100,c:110,d:1}]);assert.equal(engine.bounds.count,5);assert.equal(engine.mode,'all');

  const deep=await page.evaluate(async()=>{const r=window.RWARenko,s=r.state;s.historyTicks=[];s.bricks=[];s.tickCount=0;s.lastPrice=NaN;s.lastTickTime=0;s.lastTradeId=null;s.lastClose=NaN;s.direction=0;s.anchor=NaN;s.pan=0;s.box=1;s.historyMode='all';for(let i=0;i<15050;i++)r.applyTick({id:20000+i,price:100+i,time:1700100000000+i},true,false);r.setHistoryMode('all');await new Promise(x=>setTimeout(x,80));return{bricks:s.bricks.length,renderStart:s.renderSlice?.start,renderEnd:s.renderSlice?.end,renderCount:s.renderSlice?.a?.length,all:s.renderSlice?.all,coverage:document.querySelector('#historyCoverage')?.textContent,count:document.querySelector('#historyCount')?.textContent}});
  assert.ok(deep.bricks>12000,`brick history was trimmed: ${deep.bricks}`);assert.equal(deep.renderStart,0);assert.equal(deep.renderEnd,deep.bricks);assert.equal(deep.renderCount,deep.bricks);assert.equal(deep.all,true);assert.match(deep.coverage,/genesis/i);assert.match(deep.count,/bricks/);

  await page.fill('#pairSearch','C649');await page.waitForTimeout(50);assert.equal(await page.locator('.pair-row').count(),1);await page.fill('#pairSearch','');
  const layout=await page.evaluate(()=>({scrollWidth:document.documentElement.scrollWidth,innerWidth,canvas:document.querySelector('#renkoCanvas').getBoundingClientRect().toJSON(),historybar:document.querySelector('.historybar')?.getBoundingClientRect().toJSON(),allButton:!!document.querySelector('#historyAll'),startButton:!!document.querySelector('#historyStart'),liveButton:!!document.querySelector('#historyLive'),pairTotal:document.querySelector('#pairTotal')?.textContent}));
  assert.ok(layout.scrollWidth<=layout.innerWidth+2,`desktop overflow ${layout.scrollWidth}/${layout.innerWidth}`);assert.ok(layout.canvas.width>600&&layout.canvas.height>250);assert.ok(layout.historybar.height>30);assert.equal(layout.allButton,true);assert.equal(layout.startButton,true);assert.equal(layout.liveButton,true);assert.match(layout.pairTotal,/markets/);assert.equal(errors.length,0,errors.join(' | '));await context.close();return{universe,engine,deep,layout};
}

async function mobile(browser){
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});await setup(context);const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(String(e)));await page.goto(BASE,{waitUntil:'domcontentloaded',timeout:20000});await page.waitForFunction(()=>window.RWARenko?.version==='3.0.0'&&window.RWARenko.state.symbols.length>=650&&window.RWARenko.state.tickCount>=9,{timeout:10000});
  const before=await page.evaluate(()=>({scrollWidth:document.documentElement.scrollWidth,innerWidth,markets:getComputedStyle(document.querySelector('.markets')).display,button:getComputedStyle(document.querySelector('#openPairs')).display,canvas:document.querySelector('#renkoCanvas').getBoundingClientRect().toJSON(),historybar:document.querySelector('.historybar').getBoundingClientRect().toJSON(),mode:window.RWARenko.state.historyMode}));
  assert.ok(before.scrollWidth<=392);assert.equal(before.markets,'none');assert.notEqual(before.button,'none');assert.ok(before.canvas.width<=390&&before.canvas.height>=250);assert.ok(before.historybar.width<=390);assert.equal(before.mode,'all');
  await page.click('#historyLive');await page.waitForTimeout(30);assert.equal(await page.evaluate(()=>window.RWARenko.state.historyMode),'window');await page.click('#historyAll');await page.waitForTimeout(30);assert.equal(await page.evaluate(()=>window.RWARenko.state.historyMode),'all');
  await page.click('#openPairs');const after=await page.evaluate(()=>({open:document.querySelector('.markets').classList.contains('open'),display:getComputedStyle(document.querySelector('.markets')).display,scrollWidth:document.documentElement.scrollWidth,rows:document.querySelectorAll('.pair-row').length}));assert.equal(after.open,true);assert.notEqual(after.display,'none');assert.ok(after.scrollWidth<=392);assert.equal(after.rows,500);assert.equal(errors.length,0,errors.join(' | '));await context.close();return{before,after};
}

const browser=await chromium.launch({headless:true});
try{const d=await desktop(browser),m=await mobile(browser);console.log(JSON.stringify({ok:true,contract:'rwa-renko-v3-top500-all-chart-genesis-history',desktop:d,mobile:m},null,2))}finally{await browser.close()}
