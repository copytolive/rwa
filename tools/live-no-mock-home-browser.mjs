import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';

const base=process.env.RWA_UI_URL||'http://127.0.0.1:4173/rwa/';
const proof=process.env.RWA_UI_PROOF_DIR||'proof/terminal-v5';
await mkdir(proof,{recursive:true});
const browser=await chromium.launch({headless:true});
const failures=[],pageErrors=[];
const fail=(message,detail=null)=>failures.push({message,detail});
const near=(a,b,t=3)=>Math.abs(Number(a)-Number(b))<=t;
const rect=async(page,sel)=>page.locator(sel).first().evaluate(el=>{const r=el.getBoundingClientRect(),s=getComputedStyle(el);return{x:Math.round(r.x),y:Math.round(r.y),right:Math.round(r.right),bottom:Math.round(r.bottom),width:Math.round(r.width),height:Math.round(r.height),display:s.display,visibility:s.visibility}}).catch(()=>null);
async function shot(page,name){const path=proof+'/'+name+'.png';try{await page.screenshot({path,fullPage:false,timeout:12000})}catch{const cdp=await page.context().newCDPSession(page);try{const out=await cdp.send('Page.captureScreenshot',{format:'png',fromSurface:true,captureBeyondViewport:false});await writeFile(path,Buffer.from(out.data,'base64'))}finally{await cdp.detach().catch(()=>{})}}}
async function ready(page){
 await page.goto(base,{waitUntil:'domcontentloaded',timeout:50000});
 await page.waitForFunction(()=>window.RWALiveHome?.version==='5.0.0'&&window.RWATerminalV5?.version==='1.0.0'&&window.RWAMarketRuntime?.state?.().pairs?.length>50,{timeout:50000});
 await page.waitForFunction(()=>document.querySelectorAll('#bids .bookrow').length>=5&&document.querySelectorAll('#asks .bookrow').length>=5,{timeout:30000});
 await page.waitForFunction(()=>document.querySelector('#liveRail #rwaTargetOrderTicket'),{timeout:20000});
 await page.waitForTimeout(500);
}
async function desktop(){
 const ctx=await browser.newContext({viewport:{width:1672,height:941},deviceScaleFactor:1,serviceWorkers:'block'}),page=await ctx.newPage();
 page.on('pageerror',e=>pageErrors.push('desktop: '+String(e?.message||e)));
 await ready(page);
 const info=await page.evaluate(()=>({
   route:location.hash,
   bodyClass:document.body.className,
   globalNav:[...document.querySelectorAll('.topnav [data-v5-global]')].map(x=>x.dataset.v5Global),
   marketNav:[...document.querySelectorAll('#liveRail .rwa-v5-market-nav>button[data-v5-nav]')].map(x=>x.dataset.v5Nav),
   bottom:[...document.querySelectorAll('#rwaV5Bottom [data-v5-bottom]')].map(x=>x.dataset.v5Bottom),
   leftTabs:[...document.querySelectorAll('.rwa-v5-left-tabs [data-v5-left]')].map(x=>x.dataset.v5Left),
   search:!!document.querySelector('#rwaV5GlobalSearch'),
   ticketInside:!!document.querySelector('#liveRail #rwaTargetOrderTicket'),
   pairs:window.RWAMarketRuntime.state().pairs.length,
   commerce:/seablueprint|ecommerce|in-page commerce/i.test(document.body.innerText),
   mock:!!document.querySelector('#rwaScreenshotParity'),
   audit:window.RWATerminalV5.audit()
 }));
 if(info.route!=='#markets')fail('V5 route left markets',info.route);
 if(!info.bodyClass.includes('rwa-terminal-v5'))fail('V5 body class missing',info.bodyClass);
 if(JSON.stringify(info.globalNav)!==JSON.stringify(['markets']))fail('V5 global nav must contain only Markets',info.globalNav);
 if(JSON.stringify(info.marketNav)!==JSON.stringify(['trade','portfolio','orders','analytics','rewards','more']))fail('V5 Market-owned nav mismatch',info.marketNav);
 if(await page.locator('.topnav [data-v5-nav]').count())fail('non-Market navigation escaped into global topbar');
 if(JSON.stringify(info.bottom)!==JSON.stringify(['positions','orders','holders','feed','analytics','thesis','history']))fail('V5 bottom tabs mismatch',info.bottom);
 if(JSON.stringify(info.leftTabs)!==JSON.stringify(['watchlist','feed','pulse','live']))fail('V5 left tabs mismatch',info.leftTabs);
 if(!info.search||!info.ticketInside)fail('V5 primary structure incomplete',info);
 if(info.commerce||info.mock)fail('removed/mock content visible',{commerce:info.commerce,mock:info.mock});
 const g={top:await rect(page,'.topbar'),layout:await rect(page,'.layout'),left:await rect(page,'.left'),main:await rect(page,'.main'),book:await rect(page,'.right'),trade:await rect(page,'#liveRail'),bottom:await rect(page,'#rwaV5Bottom'),footer:await rect(page,'#rwaV5Footer')};
 const wants={top:{x:0,y:0,width:1672,height:55},layout:{x:0,y:55,width:1672,height:858},left:{x:0,y:55,width:238,height:858},trade:{x:1372,y:55,width:300,height:858},bottom:{x:238,y:693,width:1134,height:220},footer:{x:0,y:913,width:1672,height:28}};
 for(const [k,w] of Object.entries(wants)){const a=g[k];if(!a){fail('missing geometry '+k);continue}for(const [p,v] of Object.entries(w))if(!near(a[p],v,4))fail('geometry '+k+'.'+p,{want:v,got:a[p],full:a})}
 if(!g.main||g.main.x!==238||!near(g.main.width,884,5)||!near(g.main.height,638,5))fail('main geometry mismatch',g.main);
 if(!g.book||!near(g.book.x,1122,5)||!near(g.book.width,250,4)||!near(g.book.height,638,5))fail('order book geometry mismatch',g.book);
 const clickNav=async(key,expect)=>{
   await page.locator('#liveRail .rwa-v5-market-nav>button[data-v5-nav="'+key+'"]').click();await page.waitForTimeout(120);
   if((await page.evaluate(()=>location.hash))!=='#markets')fail(key+' changed route');
   const txt=await page.locator('#rwaV5Bottom').innerText();
   if(expect&&!expect.test(txt))fail(key+' content mismatch',txt.slice(0,1000));
 };
 await page.locator('#liveRail .rwa-v5-market-nav>button[data-v5-nav="more"]').click();
 await page.locator('#liveRail [data-v5-more-menu] [data-v5-nav="discover"]').click();await page.waitForTimeout(120);
 if(!/Top movers|Top volume/i.test(await page.locator('#rwaV5Bottom').innerText()))fail('discover content mismatch');
 await clickNav('portfolio',/Portfolio|Connect a wallet|ACCOUNT VALUE/i);
 await clickNav('orders',/Open Orders|Connect a wallet|No open orders/i);
 await clickNav('analytics',/LIVE PAIRS|RWA-LINKED|BUY PRESSURE/i);
 await clickNav('rewards',/No verified rewards program|INACTIVE|Rewards ledger unavailable|LOCKED|Rewards program/i);
 await page.locator('#liveRail .rwa-v5-market-nav>button[data-v5-nav="trade"]').click();
 if(!await page.locator('#liveRail #rwaTargetOrderTicket').isVisible())fail('Trade ticket not visible in rail');
 await page.locator('.rwa-v5-side-switch [data-v5-side="SELL"]').click();
 const side=await page.locator('#rwaTargetOrderTicket').getAttribute('data-v5-side');if(side!=='SELL')fail('Sell side switch failed',side);
 await page.locator('.rwa-v5-side-switch [data-v5-side="BUY"]').click();
 await page.locator('#rwaTargetOrderTicket [data-live-mode="STOP"]').click();
 if(!await page.locator('#rwaTargetOrderTicket [data-live-mode="STOP"]').evaluate(el=>el.classList.contains('active')))fail('STOP mode does not activate');
 if(await page.locator('#rwaTargetOrderTicket [data-order-side="BUY"] [data-live-price]').isDisabled())fail('STOP price input remains disabled');
 await page.locator('#rwaTargetOrderTicket [data-live-mode="MARKET"]').click();
 const ask=page.locator('#asks .bookrow').last();await ask.click();await page.waitForTimeout(60);
 if(!await page.locator('#rwaTargetOrderTicket [data-live-mode="LIMIT"]').evaluate(el=>el.classList.contains('active')))fail('Order book click did not select LIMIT');
 const lp=await page.locator('#rwaTargetOrderTicket [data-order-side="BUY"] [data-live-price]').inputValue();if(!(Number(lp)>0))fail('Order book click did not populate limit price',lp);
 await page.locator('#liveRail [data-v5-trade-tab="alerts"]').click();await page.waitForTimeout(50);
 const alertsTxt=await page.locator('[data-v5-alerts]').innerText();if(!/LOCAL BROWSER ALERT|LOCAL FALLBACK|SERVER ALERT 24\/7|SERVER 24\/7/.test(alertsTxt))fail('Alert system state missing',alertsTxt);
 await page.locator('.rwa-v5-left-tabs [data-v5-left="pulse"]').click();await page.waitForTimeout(50);if(!/Top Movers/i.test(await page.locator('[data-v5-left-pane="pulse"]').innerText()))fail('Pulse system missing');
 await page.locator('.rwa-v5-left-tabs [data-v5-left="live"]').click();await page.waitForTimeout(50);if(!/LIVE/i.test(await page.locator('[data-v5-left-pane="live"]').innerText()))fail('Live left system missing');
 await page.locator('#rwaV5Bottom [data-v5-bottom="holders"]').click();await page.waitForTimeout(50);if(!/Holders data unavailable|NEEDS HOLDER BACKEND|Holder source not configured|NEEDS AUTHORITATIVE SOURCE|Holders source|SOURCE GATED/i.test(await page.locator('[data-v5-bottom-body]').innerText()))fail('Holders fail-closed state missing');
 await page.locator('#rwaV5Bottom [data-v5-bottom="thesis"]').click();await page.waitForTimeout(50);if(!await page.locator('[data-v5-thesis-text]').count())fail('Thesis composer missing');
 await shot(page,'desktop-v5');
 await ctx.close();return{info,g};
}
async function mobile(width,height,name){
 const ctx=await browser.newContext({viewport:{width,height},deviceScaleFactor:1,serviceWorkers:'block'}),page=await ctx.newPage();page.on('pageerror',e=>pageErrors.push(name+': '+String(e?.message||e)));
 await ready(page);
 if(await page.locator('#rwaV5FirstPaintShell').count())fail(name+' fake first-paint shell still exists');
 let m=await page.evaluate(()=>({sw:document.documentElement.scrollWidth,cw:document.documentElement.clientWidth,mode:document.body.dataset.v5MobileMode,chart:getComputedStyle(document.querySelector('.chart-wrap')).display,book:getComputedStyle(document.querySelector('.right')).display,trade:getComputedStyle(document.querySelector('#liveRail')).display,mini:getComputedStyle(document.querySelector('#rwaV5MiniBook')).display}));
 if(m.sw>m.cw+2)fail(name+' horizontal overflow',m);if(m.mode!=='chart'||m.chart==='none'||m.mini==='none'||m.book!=='none'||m.trade!=='none')fail(name+' default Chart state invalid',m);
 await page.locator('.rwa-v5-mobile-worktabs [data-v5-mobile-mode="book"]').click();await page.waitForTimeout(50);m=await page.evaluate(()=>({mode:document.body.dataset.v5MobileMode,chart:getComputedStyle(document.querySelector('.chart-wrap')).display,book:getComputedStyle(document.querySelector('.right')).display,trade:getComputedStyle(document.querySelector('#liveRail')).display}));if(m.mode!=='book'||m.chart!=='none'||m.book==='none'||m.trade!=='none')fail(name+' Book state invalid',m);
 await page.locator('.rwa-v5-mobile-worktabs [data-v5-mobile-mode="trade"]').click();await page.waitForTimeout(50);m=await page.evaluate(()=>({mode:document.body.dataset.v5MobileMode,chart:getComputedStyle(document.querySelector('.chart-wrap')).display,book:getComputedStyle(document.querySelector('.right')).display,trade:getComputedStyle(document.querySelector('#liveRail')).display,ticket:!!document.querySelector('#liveRail #rwaTargetOrderTicket')}));if(m.mode!=='trade'||m.chart!=='none'||m.book!=='none'||m.trade==='none'||!m.ticket)fail(name+' Trade state invalid',m);
 await page.locator('.rwa-v5-mobile-worktabs [data-v5-mobile-mode="feed"]').click();await page.waitForTimeout(50);if(!await page.locator('#rwaV5MobileFeed').isVisible())fail(name+' Feed state invalid');
 await page.locator('.rwa-v5-mobile-worktabs [data-v5-action="open-markets"]').click();await page.waitForTimeout(50);if(!await page.locator('.left').isVisible())fail(name+' internal Markets drawer did not open');
 await page.locator('[data-v5-action="close-markets"]').click();await page.waitForTimeout(50);
 await page.locator('.rwa-v5-mobile-worktabs [data-v5-mobile-mode="trade"]').click();await page.waitForTimeout(30);
 await page.locator('#liveRail .rwa-v5-market-nav>button[data-v5-nav="portfolio"]').click();await page.waitForTimeout(50);if(!await page.locator('#rwaV5Bottom').isVisible())fail(name+' Market-owned Portfolio workspace did not open');
 const escaped=await page.locator('.mobile-tabs [data-v5-mobile-nav],.topnav [data-v5-nav]').count();if(escaped)fail(name+' found navigation outside Market',escaped);
 const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);if(overflow>2)fail(name+' overflow after interactions',overflow);
 await shot(page,name);await ctx.close();return m;
}
let audit={};try{audit.desktop=await desktop();audit.mobile390=await mobile(390,844,'mobile-390x844-v5');audit.mobile430=await mobile(430,932,'mobile-430x932-v5')}catch(e){fail('unexpected failure',String(e?.stack||e))}
await browser.close();if(pageErrors.length)fail('page errors',pageErrors);
const out={ok:failures.length===0,contract:'rwa-terminal-v5-fomo-hyperliquid',base,failures,audit};
await writeFile(proof+'/browser-result.json',JSON.stringify(out,null,2));console.log(JSON.stringify(out,null,2));if(!out.ok)process.exit(1);
