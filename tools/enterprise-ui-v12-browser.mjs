import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';

const BASE=process.env.RWA_BASE_URL||'http://127.0.0.1:4173/';
const OUT=process.env.RWA_ARTIFACT_DIR||'artifacts/enterprise-ui-v12';
await fs.mkdir(OUT,{recursive:true});

const symbols=[
  ['BTC',79279.31,78448,80520,77632.58,1170000000],['PYTH',.04916,.0505,.05104,.04626,146100000],
  ['SOL',106.45,96.02,106.68,94.95,439020000],['ETH',2511.2,2450,2530,2410,910000000],
  ['XRP',1.4582,1.38,1.49,1.35,280000000],['ONDO',.965,.92,.98,.91,68000000]
].map(([base,price,open,high,low,vol])=>({symbol:`${base}USDT`,base,price,open,high,low,vol}));
const exchangeInfo={symbols:symbols.map(x=>({symbol:x.symbol,status:'TRADING',quoteAsset:'USDT',baseAsset:x.base,isSpotTradingAllowed:true}))};
const ticker24=symbols.map(x=>({symbol:x.symbol,lastPrice:String(x.price),openPrice:String(x.open),priceChangePercent:String((x.price-x.open)/x.open*100),highPrice:String(x.high),lowPrice:String(x.low),quoteVolume:String(x.vol)}));
const klines=Array.from({length:180},(_,i)=>{const p=100+i*.02+Math.sin(i/8)*1.4;return[Date.now()-(180-i)*900000,String(p),String(p+.5),String(p-.5),String(p+.15),String(100+i),0,0,0,0,0,0]});

function stubScript(){class WS{static OPEN=1;static CLOSED=3;constructor(url){this.url=url;this.readyState=1;setTimeout(()=>this.onopen?.({}),0)}close(){this.readyState=3;this.onclose?.({})}send(){}addEventListener(t,f){this['on'+t]=f}removeEventListener(t,f){if(this['on'+t]===f)this['on'+t]=null}}Object.defineProperty(window,'WebSocket',{value:WS,configurable:true})}
async function prepare(page){
  await page.addInitScript(stubScript);
  await page.route('**/api/v3/exchangeInfo',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(exchangeInfo)}));
  await page.route('**/api/v3/ticker/24hr*',r=>{const u=new URL(r.request().url()),sym=u.searchParams.get('symbol'),body=sym?(ticker24.find(x=>x.symbol===sym)||ticker24[0]):ticker24;return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)})});
  await page.route('**/api/v3/klines*',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(klines)}));
  await page.route('https://s3.tradingview.com/**',r=>r.abort());
  await page.route('https://api.hyperliquid.xyz/**',r=>r.fulfill({status:200,contentType:'application/json',body:'[]'}));
  await page.route('https://api.hyperliquid-testnet.xyz/**',r=>r.fulfill({status:200,contentType:'application/json',body:'[]'}));
}
async function ready(page){await page.waitForFunction(()=>document.documentElement.dataset.rwaEnterpriseUi==='12'&&window.RWASuperApp?.version==='5.0.0',{timeout:15000})}
async function go(page,route){
  await page.evaluate(r=>window.RWASuperApp.navigate(r),route);
  await page.waitForFunction(r=>(document.documentElement.dataset.rwaRoute||'')===r,route,{timeout:10000});
  await page.waitForFunction(()=>{const v=e=>e&&getComputedStyle(e).display!=='none'&&e.getBoundingClientRect().width>1&&e.getBoundingClientRect().height>1;return[document.querySelector('.right'),document.getElementById('rwaSuperWorkspace'),document.getElementById('suite')].filter(v).length===1},{timeout:12000});
  await page.waitForTimeout(route==='portfolio'?650:220);
}
async function geometry(page){return page.evaluate(()=>{
  const b=e=>{if(!e)return null;const r=e.getBoundingClientRect(),s=getComputedStyle(e);return{x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,display:s.display,position:s.position}};
  const right=b(document.querySelector('.right')),workspace=b(document.getElementById('rwaSuperWorkspace')),suite=b(document.getElementById('suite')),layout=b(document.querySelector('.layout')),left=b(document.querySelector('.left')),main=b(document.querySelector('.main'));
  const v=x=>x&&x.display!=='none'&&x.w>1&&x.h>1,docks=[['right',right],['workspace',workspace],['suite',suite]].filter(([,x])=>v(x)).map(([name,x])=>({name,...x}));
  return{route:document.documentElement.dataset.rwaRoute||'',clientWidth:document.documentElement.clientWidth,layout,left,main,right,workspace,suite,docks};
})}
const near=(a,b,t=.8)=>Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=t;

async function desktopProof(browser,width,height){
  const page=await browser.newPage({viewport:{width,height}});await prepare(page);await page.goto(BASE+'#asset/PYTH',{waitUntil:'domcontentloaded'});await ready(page);await page.waitForSelector('.pairrow[data-sym="SOLUSDT"]',{timeout:15000});await page.waitForTimeout(500);
  const before=await geometry(page),violations=[];const asset0=before.docks.find(x=>x.name==='workspace');
  if(!asset0||!near(asset0.w,440))violations.push(`asset baseline dock ${asset0?.w} != 440`);

  const frames=await page.evaluate(async()=>{
    const row=document.querySelector('.pairrow[data-sym="SOLUSDT"]');if(!row)throw Error('SOL row missing');
    const out=[],g=s=>{const e=document.querySelector(s);if(!e)return null;const r=e.getBoundingClientRect(),c=getComputedStyle(e);return{w:r.width,x:r.x,right:r.right,display:c.display}};
    row.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,view:window}));
    await new Promise(resolve=>{let n=0;const tick=()=>{out.push({route:document.documentElement.dataset.rwaRoute||'',layout:g('.layout'),left:g('.left'),main:g('.main'),right:g('.right'),workspace:g('#rwaSuperWorkspace')});if(++n===75)return resolve();requestAnimationFrame(tick)};requestAnimationFrame(tick)});return out;
  });
  for(const [i,f] of frames.entries()){
    if(!f.workspace||!near(f.workspace.w,440))violations.push(`pair frame ${i}: workspace ${f.workspace?.w} != 440`);
    if(f.right&&f.right.display!=='none'&&f.right.w>1)violations.push(`pair frame ${i}: duplicate legacy right ${f.right.w}`);
    if(!near(f.layout?.w,before.layout?.w))violations.push(`pair frame ${i}: layout shifted`);
    if(!near(f.left?.w,before.left?.w))violations.push(`pair frame ${i}: left shifted`);
    if(!near(f.main?.w,before.main?.w))violations.push(`pair frame ${i}: main shifted`);
  }

  const routeSweep=[];
  for(const route of ['markets','trade/SOL','intelligence','assets','research','asset/SOL','portfolio','institutional']){
    await go(page,route);const g=await geometry(page);routeSweep.push(g);
    if(g.route!==route)violations.push(`${route}: route state ${g.route}`);
    if(g.docks.length!==1)violations.push(`${route}: visible dock count ${g.docks.length}`);
    const d=g.docks[0];if(!d||!near(d.w,440))violations.push(`${route}: ${d?.name||'none'} width ${d?.w} != 440`);
    if(d&&d.position!=='fixed')violations.push(`${route}: ${d.name} position ${d.position}`);
    if(d&&!near(d.right,g.clientWidth,1.2))violations.push(`${route}: dock right edge ${d.right} != layout viewport ${g.clientWidth}`);
    if(!near(g.layout?.w,before.layout?.w))violations.push(`${route}: layout width ${g.layout?.w} != ${before.layout?.w}`);
    if(!near(g.left?.w,before.left?.w))violations.push(`${route}: left width ${g.left?.w} != ${before.left?.w}`);
    if(!near(g.main?.w,before.main?.w))violations.push(`${route}: main width ${g.main?.w} != ${before.main?.w}`);
  }

  const visual=await page.evaluate(()=>{
    const fs=s=>{const e=document.querySelector(s);return e?parseFloat(getComputedStyle(e).fontSize):null};
    const rail=[...document.querySelectorAll('#rwaExperienceRail [data-rwa-level]')].map(e=>({w:e.getBoundingClientRect().width,sub:parseFloat(getComputedStyle(e.querySelector('small')).fontSize)}));
    const cmd=document.querySelector('.rwa-command-button'),quality=document.querySelector('.rwa-quality-badge'),health=document.querySelector('.rwa-health');
    return{rail,cmdBg:cmd?getComputedStyle(cmd).backgroundColor:null,debug:[quality,health].filter(Boolean).map(e=>getComputedStyle(e).display),viewport:document.querySelector('meta[name="viewport"]')?.content||'',type:{pair:fs('.pairmeta b'),pairMeta:fs('.pairmeta small'),pairPrice:fs('.pairprice b'),change:fs('.chg'),book:fs('.bookrow'),trade:fs('.trade'),instrument:fs('.instrument b'),instrumentMeta:fs('.instrument small')}};
  });
  if(Math.max(...visual.rail.map(x=>x.w))-Math.min(...visual.rail.map(x=>x.w))>.8)violations.push('rail columns unequal');
  if(visual.rail.some(x=>x.sub<9.5))violations.push('rail secondary type too small');
  for(const [k,min] of Object.entries({pair:11.5,pairMeta:10,pairPrice:11,change:10,book:10,trade:10,instrument:14.5,instrumentMeta:10.5}))if(visual.type[k]!=null&&visual.type[k]<min)violations.push(`${k} type ${visual.type[k]} < ${min}`);
  if(visual.cmdBg==='rgb(255, 255, 255)')violations.push('Search / Command is white/default');
  if(visual.debug.some(x=>x!=='none'))violations.push('consumer debug overlay visible');
  if(visual.viewport.includes('user-scalable=no'))violations.push('pinch zoom disabled');
  await go(page,'asset/SOL');await page.screenshot({path:path.join(OUT,`${width}-desktop-single-dock.png`),fullPage:true});await page.close();
  return{viewport:{width,height},routeSweep,visual,violations};
}

async function mobileProof(browser,width,height){
  const page=await browser.newPage({viewport:{width,height},isMobile:true,hasTouch:true});await prepare(page);await page.goto(BASE+'#markets',{waitUntil:'domcontentloaded'});await ready(page);await page.waitForFunction(()=>document.querySelectorAll('.mobile-tabs [data-v5-mobile]').length===5,{timeout:10000});await page.waitForTimeout(500);
  const data=await page.evaluate(()=>{const tabs=[...document.querySelectorAll('.mobile-tabs [data-v5-mobile]')].map(e=>{const r=e.getBoundingClientRect(),s=e.querySelector('small');return{right:r.right,w:r.width,h:r.height,fs:s?parseFloat(getComputedStyle(s).fontSize):0}}),strip=document.getElementById('rwaMobileInstrumentStrip'),sr=strip?.getBoundingClientRect(),pair=strip?.querySelector('[data-rwa-mobile-pair]'),pr=pair?.getBoundingClientRect();return{tabs,strip:sr?{w:sr.width,h:sr.height,display:getComputedStyle(strip).display}:null,pair:pr?{w:pr.width,h:pr.height}:null,scrollWidth:document.documentElement.scrollWidth,innerWidth,viewport:document.querySelector('meta[name="viewport"]')?.content||'',debug:[document.querySelector('.rwa-quality-badge'),document.querySelector('.rwa-health')].filter(Boolean).map(e=>getComputedStyle(e).display)}});
  const violations=[];if(data.tabs.length!==5)violations.push('mobile nav is not five items');if(data.tabs.some(x=>x.h<44))violations.push('mobile nav touch target <44');if(data.tabs.some(x=>x.fs<9))violations.push('mobile nav text too small');if(data.tabs.at(-1)?.right>width+1)violations.push('fifth mobile nav clipped');if(data.scrollWidth>width+1)violations.push(`horizontal overflow ${data.scrollWidth}`);if(!data.strip||data.strip.display==='none'||data.strip.w<width-2)violations.push('mobile instrument strip missing');if(!data.pair||data.pair.h<44||data.pair.w<44)violations.push('mobile pair selector <44');if(data.viewport.includes('user-scalable=no'))violations.push('mobile zoom disabled');if(data.debug.some(x=>x!=='none'))violations.push('mobile debug overlay visible');
  await page.screenshot({path:path.join(OUT,`${width}-mobile.png`),fullPage:true});await page.close();return{viewport:{width,height},violations};
}

const browser=await chromium.launch({headless:true}),results=[];
for(const [w,h] of [[2048,1129],[1600,1000]])results.push({kind:'desktop',...(await desktopProof(browser,w,h))});
for(const [w,h] of [[430,932],[390,844],[360,800],[320,568]])results.push({kind:'mobile',...(await mobileProof(browser,w,h))});
await browser.close();await fs.writeFile(path.join(OUT,'results.json'),JSON.stringify(results,null,2));
const bad=results.flatMap(r=>r.violations.map(v=>`${r.kind} ${r.viewport.width}x${r.viewport.height}: ${v}`));console.log(JSON.stringify(results.map(r=>({kind:r.kind,viewport:r.viewport,violations:r.violations})),null,2));if(bad.length){console.error('\nV12 FAIL\n'+bad.join('\n'));process.exit(1)}console.log('\nRWA_ENTERPRISE_UI_V12_SINGLE_DOCK_440=PASS');
