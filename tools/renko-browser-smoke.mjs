import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const BASE=process.env.RWA_TEST_URL||'http://127.0.0.1:4173/renko/';
const exchangeInfo={symbols:[
  {symbol:'BTCUSDT',baseAsset:'BTC',quoteAsset:'USDT',status:'TRADING',isSpotTradingAllowed:true},
  {symbol:'ETHUSDT',baseAsset:'ETH',quoteAsset:'USDT',status:'TRADING',isSpotTradingAllowed:true},
  {symbol:'SOLUSDT',baseAsset:'SOL',quoteAsset:'USDT',status:'TRADING',isSpotTradingAllowed:true},
  {symbol:'EURUSDT',baseAsset:'EUR',quoteAsset:'USDT',status:'TRADING',isSpotTradingAllowed:true},
  {symbol:'USDCUSDT',baseAsset:'USDC',quoteAsset:'USDT',status:'TRADING',isSpotTradingAllowed:true}
]};
const ticks=[100,110,120,111,100,90,110].map((price,i)=>({id:i+1,price:String(price),qty:'1',quoteQty:String(price),time:1700000000000+i*1000,isBuyerMaker:i%2===0,isBestMatch:true}));

async function setup(context){
  await context.addInitScript(()=>{
    class FakeWebSocket{
      static CONNECTING=0;static OPEN=1;static CLOSING=2;static CLOSED=3;
      constructor(url){this.url=url;this.readyState=0;setTimeout(()=>{this.readyState=1;this.onopen?.({type:'open'})},8)}
      close(){this.readyState=3}
      send(){}
    }
    window.WebSocket=FakeWebSocket;
  });
  await context.route('**/api/v3/exchangeInfo',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(exchangeInfo)}));
  await context.route('**/api/v3/trades?**',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(ticks)}));
}

async function desktop(browser){
  const context=await browser.newContext({viewport:{width:1440,height:900}});await setup(context);const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(String(e)));
  await page.goto(BASE,{waitUntil:'domcontentloaded',timeout:20000});
  await page.waitForFunction(()=>window.RWARenko?.source==='raw-trade-ticks-only'&&window.RWARenko.state.tickCount===7,{timeout:10000});
  const universe=await page.evaluate(()=>({symbols:window.RWARenko.state.symbols,rows:[...document.querySelectorAll('.pair-row')].map(x=>x.dataset.symbol),source:window.RWARenko.source,method:window.RWARenko.method,reversal:window.RWARenko.reversalBoxes}));
  assert.deepEqual(universe.symbols,['BTCUSDT','ETHUSDT','SOLUSDT']);
  assert.equal(universe.source,'raw-trade-ticks-only');assert.equal(universe.method,'traditional-fixed-box');assert.equal(universe.reversal,2);
  await page.fill('#brickSize','10');await page.click('#applyBrick');
  const engine=await page.evaluate(()=>({box:window.RWARenko.state.box,bricks:window.RWARenko.state.bricks.map(b=>({o:b.open,c:b.close,d:b.direction})),thresholds:window.RWARenko.thresholds(),tickCount:window.RWARenko.state.tickCount}));
  assert.equal(engine.box,10);assert.equal(engine.tickCount,7);assert.deepEqual(engine.bricks,[{o:100,c:110,d:1},{o:110,c:120,d:1},{o:110,c:100,d:-1},{o:100,c:90,d:-1},{o:100,c:110,d:1}]);assert.deepEqual(engine.thresholds,{up:120,down:90});
  const layout=await page.evaluate(()=>({scrollWidth:document.documentElement.scrollWidth,innerWidth,canvas:document.querySelector('#renkoCanvas').getBoundingClientRect().toJSON(),feed:document.querySelector('#feedPill b').textContent,mode:document.querySelector('.mode-pill').textContent}));
  assert.ok(layout.scrollWidth<=layout.innerWidth+2,`desktop overflow ${layout.scrollWidth}/${layout.innerWidth}`);assert.ok(layout.canvas.width>600&&layout.canvas.height>350);assert.match(layout.mode,/TICK/);assert.equal(errors.length,0,errors.join(' | '));await context.close();return{universe,engine,layout};
}

async function mobile(browser){
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});await setup(context);const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(String(e)));
  await page.goto(BASE,{waitUntil:'domcontentloaded',timeout:20000});await page.waitForFunction(()=>window.RWARenko?.state.tickCount===7,{timeout:10000});
  const before=await page.evaluate(()=>({scrollWidth:document.documentElement.scrollWidth,innerWidth,markets:getComputedStyle(document.querySelector('.markets')).display,button:!!document.querySelector('#mobilePairs'),canvas:document.querySelector('#renkoCanvas').getBoundingClientRect().toJSON()}));
  assert.ok(before.scrollWidth<=392);assert.equal(before.markets,'none');assert.equal(before.button,true);assert.ok(before.canvas.width<=390&&before.canvas.height>=300);
  await page.click('#mobilePairs');const after=await page.evaluate(()=>({open:document.querySelector('.markets').classList.contains('open'),display:getComputedStyle(document.querySelector('.markets')).display,scrollWidth:document.documentElement.scrollWidth}));assert.equal(after.open,true);assert.notEqual(after.display,'none');assert.ok(after.scrollWidth<=392);assert.equal(errors.length,0,errors.join(' | '));await context.close();return{before,after};
}

const browser=await chromium.launch({headless:true});
try{const d=await desktop(browser),m=await mobile(browser);console.log(JSON.stringify({ok:true,contract:'rwa-renko-tick-traditional-v1',desktop:d,mobile:m},null,2))}finally{await browser.close()}
