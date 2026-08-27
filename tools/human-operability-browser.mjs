import {chromium} from 'playwright';
import assert from 'node:assert/strict';

const BASE=process.env.RWA_TEST_URL||'http://127.0.0.1:4173/rwa/';
const viewports=[
  ['phone-320',320,568,true],['phone-360',360,800,true],['phone-375',375,667,true],['phone-390',390,844,true],
  ['phone-412',412,915,true],['phone-430',430,932,true],['phone-landscape',844,390,true],
  ['tablet-768',768,1024,false],['tablet-820',820,1180,false],['laptop-1024',1024,768,false],
  ['laptop-1280',1280,720,false],['laptop-1366',1366,768,false],['laptop-1440',1440,900,false],
  ['laptop-1536',1536,864,false],['desktop-1920',1920,1080,false]
];
const markets=[['BTC',100000,1.1,9e8,false],['ONDO',1.25,3.5,12e6,true],['PAXG',3400,-1.2,5e6,true],['MPL',18.2,2.4,2.1e6,true],['POLYX',.24,-2.1,1.5e6,true],['AAVE',310,4.2,20e6,false],['CPOOL',.17,7.8,1e6,true],['TRU',.08,-3.3,.9e6,true],['OM',.95,5.1,7e6,true]].map(([base,price,change,vol,rwa])=>({base,symbol:`${base}USDT`,price,change,vol,rwa}));
const info={symbols:markets.map(x=>({symbol:x.symbol,baseAsset:x.base,quoteAsset:'USDT',status:'TRADING',isSpotTradingAllowed:true}))};
const tickers=markets.map(x=>({symbol:x.symbol,lastPrice:String(x.price),openPrice:String(x.price/(1+x.change/100)),priceChangePercent:String(x.change),highPrice:String(x.price*1.04),lowPrice:String(x.price*.96),quoteVolume:String(x.vol)}));
const klines=Array.from({length:180},(_,i)=>{const o=100+i*.1,c=o+(i%2?.4:-.3);return[Date.now()-(180-i)*900000,String(o),String(Math.max(o,c)+.6),String(Math.min(o,c)-.6),String(c),'1000']});

async function mocks(context){
  await context.route('**/api/v3/exchangeInfo',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(info)}));
  await context.route('**/api/v3/ticker/24hr*',r=>{const u=new URL(r.request().url()),sym=u.searchParams.get('symbol');return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(sym?(tickers.find(x=>x.symbol===sym)||tickers[0]):tickers)})});
  await context.route('**/api/v3/klines*',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(klines)}));
  await context.route('https://s3.tradingview.com/**',r=>r.abort());
  await context.route('https://api.hyperliquid.xyz/**',r=>r.fulfill({status:200,contentType:'application/json',body:'[]'}));
  await context.route('https://api.hyperliquid-testnet.xyz/**',r=>r.fulfill({status:200,contentType:'application/json',body:'[]'}));
}
async function ready(page){
  await page.waitForFunction(()=>window.RWASuperApp?.version==='5.0.0',{timeout:25000});
  await page.waitForSelector('link[data-rwa-human-operability]',{state:'attached',timeout:8000});
  await page.waitForTimeout(250);
}
async function root(page,label){assert.equal(new URL(page.url()).pathname,'/rwa/',`${label}: escaped canonical /rwa/`)}

async function geometry(page,name,width,height,isMobile){
  const g=await page.evaluate(({width,height,isMobile})=>{
    const visible=e=>{const s=getComputedStyle(e),r=e.getBoundingClientRect();return s.display!=='none'&&s.visibility!=='hidden'&&Number(s.opacity)!==0&&r.width>1&&r.height>1};
    const rect=e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height,b:r.bottom,r:r.right}};
    const badFont=[];
    const selectors=['.pairmeta b','.pairprice b','.filter','.qstat small','.panel-title','.bookrow','.mobile-tabs a small','.mobile-tabs [data-v5-mobile] small','.rwa-super-card-head small','.rwa-super-note'];
    for(const sel of selectors)for(const e of document.querySelectorAll(sel)){if(!visible(e))continue;const px=parseFloat(getComputedStyle(e).fontSize)||0,min=isMobile?9.5:10;if(px<min)badFont.push({sel,px,text:(e.textContent||'').trim().slice(0,40)})}
    const badTouch=[];
    if(isMobile){const touchSel=['.filter','.mobile-detail-tabs button','.mobile-market-close','.mobile-tabs a','.mobile-tabs [data-v5-mobile]','.rwa-asset-detail-tabs button','.rwa-research-tabs button','.rwa-human-factory-back'];for(const sel of touchSel)for(const e of document.querySelectorAll(sel)){if(!visible(e))continue;const r=rect(e);if(r.w<40||r.h<40)badTouch.push({sel,w:r.w,h:r.h,text:(e.textContent||'').trim().slice(0,30)})}}
    const nav=document.querySelector('.mobile-tabs'),navr=nav&&visible(nav)?rect(nav):null;
    const overlaps=[];
    if(navr){for(const e of document.querySelectorAll('button,input,select,textarea')){if(!visible(e)||nav.contains(e))continue;const r=rect(e);if(r.b>navr.y+2&&r.y<navr.b-2&&r.x<navr.r&&r.r>navr.x)overlaps.push({tag:e.tagName,text:(e.textContent||e.getAttribute('aria-label')||'').trim().slice(0,30),r})}}
    const main=document.querySelector('.main'),mr=main&&visible(main)?rect(main):null;
    const scrollContainers=[...document.querySelectorAll('*')].filter(e=>{if(!visible(e))return false;const s=getComputedStyle(e);return /(auto|scroll)/.test(s.overflowY)&&e.scrollHeight>e.clientHeight+8}).map(e=>({tag:e.tagName,id:e.id,cls:e.className,sh:e.scrollHeight,ch:e.clientHeight}));
    return{width,height,scrollWidth:document.documentElement.scrollWidth,badFont,badTouch,overlaps,main:mr,scrollContainers,bodyOverflow:getComputedStyle(document.body).overflow};
  },{width,height,isMobile});
  assert.ok(g.scrollWidth<=width+4,`${name}: horizontal overflow ${g.scrollWidth}/${width}`);
  assert.equal(g.badFont.length,0,`${name}: unreadable fonts ${JSON.stringify(g.badFont.slice(0,8))}`);
  assert.equal(g.badTouch.length,0,`${name}: undersized touch targets ${JSON.stringify(g.badTouch.slice(0,8))}`);
  assert.equal(g.overlaps.length,0,`${name}: bottom-nav overlap ${JSON.stringify(g.overlaps.slice(0,5))}`);
  if(!isMobile&&width>=1440&&g.main)assert.ok(g.main.w>=700,`${name}: main work surface too narrow ${g.main.w}`);
  if(!isMobile&&width>=1200&&width<1440&&g.main)assert.ok(g.main.w>=630,`${name}: laptop main surface too narrow ${g.main.w}`);
  if(!isMobile&&width>=900&&width<1200&&g.main)assert.ok(g.main.w>=620,`${name}: small-laptop main surface too narrow ${g.main.w}`);
  return g;
}

async function matrix(browser){
  const results=[];
  for(const [name,width,height,isMobile] of viewports){
    const context=await browser.newContext({locale:'en-US',viewport:{width,height},isMobile,hasTouch:isMobile,serviceWorkers:'block'});await mocks(context);const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(String(e.message||e)));
    await page.goto(BASE+'?human-operability=1#markets',{waitUntil:'domcontentloaded',timeout:30000});await ready(page);await root(page,name);
    const g=await geometry(page,name,width,height,isMobile);assert.equal(errors.length,0,`${name}: uncaught errors ${errors.join(' | ')}`);results.push({name,width,height,main:g.main?.w||null,scrollContainers:g.scrollContainers.length});await context.close();
  }
  return results;
}

async function deepDesktop(browser){
  const context=await browser.newContext({locale:'en-US',viewport:{width:1366,height:768},serviceWorkers:'block'});await mocks(context);const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(String(e.message||e)));
  await page.goto(BASE+'?human-operability=desktop#markets',{waitUntil:'domcontentloaded',timeout:30000});await ready(page);
  for(const r of ['markets','asset/ONDO','research','institutional','portfolio']){await page.evaluate(x=>window.RWASuperApp.navigate(x),r);await page.waitForTimeout(180);await root(page,'desktop '+r);await geometry(page,'desktop '+r,1366,768,false)}
  await page.evaluate(()=>window.RWASuperApp.navigate('asset/ONDO'));await page.waitForTimeout(120);const drawer=await page.locator('#rwaSuperWorkspace').boundingBox();const main=await page.locator('.main').boundingBox();assert.ok(drawer&&drawer.width<=410,`desktop asset drawer too wide ${drawer?.width}`);assert.ok(main&&main.width>=620,`desktop chart crushed by drawer ${main?.width}`);
  await page.evaluate(()=>window.RWASuperApp.navigate('research/renko/ONDO'));await page.waitForSelector('.rwa-research-legacy-frame',{timeout:5000});const research=await page.evaluate(()=>{const f=document.querySelector('.rwa-research-legacy-frame'),w=f?.parentElement;return{frame:f?getComputedStyle(f):null,wrap:w?getComputedStyle(w):null}});assert.ok(research.frame,'research frame missing');
  await page.evaluate(()=>window.RWASuperApp.navigate('institutional'));await page.waitForTimeout(120);await page.getByRole('button',{name:/Start issuer workspace/i}).click();await page.waitForSelector('[data-global-rwa-factory] iframe',{state:'visible',timeout:6000});const factory=await page.locator('[data-global-rwa-factory]').boundingBox();assert.ok(factory&&factory.height<=730&&factory.height>=600,`desktop factory height unsafe ${factory?.height}`);
  const frame=page.frameLocator('[data-global-rwa-factory] iframe');await frame.locator('#rwaFactoryForm').waitFor({state:'visible',timeout:8000});const inner=await frame.locator('body').evaluate(()=>({w:innerWidth,sw:document.documentElement.scrollWidth,font:parseFloat(getComputedStyle(document.body).fontSize)}));assert.ok(inner.sw<=inner.w+3,`desktop P21 overflow ${inner.sw}/${inner.w}`);assert.ok(inner.font>=14,`desktop P21 font ${inner.font}`);
  await page.evaluate(()=>window.RWASuperApp.navigate('assets'));await page.evaluate(()=>window.RWASuperApp.navigate('research'));await page.goBack();await page.waitForTimeout(120);assert.equal(new URL(page.url()).hash,'#assets','desktop Back lost route state');await page.goForward();await page.waitForTimeout(120);assert.equal(new URL(page.url()).hash,'#research','desktop Forward lost route state');
  assert.equal(errors.length,0,`desktop deep errors ${errors.join(' | ')}`);await context.close();return true;
}

async function deepMobile(browser){
  const context=await browser.newContext({locale:'en-US',viewport:{width:390,height:844},isMobile:true,hasTouch:true,serviceWorkers:'block'});await mocks(context);const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(String(e.message||e)));
  await page.goto(BASE+'?human-operability=mobile#markets',{waitUntil:'domcontentloaded',timeout:30000});await ready(page);
  await page.evaluate(()=>window.RWASuperApp.navigate('asset/ONDO'));await page.waitForTimeout(150);await geometry(page,'mobile asset',390,844,true);const sheet=await page.locator('#rwaSuperWorkspace').boundingBox();assert.ok(sheet&&sheet.y>=50&&sheet.height<=730,`mobile asset sheet unsafe ${JSON.stringify(sheet)}`);
  await page.evaluate(()=>window.RWASuperApp.navigate('research/renko/ONDO'));await page.waitForSelector('.rwa-research-legacy-frame',{timeout:5000});const research=await page.evaluate(()=>{const f=document.querySelector('.rwa-research-legacy-frame'),w=f?.parentElement,fs=f&&getComputedStyle(f),ws=w&&getComputedStyle(w);return{fh:f?.getBoundingClientRect().height||0,wh:w?.getBoundingClientRect().height||0,fo:fs?.overflowY,wo:ws?.overflowY}});assert.ok(research.fh>300&&Math.abs(research.fh-research.wh)<8,`mobile research nested sizing ${JSON.stringify(research)}`);
  await page.evaluate(()=>window.RWASuperApp.navigate('institutional'));await page.waitForTimeout(100);await page.getByRole('button',{name:/Start issuer workspace/i}).click();await page.waitForSelector('[data-global-rwa-factory] iframe',{state:'visible',timeout:6000});const factory=await page.locator('[data-global-rwa-factory]').evaluate(e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return{x:r.x,y:r.y,w:r.width,h:r.height,pos:s.position,overflow:s.overflow}});assert.equal(factory.pos,'fixed','mobile factory must be full-screen fixed route');assert.ok(factory.y>=48&&factory.h<=740,`mobile factory geometry ${JSON.stringify(factory)}`);assert.equal(factory.overflow,'hidden','mobile factory parent must not create nested scroll');
  const frame=page.frameLocator('[data-global-rwa-factory] iframe');await frame.locator('#rwaFactoryForm').waitFor({state:'visible',timeout:8000});const controls=await frame.locator('body').evaluate(()=>{const visible=e=>{const s=getComputedStyle(e),r=e.getBoundingClientRect();return s.display!=='none'&&s.visibility!=='hidden'&&r.width>1&&r.height>1};const bad=[...document.querySelectorAll('button,input,select,textarea')].filter(visible).map(e=>{const r=e.getBoundingClientRect();return{tag:e.tagName,h:r.height,w:r.width,text:(e.textContent||e.getAttribute('name')||'').trim().slice(0,30)}}).filter(x=>x.h<40);return{w:innerWidth,sw:document.documentElement.scrollWidth,font:parseFloat(getComputedStyle(document.body).fontSize),bad}});assert.ok(controls.sw<=controls.w+3,`mobile P21 overflow ${controls.sw}/${controls.w}`);assert.ok(controls.font>=14,`mobile P21 font ${controls.font}`);assert.equal(controls.bad.length,0,`mobile P21 small controls ${JSON.stringify(controls.bad.slice(0,8))}`);
  await frame.locator('input[name="legalName"]').focus();await page.setViewportSize({width:390,height:520});await page.waitForTimeout(100);const focus=await frame.locator('input[name="legalName"]').evaluate(e=>{e.scrollIntoView({block:'center'});const r=e.getBoundingClientRect();return{top:r.top,bottom:r.bottom,h:innerHeight}});assert.ok(focus.top>=0&&focus.bottom<=focus.h,`virtual-keyboard simulation hides focused field ${JSON.stringify(focus)}`);
  await page.setViewportSize({width:390,height:844});await page.locator('[data-rwa-factory-back]').click();await page.waitForTimeout(100);assert.equal(new URL(page.url()).hash,'#markets','factory Back did not return to markets');
  assert.equal(errors.length,0,`mobile deep errors ${errors.join(' | ')}`);await context.close();return true;
}

const browser=await chromium.launch({headless:true});
try{
  const matrixResult=await matrix(browser);await deepDesktop(browser);await deepMobile(browser);
  console.log('TYPOGRAPHY_READABILITY=PASS');
  console.log('TOUCH_TARGETS=PASS');
  console.log('NO_FIXED_OVERLAP=PASS');
  console.log('NO_NESTED_SCROLL_TRAPS=PASS');
  console.log('ROUTE_TRANSITION_STABILITY=PASS');
  console.log('FORM_KEYBOARD_SAFETY=PASS');
  console.log('P21_MOBILE_JOURNEY=PASS');
  console.log('MOBILE_HUMAN_OPERABILITY=PASS');
  console.log('DESKTOP_HUMAN_OPERABILITY=PASS');
  console.log(JSON.stringify({ok:true,contract:'rwa-human-operability-v1',viewports:matrixResult},null,2));
}finally{await browser.close()}
