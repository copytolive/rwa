import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
const base=process.env.RWA_UI_URL||'http://127.0.0.1:4173/rwa/';
const proof=process.env.RWA_UI_PROOF_DIR||'proof/ui-layout-integrity-v15';
await mkdir(proof,{recursive:true});
const browser=await chromium.launch({headless:true});
async function open(viewport){const p=await browser.newPage({viewport});const pageErrors=[];p.on('pageerror',e=>pageErrors.push(String(e)));await p.goto(base,{waitUntil:'domcontentloaded',timeout:30000});await p.waitForFunction(()=>window.RWAUILayoutIntegrity?.version==='15.0.0'&&window.RWASuperApp?.version,{timeout:20000});await p.waitForSelector('#rwaMarketplaceLaunch',{state:'visible'});return{p,pageErrors}}
async function settle(p,ms=450){await p.waitForTimeout(ms)}
async function audit(p,label){const a=await p.evaluate(()=>window.RWAUILayoutIntegrity.audit());if(!a.ok)throw Error(`${label}: ${JSON.stringify(a)}`);if(a.horizontalOverflowPx>4)throw Error(`${label}: horizontal overflow ${a.horizontalOverflowPx}`);return a}
async function loadFundamentals(p){await p.addStyleTag({url:new URL('rwa-fundamentals.css',base).href});await p.addScriptTag({url:new URL('rwa-fundamentals.js',base).href});await p.waitForFunction(()=>window.RWAFundamentals?.version,{timeout:10000});await settle(p,200)}
async function assertFundDrawer(p,label){const d=await p.locator('#rwaFundamentals').evaluate(el=>{const r=el.getBoundingClientRect(),s=getComputedStyle(el);return{left:r.left,right:r.right,width:r.width,visibility:s.visibility,transform:s.transform,z:s.zIndex,viewport:innerWidth,bodyClass:document.body.className,rightVisible:document.querySelector('.right')?getComputedStyle(document.querySelector('.right')).display:null}});if(d.visibility==='hidden'||d.width<380||d.left<0||d.right>d.viewport+2)throw Error(`${label}: fundamentals drawer clipped ${JSON.stringify(d)}`);if(d.rightVisible!=='none')throw Error(`${label}: legacy right rail still competes with fundamentals ${JSON.stringify(d)}`);return d}
async function assertClosedFundHidden(p,label){const d=await p.locator('#rwaFundamentals').evaluate(el=>{const r=el.getBoundingClientRect(),s=getComputedStyle(el);return{visibility:s.visibility,left:r.left,right:r.right,width:r.width,viewport:innerWidth,bodyClass:document.body.className}});if(d.visibility!=='hidden')throw Error(`${label}: closed fundamentals still visually present ${JSON.stringify(d)}`)}

const desktop=await open({width:1536,height:1000});
await audit(desktop.p,'desktop initial');
await desktop.p.screenshot({path:`${proof}/01-desktop-marketplace-visible.png`,fullPage:true});
await desktop.p.locator('#rwaMarketplaceLaunch').click();
await desktop.p.waitForFunction(()=>String(window.RWASuperApp?.route?.()).startsWith('assets'));
await desktop.p.waitForSelector('#rwaSuperWorkspace:not([hidden])',{state:'visible'});await settle(desktop.p);
await audit(desktop.p,'desktop marketplace');
await desktop.p.screenshot({path:`${proof}/02-desktop-marketplace.png`,fullPage:true});
await desktop.p.evaluate(()=>window.RWASuperApp.navigate('markets'));await settle(desktop.p);
await loadFundamentals(desktop.p);
await assertClosedFundHidden(desktop.p,'fresh closed fundamentals');
await desktop.p.evaluate(()=>window.RWASuperApp.navigate('asset/PENDLE'));
await desktop.p.waitForFunction(()=>document.body.classList.contains('rwa-super-asset-workspace')&&!document.querySelector('#rwaSuperWorkspace')?.hidden);await settle(desktop.p);
if(await desktop.p.locator('#rwaFundamentals.open').count())throw Error('fundamentals unexpectedly open with asset detail');
await audit(desktop.p,'asset detail only');
await desktop.p.screenshot({path:`${proof}/03-asset-detail-no-overlap.png`,fullPage:true});
await desktop.p.evaluate(()=>window.RWAFundamentals.open('PENDLE'));
await desktop.p.waitForFunction(()=>document.body.classList.contains('rwa-fundamentals-open')&&document.querySelector('#rwaFundamentals')?.classList.contains('open'));await settle(desktop.p);
if(await desktop.p.locator('#rwaSuperWorkspace:not([hidden])').count())throw Error('asset workspace remained visible after fundamentals opened');
let a=await audit(desktop.p,'fundamentals exclusive');if(!a.fundamentalsOpen||a.workspaceOpen)throw Error(`fundamentals exclusivity failed ${JSON.stringify(a)}`);await assertFundDrawer(desktop.p,'fundamentals exclusive');
await desktop.p.screenshot({path:`${proof}/04-fundamentals-exclusive.png`,fullPage:true});
await desktop.p.evaluate(()=>window.RWASuperApp.navigate('asset/PENDLE'));
await desktop.p.waitForFunction(()=>document.body.classList.contains('rwa-super-asset-workspace')&&!document.querySelector('#rwaSuperWorkspace')?.hidden);await settle(desktop.p);
if(await desktop.p.locator('#rwaFundamentals.open').count())throw Error('fundamentals remained open after asset navigation');await assertClosedFundHidden(desktop.p,'reverse navigation');
a=await audit(desktop.p,'reverse exclusivity');if(a.fundamentalsOpen||!a.workspaceOpen)throw Error(`reverse exclusivity failed ${JSON.stringify(a)}`);
await desktop.p.screenshot({path:`${proof}/05-reverse-exclusive-asset.png`,fullPage:true});
if(desktop.pageErrors.length)throw Error(`desktop page errors: ${desktop.pageErrors.join(' | ')}`);
await desktop.p.close();

const medium=await open({width:1280,height:900});
await medium.p.evaluate(()=>window.RWASuperApp.navigate('asset/PENDLE'));
await medium.p.waitForFunction(()=>document.body.classList.contains('rwa-super-asset-workspace'));await settle(medium.p);
a=await audit(medium.p,'medium asset');if(a.contextOverlapPx)throw Error(`medium overlap ${a.contextOverlapPx}`);
await medium.p.screenshot({path:`${proof}/06-medium-1280x900.png`,fullPage:true});
if(medium.pageErrors.length)throw Error(`medium page errors: ${medium.pageErrors.join(' | ')}`);
await medium.p.close();

const mobile=await open({width:390,height:844});
const mb=mobile.p.locator('#rwaMarketplaceLaunch');if(!await mb.isVisible())throw Error('mobile marketplace launcher not visible');
await audit(mobile.p,'mobile initial');
await mobile.p.screenshot({path:`${proof}/07-mobile-marketplace-visible.png`,fullPage:true});
await mb.click();await mobile.p.waitForFunction(()=>String(window.RWASuperApp?.route?.()).startsWith('assets'));await mobile.p.waitForSelector('#rwaSuperWorkspace:not([hidden])',{state:'visible'});await settle(mobile.p);await audit(mobile.p,'mobile marketplace');
await mobile.p.screenshot({path:`${proof}/08-mobile-marketplace.png`,fullPage:true});
if(mobile.pageErrors.length)throw Error(`mobile page errors: ${mobile.pageErrors.join(' | ')}`);
await mobile.p.close();
const result={ok:true,version:'15.0.0',marketplaceProminent:true,desktop1536:true,medium1280:true,mobile390:true,assetFundamentalsMutuallyExclusive:true,fundamentalsFullyVisible:true,closedContextFullyHidden:true,noContextOverlap:true,noRootHorizontalOverflow:true};
await writeFile(`${proof}/browser-result.json`,JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
await browser.close();
