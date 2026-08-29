import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
const base=process.env.RWA_UI_URL||'http://127.0.0.1:4173/rwa/';
const proof=process.env.RWA_UI_PROOF_DIR||'proof/screenshot-to-code-parity';
await mkdir(proof,{recursive:true});
const browser=await chromium.launch({headless:true});
const ctx=await browser.newContext({viewport:{width:1672,height:941},deviceScaleFactor:1,serviceWorkers:'block'});
const page=await ctx.newPage(),failures=[];const fail=(message,detail=null)=>failures.push({message,detail});
page.on('pageerror',e=>fail('pageerror',String(e?.message||e)));
const u=new URL(base);u.searchParams.set('__screenshot_parity','1');u.searchParams.set('__stc_parity',Date.now());
await page.goto(u.href,{waitUntil:'domcontentloaded',timeout:40000});
await page.waitForFunction(()=>window.RWASeablueprintCommerceBridge?.version==='1.5.0'&&window.RWAScreenshotToCodeParity?.version==='1.0.0',{timeout:30000});
const parityAlreadyOpen=await page.locator('#rwaScreenshotParity.open').count();
if(!parityAlreadyOpen){await page.evaluate(()=>window.RWASeablueprintCommerceBridge?.open?.('stores'))}
await page.waitForSelector('#rwaScreenshotParity.open .stc-stage',{state:'visible',timeout:12000});
await page.waitForFunction(()=>[...document.querySelectorAll('#rwaScreenshotParity img')].every(x=>x.complete),{timeout:12000}).catch(()=>{});
const audit=await page.evaluate(()=>{const r=s=>{const x=document.querySelector(s)?.getBoundingClientRect();return x?Object.fromEntries(['left','top','right','bottom','width','height'].map(k=>[k,Math.round(x[k])])):null};const sel=['#rwaScreenshotParity','.stc-stage','.stc-top','.stc-left','.stc-center','.stc-book','.stc-ecom','.stc-footer'];return{api:window.RWAScreenshotToCodeParity.audit(),rects:Object.fromEntries(sel.map(s=>[s,r(s)])),transitionViolations:[...document.querySelectorAll('#rwaScreenshotParity,#rwaScreenshotParity *')].filter(x=>{const c=getComputedStyle(x);return parseFloat(c.transitionDuration)>0||parseFloat(c.animationDuration)>0}).slice(0,10).map(x=>x.className||x.id),texts:{brand:document.querySelector('.stc-brand b')?.textContent.trim(),market:document.querySelector('.stc-instr-copy b')?.textContent.trim(),store:document.querySelector('.stc-store h3')?.textContent.trim(),cart:document.querySelector('.stc-carthead')?.textContent.trim()}}});
const want={'.stc-stage':[0,0,1672,941],'.stc-top':[0,0,1672,59],'.stc-left':[0,59,291,822],'.stc-center':[291,59,682,822],'.stc-book':[973,59,239,822],'.stc-ecom':[1212,59,460,822],'.stc-footer':[0,881,1672,60]};
for(const [s,[left,top,width,height]] of Object.entries(want)){const x=audit.rects[s];if(!x||Math.abs(x.left-left)>1||Math.abs(x.top-top)>1||Math.abs(x.width-width)>1||Math.abs(x.height-height)>1)fail(`geometry ${s}`,{want:{left,top,width,height},got:x})}
if(audit.transitionViolations.length)fail('non-zero transition/animation',audit.transitionViolations);
if(audit.api?.transitionMs!==0||audit.api?.animationMs!==0)fail('parity API not zero-duration',audit.api);
if(audit.texts.brand!=='RWA × Seablueprint'||!audit.texts.market?.startsWith('BTC/USDT')||!audit.texts.store?.includes('Seablue Estate Marketplace')||!audit.texts.cart?.includes('2,315.00 USDC'))fail('target copy missing',audit.texts);
const sync=await page.evaluate(()=>{const out={};for(const k of ['products','cart','stores']){const b=document.querySelector(`[data-stc-etab="${k}"]`);const t=performance.now();b.click();out[k]={elapsed:performance.now()-t,active:document.querySelector(`[data-stc-etab="${k}"]`)?.classList.contains('active')||false,state:window.RWAScreenshotToCodeParity.state().ecomTab}}return out});
for(const [k,v] of Object.entries(sync)){if(!v.active||v.state!==k)fail(`tab ${k} not synchronous`,v);if(v.elapsed>8)fail(`tab ${k} exceeded 8ms`,v)}
await page.locator('[data-stc-action="view-store"]').click();
let st=await page.evaluate(()=>window.RWAScreenshotToCodeParity.state());if(st.detail!=='store')fail('View Store failed',st);
await page.locator('[data-stc-action="back"]').click();
await page.locator('[data-stc-action="view-all"]').click();st=await page.evaluate(()=>window.RWAScreenshotToCodeParity.state());if(st.ecomTab!=='products')fail('View all failed',st);
await page.locator('[data-stc-etab="stores"]').click();await page.locator('[data-stc-action="review-cart"]').first().click();st=await page.evaluate(()=>window.RWAScreenshotToCodeParity.state());if(st.ecomTab!=='cart')fail('Review Cart failed',st);
await page.locator('[data-stc-etab="stores"]').click();await page.locator('[data-stc-tf="15m"]').click();await page.locator('[data-stc-mode="Market"]').click();st=await page.evaluate(()=>window.RWAScreenshotToCodeParity.state());if(st.tf!=='15m'||st.orderMode!=='Market')fail('chart/order controls failed',st);
await page.locator('[data-stc-tf="1H"]').click();await page.locator('[data-stc-mode="Limit"]').click();
await page.screenshot({path:`${proof}/target-1672x941.png`,fullPage:false});
const out={ok:failures.length===0,contract:'screenshot-to-code-parity-v1.1',base,viewport:{width:1672,height:941},audit,sync,failures};
await writeFile(`${proof}/browser-result.json`,JSON.stringify(out,null,2));console.log(JSON.stringify(out,null,2));await browser.close();if(!out.ok)process.exit(1);
