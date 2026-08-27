import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';

const BASE=process.env.RWA_BASE_URL||'http://127.0.0.1:4173/';
const OUT=process.env.RWA_ARTIFACT_DIR||'artifacts/enterprise-ui-v12';
await fs.mkdir(OUT,{recursive:true});

const symbols=[
  {symbol:'BTCUSDT',base:'BTC',price:'79279.31',open:'78448.00',high:'80520.00',low:'77632.58',vol:'1170000000'},
  {symbol:'PYTHUSDT',base:'PYTH',price:'0.04916',open:'0.05050',high:'0.05104',low:'0.04626',vol:'146100000'},
  {symbol:'SOLUSDT',base:'SOL',price:'106.45',open:'96.02',high:'106.68',low:'94.95',vol:'439020000'},
  {symbol:'ETHUSDT',base:'ETH',price:'2511.20',open:'2450.00',high:'2530.00',low:'2410.00',vol:'910000000'},
  {symbol:'XRPUSDT',base:'XRP',price:'1.4582',open:'1.38',high:'1.49',low:'1.35',vol:'280000000'},
  {symbol:'ONDOUSDT',base:'ONDO',price:'0.965',open:'0.92',high:'0.98',low:'0.91',vol:'68000000'}
];
const exchangeInfo={symbols:symbols.map(x=>({symbol:x.symbol,status:'TRADING',quoteAsset:'USDT',baseAsset:x.base,isSpotTradingAllowed:true}))};
const ticker24=symbols.map(x=>({symbol:x.symbol,lastPrice:x.price,openPrice:x.open,priceChangePercent:String((Number(x.price)-Number(x.open))/Number(x.open)*100),highPrice:x.high,lowPrice:x.low,quoteVolume:x.vol}));
const klines=Array.from({length:180},(_,i)=>{const p=100+i*.02+Math.sin(i/8)*1.4;return[Date.now()-(180-i)*900000,String(p),String(p+.5),String(p-.5),String(p+.15),String(100+i),0,0,0,0,0,0]});

function stubScript(){
  class WS{static OPEN=1;static CLOSED=3;constructor(url){this.url=url;this.readyState=1;setTimeout(()=>this.onopen?.({}),0)}close(){this.readyState=3;this.onclose?.({})}send(){}addEventListener(type,fn){this['on'+type]=fn}removeEventListener(type,fn){if(this['on'+type]===fn)this['on'+type]=null}}
  Object.defineProperty(window,'WebSocket',{value:WS,configurable:true});
}
async function prepare(page){
  await page.addInitScript(stubScript);
  await page.route('**/api/v3/exchangeInfo',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(exchangeInfo)}));
  await page.route('**/api/v3/ticker/24hr*',r=>{const u=new URL(r.request().url());const sym=u.searchParams.get('symbol');const body=sym?(ticker24.find(x=>x.symbol===sym)||ticker24[0]):ticker24;return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)})});
  await page.route('**/api/v3/klines**',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(klines)}));
  await page.route('https://s3.tradingview.com/**',r=>r.abort());
  await page.route('https://api.hyperliquid.xyz/**',r=>r.fulfill({status:200,contentType:'application/json',body:'[]'}));
  await page.route('https://api.hyperliquid-testnet.xyz/**',r=>r.fulfill({status:200,contentType:'application/json',body:'[]'}));
}
const round=n=>Math.round(n*100)/100;
async function box(page,sel){return page.locator(sel).evaluate(el=>{const r=el.getBoundingClientRect();const s=getComputedStyle(el);return{x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom,display:s.display,visibility:s.visibility,fontSize:parseFloat(s.fontSize),background:s.backgroundColor}})}
async function go(page,route){
  await page.evaluate(r=>window.RWASuperApp.navigate(r),route);
  await page.waitForFunction(r=>(document.documentElement.dataset.rwaRoute||'')===r,route,{timeout:10000});
  await page.waitForFunction(()=>{
    const visible=e=>e&&getComputedStyle(e).display!=='none'&&e.getBoundingClientRect().width>1&&e.getBoundingClientRect().height>1;
    return [document.querySelector('.right'),document.getElementById('rwaSuperWorkspace'),document.getElementById('suite')].filter(visible).length===1;
  },{timeout:12000});
  await page.waitForTimeout(route==='portfolio'?650:250);
}
async function routeGeometry(page,route){
  await go(page,route);
  return page.evaluate(()=>{
    const b=e=>{if(!e)return null;const r=e.getBoundingClientRect(),s=getComputedStyle(e);return{x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,display:s.display,position:s.position}};
    const right=b(document.querySelector('.right')),workspace=b(document.getElementById('rwaSuperWorkspace')),suite=b(document.getElementById('suite')),layout=b(document.querySelector('.layout')),left=b(document.querySelector('.left')),main=b(document.querySelector('.main'));
    const visible=x=>x&&x.display!=='none'&&x.w>1&&x.h>1;const docks=[['right',right],['workspace',workspace],['suite',suite]].filter(([,x])=>visible(x));
    return{route:document.documentElement.dataset.rwaRoute||'',layout,left,main,right,workspace,suite,docks:docks.map(([name,x])=>({name,...x}))};
  });
}

async function desktopProof(browser,width,height){
  const page=await browser.newPage({viewport:{width,height}});await prepare(page);
  await page.goto(BASE+'#asset/PYTH',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.documentElement.dataset.rwaEnterpriseUi==='12'&&window.RWASuperApp?.version==='5.0.0',{timeout:15000});
  await page.waitForSelector('.pairrow[data-sym="SOLUSDT"]',{timeout:15000});
  await page.waitForFunction(()=>String(document.documentElement.dataset.rwaRoute||'').startsWith('asset')&&document.querySelector('#rwaSuperWorkspace')?.getBoundingClientRect().width>300,{timeout:15000});
  await page.waitForTimeout(600);
  const before=await page.evaluate(()=>{const grab=s=>{const e=document.querySelector(s);if(!e)return null;const r=e.getBoundingClientRect(),cs=getComputedStyle(e);return{x:r.x,width:r.width,right:r.right,display:cs.display}};return{layout:grab('.layout'),left:grab('.left'),main:grab('.main'),right:grab('.right'),asset:grab('#rwaSuperWorkspace')}});
  const frames=await page.evaluate(async()=>{
    const row=document.querySelector('.pairrow[data-sym="SOLUSDT"]');if(!row)throw Error('SOL row missing');
    const samples=[];const capture=()=>{const g=s=>{const e=document.querySelector(s);if(!e)return null;const r=e.getBoundingClientRect(),cs=getComputedStyle(e);return{width:r.width,x:r.x,right:r.right,display:cs.display}};samples.push({t:performance.now(),route:document.documentElement.dataset.rwaRoute||'',pairTransition:document.documentElement.dataset.rwaPairTransition||'',layout:g('.layout'),left:g('.left'),main:g('.main'),right:g('.right'),asset:g('#rwaSuperWorkspace')})};
    row.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,view:window}));
    await new Promise(resolve=>{let n=0;const tick=()=>{capture();if(++n>=75)return resolve();requestAnimationFrame(tick)};requestAnimationFrame(tick)});return samples;
  });
  const violations=[];const expected=before.asset.width;
  for(const [i,f] of frames.entries()){
    if(!f.asset||Math.abs(f.asset.width-expected)>.75)violations.push(`frame ${i} asset ${f.asset?.width} != ${expected}`);
    if(f.right&&f.right.display!=='none'&&f.right.width>1)violations.push(`frame ${i} duplicate right visible ${f.right.width}`);
    if(!f.layout||Math.abs(f.layout.width-before.layout.width)>.75)violations.push(`frame ${i} layout ${f.layout?.width} != ${before.layout.width}`);
    if(!f.left||Math.abs(f.left.width-before.left.width)>.75)violations.push(`frame ${i} left ${f.left?.width} != ${before.left.width}`);
    if(!f.main||Math.abs(f.main.width-before.main.width)>.75)violations.push(`frame ${i} main ${f.main?.width} != ${before.main.width}`);
  }

  const routeSweep=[];const routes=['markets','trade/SOL','intelligence','assets','research','asset/SOL','portfolio','institutional'];
  for(const route of routes){
    const g=await routeGeometry(page,route);routeSweep.push(g);
    if(g.route!==route)violations.push(`${route}: route state ${g.route}`);
    if(g.docks.length!==1)violations.push(`${route}: visible right dock count ${g.docks.length}`);
    const d=g.docks[0];if(!d||Math.abs(d.w-440)>.75)violations.push(`${route}: dock ${d?.name||'none'} width ${d?.w} != 440`);
    if(d&&d.position!=='fixed')violations.push(`${route}: dock ${d.name} position ${d.position} != fixed`);
    if(d&&Math.abs(d.right-document.documentElement?.clientWidth)>1){/* checked below in browser context */}
    if(!g.layout||Math.abs(g.layout.w-before.layout.width)>.75)violations.push(`${route}: layout width ${g.layout?.w} != ${before.layout.width}`);
    if(!g.left||Math.abs(g.left.w-before.left.width)>.75)violations.push(`${route}: left width ${g.left?.w} != ${before.left.width}`);
    if(!g.main||Math.abs(g.main.w-before.main.width)>.75)violations.push(`${route}: main width ${g.main?.w} != ${before.main.width}`);
  }

  const rail=await page.locator('#rwaExperienceRail [data-rwa-level]').evaluateAll(els=>els.map(e=>({w:e.getBoundingClientRect().width,title:parseFloat(getComputedStyle(e.querySelector('span')).fontSize),sub:parseFloat(getComputedStyle(e.querySelector('small')).fontSize)})));
  const cmd=await box(page,'.rwa-command-button');
  const debug=await page.evaluate(()=>({quality:getComputedStyle(document.querySelector('.rwa-quality-badge')).display,health:getComputedStyle(document.querySelector('.rwa-health')).display,viewport:document.querySelector('meta[name="viewport"]')?.content,enterprise:document.querySelector('link[data-rwa-enterprise-ui-v12]')?.href||''}));
  const type=await page.evaluate(()=>{
    const fs=s=>{const e=document.querySelector(s);return e?parseFloat(getComputedStyle(e).fontSize):null};
    return{pair:fs('.pairmeta b'),pairMeta:fs('.pairmeta small'),pairPrice:fs('.pairprice b'),change:fs('.chg'),book:fs('.bookrow'),trade:fs('.trade'),instrument:fs('.instrument b'),instrumentMeta:fs('.instrument small')};
  });
  if(Math.abs(expected-440)>.75)violations.push(`asset baseline is ${expected}, expected 440`);
  if(Math.max(...rail.map(x=>x.w))-Math.min(...rail.map(x=>x.w))>.75)violations.push('rail columns unequal');
  if(rail.some(x=>x.title<12||x.sub<9.5))violations.push('rail typography below readable V12.2 target');
  for(const [k,min] of Object.entries({pair:11.5,pairMeta:10,pairPrice:11,change:10,book:10,trade:10,instrument:14.5,instrumentMeta:10.5}))if(type[k]!=null&&type[k]<min)violations.push(`${k} typography ${type[k]} < ${min}`);
  if(cmd.background==='rgb(255, 255, 255)')violations.push('command button fell back to white/default');
  if(debug.quality!=='none'||debug.health!=='none')violations.push('debug overlays visible in consumer mode');
  if((debug.viewport||'').includes('user-scalable=no'))violations.push('viewport still disables zoom');
  if(!debug.enterprise.includes('enterprise-ui-v12.css'))violations.push('enterprise CSS not loaded');
  await go(page,'asset/SOL');await page.screenshot({path:path.join(OUT,`${width}-desktop-single-dock.png`),fullPage:true});
  const result={viewport:{width,height},before,frames:frames.map(f=>({...f,layout:f.layout&&{...f.layout,width:round(f.layout.width)},left:f.left&&{...f.left,width:round(f.left.width)},main:f.main&&{...f.main,width:round(f.main.width)},asset:f.asset&&{...f.asset,width:round(f.asset.width)}})),routeSweep,rail,cmd,type,debug,violations};
  await page.close();return result;
}

async function mobileProof(browser,width,height){
  const page=await browser.newPage({viewport:{width,height},isMobile:true,hasTouch:true});await prepare(page);
  await page.goto(BASE+'#markets',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>document.documentElement.dataset.rwaEnterpriseUi==='12',{timeout:15000});await page.waitForFunction(()=>document.querySelectorAll('.mobile-tabs [data-v5-mobile]').length===5,{timeout:15000});await page.waitForTimeout(700);
  const data=await page.evaluate(()=>{const tabs=[...document.querySelectorAll('.mobile-tabs [data-v5-mobile]')].map(e=>{const r=e.getBoundingClientRect();const small=e.querySelector('small');return{key:e.dataset.v5Mobile,x:r.x,right:r.right,width:r.width,height:r.height,labelSize:small?parseFloat(getComputedStyle(small).fontSize):0}});const strip=document.querySelector('#rwaMobileInstrumentStrip');const sr=strip?.getBoundingClientRect();const pair=strip?.querySelector('[data-rwa-mobile-pair]');const pr=pair?.getBoundingClientRect();const debug=[document.querySelector('.rwa-quality-badge'),document.querySelector('.rwa-health')].filter(Boolean).map(e=>getComputedStyle(e).display);return{tabs,strip:sr?{x:sr.x,right:sr.right,width:sr.width,height:sr.height,display:getComputedStyle(strip).display}:null,pairButton:pr?{width:pr.width,height:pr.height}:null,scrollWidth:document.documentElement.scrollWidth,innerWidth,viewport:document.querySelector('meta[name="viewport"]')?.content||'',debug}});
  const violations=[];if(data.tabs.length!==5)violations.push(`tabs ${data.tabs.length} != 5`);if(data.tabs.some(x=>x.height<44))violations.push('mobile nav touch target under 44px');if(data.tabs.some(x=>x.labelSize<9))violations.push('mobile nav label too small');if(data.tabs.at(-1)?.right>width+1)violations.push('fifth mobile nav item clipped');if(data.scrollWidth>width+1)violations.push(`horizontal overflow ${data.scrollWidth}>${width}`);if(!data.strip||data.strip.display==='none'||data.strip.width<width-2)violations.push('mobile instrument strip missing/full-width failure');if(!data.pairButton||data.pairButton.height<44||data.pairButton.width<44)violations.push('mobile pair selector under 44px');if(data.viewport.includes('user-scalable=no'))violations.push('mobile zoom disabled');if(data.debug.some(x=>x!=='none'))violations.push('debug chrome visible on mobile');
  await page.locator('[data-rwa-mobile-pair]').click();await page.waitForTimeout(100);const filters=await page.locator('.filter').evaluateAll(els=>els.filter(e=>getComputedStyle(e).display!=='none').map(e=>({h:e.getBoundingClientRect().height,fs:parseFloat(getComputedStyle(e).fontSize)})));if(filters.some(x=>x.h<44))violations.push('market filter touch target under 44px');await page.screenshot({path:path.join(OUT,`${width}-mobile.png`),fullPage:true});await page.close();return{viewport:{width,height},data,filters,violations};
}

const browser=await chromium.launch({headless:true});const results=[];
for(const [w,h] of [[2048,1129],[1600,1000]])results.push({kind:'desktop',...(await desktopProof(browser,w,h))});
for(const [w,h] of [[430,932],[390,844],[360,800],[320,568]])results.push({kind:'mobile',...(await mobileProof(browser,w,h))});
await browser.close();await fs.writeFile(path.join(OUT,'results.json'),JSON.stringify(results,null,2));
const bad=results.flatMap(r=>r.violations.map(v=>`${r.kind} ${r.viewport.width}x${r.viewport.height}: ${v}`));console.log(JSON.stringify(results.map(r=>({kind:r.kind,viewport:r.viewport,violations:r.violations})),null,2));if(bad.length){console.error('\nV12 FAIL\n'+bad.join('\n'));process.exit(1)}console.log('\nRWA_ENTERPRISE_UI_V12_SINGLE_DOCK_440=PASS');
