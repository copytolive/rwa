import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';

const base=process.env.RWA_UI_URL||'http://127.0.0.1:4173/rwa/';
const proof=process.env.RWA_UI_PROOF_DIR||'proof/screenshot-parity-production-guard';
await mkdir(proof,{recursive:true});
const browser=await chromium.launch({headless:true});
const ctx=await browser.newContext({viewport:{width:1672,height:941},deviceScaleFactor:1,serviceWorkers:'block'});
const page=await ctx.newPage();
const failures=[];
page.on('pageerror',e=>failures.push(`pageerror: ${e?.message||e}`));
const u=new URL(base);u.searchParams.set('__production_guard',Date.now());
await page.goto(u.href,{waitUntil:'domcontentloaded',timeout:50000});
await page.waitForFunction(()=>window.RWASeablueprintCommerceBridge?.version==='1.5.0'&&window.RWAEcommerceTargetController?.version==='2.3.0',{timeout:30000});
const launcher=page.locator('#rwaSeablueprintCommerceLaunch,[data-rwa-seablueprint-commerce="1"]').filter({visible:true}).first();
if(!(await launcher.isVisible().catch(()=>false))) failures.push('Ecommerce launcher not visible');
else await launcher.click();
await page.waitForFunction(()=>document.querySelector('#rwaShopScreen')?.classList.contains('open'),{timeout:12000}).catch(e=>failures.push(`Ecommerce did not open: ${e.message}`));
await page.evaluate(()=>window.RWAEcommerceTargetController?.render?.());
await page.waitForSelector('[data-rwa-ecom-target="2.3.0"]',{state:'attached',timeout:12000}).catch(e=>failures.push(`Canonical Ecommerce target missing: ${e.message}`));
const audit=await page.evaluate(()=>({
  parityApiLoaded:!!window.RWAScreenshotToCodeParity,
  parityRootPresent:!!document.querySelector('#rwaScreenshotParity'),
  canonicalTargetPresent:!!document.querySelector('[data-rwa-ecom-target="2.3.0"]'),
  backendLocked:/BACKEND LOCKED/i.test(document.querySelector('#rwaShopScreen')?.textContent||''),
  path:location.pathname,
  hash:location.hash
}));
if(audit.parityApiLoaded) failures.push('Screenshot parity API loaded in normal production mode');
if(audit.parityRootPresent) failures.push('Screenshot parity DOM exists in normal production mode');
if(!audit.canonicalTargetPresent) failures.push('Canonical Ecommerce target not present');
if(!audit.backendLocked) failures.push('Fail-closed BACKEND LOCKED truth missing');
if(audit.path!=='/rwa/'||audit.hash!=='#shop') failures.push(`Unexpected route ${audit.path}${audit.hash}`);
await page.screenshot({path:`${proof}/production-1672x941.png`,fullPage:false});
const out={ok:failures.length===0,contract:'screenshot-parity-production-guard-v1',base,audit,failures};
await writeFile(`${proof}/browser-result.json`,JSON.stringify(out,null,2));
console.log(JSON.stringify(out,null,2));
await browser.close();
if(!out.ok)process.exit(1);
