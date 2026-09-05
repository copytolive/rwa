import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';

const base=process.env.RWA_UI_URL||'http://127.0.0.1:4173/rwa/';
const proof=process.env.RWA_UI_PROOF_DIR||'proof/terminal-v22';
await mkdir(proof,{recursive:true});
const browser=await chromium.launch({headless:true});
const failures=[],pageErrors=[];
const fail=(message,detail=null)=>failures.push({message,detail});
const near=(a,b,t=6)=>Math.abs(Number(a)-Number(b))<=t;

async function shot(page,name){
  const path=proof+'/'+name+'.png';
  try{await page.screenshot({path,fullPage:false,timeout:12000})}
  catch{const cdp=await page.context().newCDPSession(page);try{const out=await cdp.send('Page.captureScreenshot',{format:'png',fromSurface:true,captureBeyondViewport:false});await writeFile(path,Buffer.from(out.data,'base64'))}finally{await cdp.detach().catch(()=>{})}}
}

async function ready(page){
  await page.goto(base,{waitUntil:'domcontentloaded',timeout:50000});
  await page.waitForFunction(()=>window.RWALiveHome?.version==='5.0.0'&&window.RWATerminalV5?.version==='1.0.0'&&window.RWAReferenceParityV22?.version==='2.2.1'&&window.RWAReferenceParityV22Final?.version==='2.2.3'&&window.RWAMarketRuntime?.state?.().pairs?.length>50,{timeout:50000});
  await page.waitForFunction(()=>window.RWAReferenceParityV22Final?.audit?.().attempted===true,{timeout:20000});
  await page.evaluate(async()=>{try{await window.RWAReferenceParityV21?.refreshDepth?.()}catch{}});
  await page.waitForFunction(()=>document.querySelectorAll('#bids .bookrow').length>=5&&document.querySelectorAll('#asks .bookrow').length>=5,{timeout:45000});
  await page.waitForFunction(()=>document.querySelector('#liveRail #rwaTargetOrderTicket'),{timeout:20000});
  await page.waitForFunction(()=>{const n=Number((document.querySelector('#statPrice')?.textContent||'').replace(/,/g,'').replace(/[^0-9.-]/g,''));return n>0},{timeout:30000});
  await page.waitForFunction(()=>{const a=window.RWAReferenceParityV22Final?.audit?.();return a?.marketConsistent===true&&a?.marketConsistency?.symbol&&a.marketConsistency.symbol===a.selected},{timeout:20000});
  await page.waitForFunction(()=>window.RWAReferenceParityV22.audit().overlayImages===0&&window.RWAReferenceParityV22Final.audit().overlayImages===0,{timeout:10000});
}

async function snapshot(page){
  return page.evaluate(()=>({
    route:location.hash,
    nav:[...document.querySelectorAll('.topnav [data-v5-global]')].map(x=>x.dataset.v5Global),
    bottom:[...document.querySelectorAll('#rwaV5Bottom [data-v5-bottom]')].map(x=>x.dataset.v5Bottom),
    left:[...document.querySelectorAll('.rwa-v5-left-tabs [data-v5-left]')].map(x=>x.dataset.v5Left),
    v22:window.RWAReferenceParityV22.audit(),
    final:window.RWAReferenceParityV22Final.audit(),
    commerce:/seablueprint|ecommerce|in-page commerce/i.test(document.body.innerText),
    mock:!!document.querySelector('#rwaScreenshotParity'),
    mobilePrice:document.querySelector('[data-v5-mobile-price]')?getComputedStyle(document.querySelector('[data-v5-mobile-price]')).display:'missing',
    desktopPrice:document.querySelector('.quickstats .price-stat')?getComputedStyle(document.querySelector('.quickstats .price-stat')).display:'missing'
  }));
}

function verifyCore(info,label){
  if(info.route!=='#markets')fail(label+' route',info.route);
  if(JSON.stringify(info.nav)!==JSON.stringify(['trade','discover','portfolio','analytics','rewards','more']))fail(label+' nav',info.nav);
  if(JSON.stringify(info.bottom)!==JSON.stringify(['positions','orders','holders','feed','analytics','thesis','history']))fail(label+' bottom tabs',info.bottom);
  if(JSON.stringify(info.left)!==JSON.stringify(['watchlist','feed','pulse','live']))fail(label+' left tabs',info.left);
  if(info.commerce||info.mock||info.v22.overlayImages!==0||info.final.overlayImages!==0)fail(label+' forbidden mock/commerce overlay',info);
  if(info.v22.chartBars<30||info.v22.bookBids<5||info.v22.bookAsks<5)fail(label+' live market surfaces incomplete',info.v22);
  if(info.final.version!=='2.2.3'||info.final.attempted!==true||info.final.marketConsistent!==true)fail(label+' market consistency guard',info.final);
  if(info.final.marketConsistency?.symbol!==info.final.selected||!info.final.marketConsistency?.chartCoherent||!info.final.marketConsistency?.bookCoherent)fail(label+' mixed market surfaces',info.final.marketConsistency);
  if(info.v22.mainnetReady!==false||info.final.mainnetReady!==false)fail(label+' mainnet must remain fail-closed',{v22:info.v22.mainnetReady,final:info.final.mainnetReady});
}

function verifyDesktopGeometry(info,W,H,label){
  const d=info.v22.desktop;
  const left=Math.round(W*238/1298),main=Math.round(W*675/1298),book=Math.round(W*216/1298),trade=W-left-main-book;
  const bottom=Math.max(195,Math.min(218,Math.round(H*.232))),mainH=H-59-28-bottom;
  const wants={header:[W,59],left:[left,H-59-28],main:[main,mainH],book:[book,mainH],trade:[trade,H-59-28],bottom:[main+book,bottom],footer:[W,28]};
  for(const [k,want] of Object.entries(wants)){const r=d[k];if(!r||!near(r.width,want[0])||!near(r.height,want[1]))fail(label+' exact geometry '+k,{got:r,want})}
}

async function referenceDesktop(){
  const W=1298,H=847,name='desktop-reference-1298x847-v22';
  const ctx=await browser.newContext({viewport:{width:W,height:H},deviceScaleFactor:1,serviceWorkers:'block'}),page=await ctx.newPage();
  page.on('pageerror',e=>pageErrors.push(name+': '+String(e?.message||e)));
  await ready(page);const info=await snapshot(page);verifyCore(info,name);verifyDesktopGeometry(info,W,H,name);
  if(await page.locator('#rwaV22DrawTools [data-v22-tool]').count()<5)fail(name+' drawing toolbar missing');
  if(info.v22.defaultClean!==true)fail(name+' default candles not clean',info.v22.defaultClean);
  await shot(page,name);await ctx.close();return info;
}

async function desktopOperational(){
  const W=1672,H=941,name='desktop-v22';
  const ctx=await browser.newContext({viewport:{width:W,height:H},deviceScaleFactor:1,serviceWorkers:'block'}),page=await ctx.newPage();
  page.on('pageerror',e=>pageErrors.push(name+': '+String(e?.message||e)));
  await ready(page);await shot(page,name);const info=await snapshot(page);verifyCore(info,name);verifyDesktopGeometry(info,W,H,name);
  if(await page.locator('#rwaV22DrawTools [data-v22-tool]').count()<5)fail(name+' drawing toolbar missing');
  const clickNav=async(k,rx)=>{await page.locator('.topnav>button[data-v5-nav="'+k+'"]').click();await page.waitForTimeout(40);if(rx&&!rx.test(await page.locator('#rwaV5Bottom').innerText()))fail(k+' content mismatch')};
  await clickNav('discover',/Top movers|Top volume/i);
  await clickNav('portfolio',/Portfolio|Connect a wallet|ACCOUNT VALUE/i);
  await page.locator('#rwaV5Bottom [data-v5-bottom="orders"]').click();await page.waitForTimeout(30);if(!/Open Orders|Connect a wallet|No open orders/i.test(await page.locator('#rwaV5Bottom').innerText()))fail('orders content');
  await clickNav('analytics',/LIVE PAIRS|RWA-LINKED|BUY PRESSURE/i);
  await clickNav('rewards',/reward|inactive|locked/i);
  await page.locator('.topnav>button[data-v5-nav="trade"]').click();const ticket=page.locator('#rwaTargetOrderTicket');if(!await ticket.isVisible())fail('ticket hidden');
  await page.locator('.rwa-v5-side-switch [data-v5-side="SELL"]').click();if(await ticket.getAttribute('data-v5-side')!=='SELL')fail('sell failed');
  await page.locator('.rwa-v5-side-switch [data-v5-side="BUY"]').click();
  await ticket.locator('[data-live-mode="STOP"]').click();if(!await ticket.locator('[data-live-mode="STOP"]').evaluate(x=>x.classList.contains('active')))fail('STOP failed');
  await ticket.locator('[data-live-mode="MARKET"]').click();await page.locator('#asks .bookrow').last().click();await page.waitForTimeout(80);if(!await ticket.locator('[data-live-mode="LIMIT"]').evaluate(x=>x.classList.contains('active')))fail('orderbook click did not set LIMIT');
  await page.locator('#rwaV5Bottom [data-v5-bottom="holders"]').click();await page.waitForTimeout(100);const ht=await page.locator('[data-v5-bottom-body]').innerText();if(!/Holders|SOURCE|VERIFIED|unavailable|authoritative/i.test(ht))fail('holders state absent');
  await page.locator('#rwaV5Bottom [data-v5-bottom="thesis"]').click();if(!await page.locator('[data-v5-thesis-text]').count())fail('thesis composer missing');
  await shot(page,'desktop-v22-post-interaction');await ctx.close();return info;
}

async function mobile(width,height,name,{interact=true}={}){
  const ctx=await browser.newContext({viewport:{width,height},deviceScaleFactor:1,serviceWorkers:'block'}),page=await ctx.newPage();
  page.on('pageerror',e=>pageErrors.push(name+': '+String(e?.message||e)));
  await ready(page);const info=await snapshot(page);
  const mode=await page.evaluate(()=>({mode:document.body.dataset.v5MobileMode,chart:getComputedStyle(document.querySelector('.chart-wrap')).display,book:getComputedStyle(document.querySelector('.right')).display,trade:getComputedStyle(document.querySelector('#liveRail')).display}));
  verifyCore(info,name);
  if(mode.mode!=='chart'||mode.chart==='none'||mode.book!=='none'||mode.trade!=='none')fail(name+' default chart state',mode);
  if(info.v22.mobile.overflow>2)fail(name+' overflow',info.v22.mobile.overflow);
  if(JSON.stringify(info.v22.mobile.tabs)!==JSON.stringify(['chart','book','trade','feed']))fail(name+' worktabs',info.v22.mobile.tabs);
  if(JSON.stringify(info.v22.mobile.bottom)!==JSON.stringify(['home','markets','trade','portfolio','profile']))fail(name+' bottom nav',info.v22.mobile.bottom);
  if(!info.v22.mobile.quick||info.v22.mobile.quick.display==='none'||info.v22.mobile.quick.height<120||info.v22.mobile.quick.y+info.v22.mobile.quick.height>height-55)fail(name+' quick trade not above nav',info.v22.mobile.quick);
  if(!await page.locator('#rwaV5MobileQuickTrade .rwa-v5-mobile-primary').isVisible())fail(name+' CTA missing');
  if(info.desktopPrice!=='none')fail(name+' duplicate desktop price leaked into mobile',info.desktopPrice);
  if(info.mobilePrice==='none'||info.mobilePrice==='missing')fail(name+' mobile price missing',info.mobilePrice);
  await shot(page,name);
  if(interact){
    await page.locator('.rwa-v5-mobile-worktabs [data-v5-mobile-mode="book"]').click();if(!await page.locator('.right').isVisible())fail(name+' book failed');
    await page.locator('.rwa-v5-mobile-worktabs [data-v5-mobile-mode="trade"]').click();if(!await page.locator('#liveRail #rwaTargetOrderTicket').isVisible())fail(name+' trade failed');
    await page.locator('.rwa-v5-mobile-worktabs [data-v5-mobile-mode="feed"]').click();if(!await page.locator('#rwaV5MobileFeed').isVisible())fail(name+' feed failed');
    await page.locator('.rwa-v5-mobile-worktabs [data-v5-mobile-mode="chart"]').click();await page.locator('.mobile-tabs [data-v5-mobile-nav="markets"]').click();await page.waitForTimeout(30);if(!await page.locator('.left').isVisible())fail(name+' markets drawer failed');
    await page.locator('[data-v5-action="close-markets"]').click();await page.locator('.mobile-tabs [data-v5-mobile-nav="portfolio"]').click();await page.waitForTimeout(30);if(!await page.locator('#rwaV5Bottom').isVisible())fail(name+' portfolio failed');
    if(await page.locator('.topnav').isVisible().catch(()=>false))fail(name+' desktop nav leaked');
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);if(overflow>2)fail(name+' post overflow',overflow);
    await shot(page,name+'-post-interaction');
  }
  await ctx.close();return{info,mode};
}

let audit={};
try{
  audit.referenceDesktop=await referenceDesktop();
  audit.desktop=await desktopOperational();
  audit.referenceMobile=await mobile(321,737,'mobile-reference-321x737-v22',{interact:false});
  audit.mobile390=await mobile(390,844,'mobile-390x844-v22');
  audit.mobile430=await mobile(430,932,'mobile-430x932-v22');
}catch(e){fail('unexpected failure',String(e?.stack||e))}
await browser.close();
if(pageErrors.length)fail('page errors',pageErrors);
const out={ok:failures.length===0,contract:'rwa-terminal-v22-3-real-dom-reference-viewport-market-consistency',base,failures,audit};
await writeFile(proof+'/browser-result.json',JSON.stringify(out,null,2));
console.log(JSON.stringify(out,null,2));
if(!out.ok)process.exit(1);