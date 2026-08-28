import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
const base=process.env.RWA_UI_URL||'http://127.0.0.1:4173/rwa/';
const proof=process.env.RWA_ECOMMERCE_PROOF_DIR||'proof/seablueprint-commerce-single-shell';
const viewports=[
  {name:'desktop-2048x1129',width:2048,height:1129},
  {name:'desktop-1600x1000',width:1600,height:1000},
  {name:'desktop-1440x900',width:1440,height:900},
  {name:'desktop-1366x768',width:1366,height:768},
  {name:'mobile-320x800',width:320,height:800},
  {name:'mobile-360x800',width:360,height:800},
  {name:'mobile-375x812',width:375,height:812},
  {name:'mobile-390x844',width:390,height:844},
  {name:'mobile-393x852',width:393,height:852},
  {name:'mobile-412x915',width:412,height:915},
  {name:'mobile-430x932',width:430,height:932},
];
await mkdir(proof,{recursive:true});
const browser=await chromium.launch({headless:true});
const context=await browser.newContext();
const extraPages=[];context.on('page',p=>extraPages.push(p));
const results=[];

async function inspectOpen(page,v){
  return page.evaluate(({width})=>{
    const screen=document.querySelector('#rwaShopScreen');
    const panel=screen?.getBoundingClientRect();
    const chart=document.querySelector('.chart-wrap');
    const chartRect=chart?.getBoundingClientRect();
    const main=document.querySelector('.main');
    const mainRect=main?.getBoundingClientRect();
    const products=[...document.querySelectorAll('#rwaShopScreen .rwa-product-card')];
    const source=document.querySelector('[data-seablueprint-source]')?.textContent||'';
    const activeTab=document.querySelector('#rwaShopScreen [data-shop-tab].active')?.textContent||'';
    const clientWidth=document.documentElement.clientWidth;
    const visibleChartWidth=chartRect&&panel?Math.max(0,Math.min(chartRect.right,panel.left,clientWidth)-Math.max(chartRect.left,0)):0;
    return{
      path:location.pathname,hash:location.hash,
      audit:window.RWASeablueprintCommerceBridge?.audit?.(),
      panel:panel?{left:panel.left,right:panel.right,width:panel.width,top:panel.top,bottom:panel.bottom,height:panel.height}:null,
      chart:chartRect?{left:chartRect.left,right:chartRect.right,width:chartRect.width,height:chartRect.height}:null,
      main:mainRect?{left:mainRect.left,right:mainRect.right,width:mainRect.width,height:mainRect.height}:null,
      visibleChartWidth,products:products.length,activeTab,source,
      rootOverflow:Math.max(0,document.documentElement.scrollWidth-clientWidth),
      bodyOverflow:Math.max(0,document.body.scrollWidth-clientWidth),
      viewport:{width:innerWidth,clientWidth,height:innerHeight},
      marketShell:document.body.classList.contains('rwa-super-market-open'),
      placement:screen?.dataset.seablueprintPlacement||'',
    };
  },{width:v.width});
}

async function runViewport(v,index){
  const page=await context.newPage();
  const pageErrors=[];page.on('pageerror',e=>pageErrors.push(String(e)));
  await page.setViewportSize({width:v.width,height:v.height});
  await page.goto(base,{waitUntil:'domcontentloaded',timeout:30000});
  await page.waitForFunction(()=>window.RWASeablueprintCommerceBridge?.version==='1.3.0'&&window.RWASuperApp?.version,{timeout:20000});
  await page.waitForSelector('#rwaSeablueprintCommerceLaunch',{state:'visible'});
  await page.evaluate(()=>window.RWASuperApp.navigate('markets',{replace:true}));
  await page.waitForFunction(()=>document.body.classList.contains('rwa-super-market-open'));
  const rootPath=await page.evaluate(()=>location.pathname);
  await page.locator('#rwaSeablueprintCommerceLaunch').click();
  await page.waitForFunction(()=>document.querySelector('#rwaShopScreen')?.classList.contains('open'));
  await page.waitForSelector('[data-seablueprint-source]',{state:'visible'});
  await page.waitForTimeout(150);
  const s=await inspectOpen(page,v);
  if(s.path!==rootPath)throw Error(`${v.name}: top-level path escaped ${s.path} != ${rootPath}`);
  if(s.hash!=='#shop')throw Error(`${v.name}: expected #shop, got ${s.hash}`);
  if(!s.audit?.ok)throw Error(`${v.name}: commerce audit failed ${JSON.stringify(s.audit)}`);
  if(s.audit.apiBaseConfigured)throw Error(`${v.name}: test fixture expected backend fail-closed`);
  if(s.placement!=='market-side-rail')throw Error(`${v.name}: wrong placement ${s.placement}`);
  if(!s.marketShell)throw Error(`${v.name}: market shell not visible behind ecommerce rail`);
  const rightGap=s.viewport.clientWidth-s.panel?.right;
  if(!s.panel||rightGap<0||rightGap>20)throw Error(`${v.name}: rail is not right-anchored within native scrollbar allowance ${JSON.stringify({panel:s.panel,viewport:s.viewport,rightGap})}`);
  if(!s.chart||s.chart.height<100||s.visibleChartWidth<=0)throw Error(`${v.name}: chart not visibly retained ${JSON.stringify({chart:s.chart,visible:s.visibleChartWidth})}`);
  if(!/Products/i.test(s.activeTab))throw Error(`${v.name}: ecommerce must open directly on products, got ${s.activeTab}`);
  if(s.products<1)throw Error(`${v.name}: no product cards visible beside market`);
  if(!/BACKEND LOCKED/.test(s.source))throw Error(`${v.name}: fail-closed backend badge missing`);
  if(s.rootOverflow>4||s.bodyOverflow>4)throw Error(`${v.name}: horizontal overflow ${JSON.stringify({root:s.rootOverflow,body:s.bodyOverflow})}`);
  if(v.width>=1000){
    if(s.panel.width>445||s.panel.width<335)throw Error(`${v.name}: desktop rail width outside contract ${s.panel.width}`);
    if(s.panel.left<v.width*.60)throw Error(`${v.name}: ecommerce rail consumes market instead of side rail ${s.panel.left}`);
    if(s.visibleChartWidth<Math.min(420,v.width*.26))throw Error(`${v.name}: too little chart remains visible ${s.visibleChartWidth}`);
  }else{
    if(s.panel.left<40)throw Error(`${v.name}: mobile rail must leave market edge visible; left=${s.panel.left}`);
    if(s.panel.width>v.width-40+2)throw Error(`${v.name}: mobile rail too wide ${s.panel.width}`);
  }
  await page.screenshot({path:`${proof}/${String(index+1).padStart(2,'0')}-${v.name}-commerce-rail.png`,fullPage:false});
  for(let cycle=0;cycle<2;cycle++){
    await page.locator('#rwaShopClose').click();
    await page.waitForFunction(()=>!document.querySelector('#rwaShopScreen')?.classList.contains('open'));
    await page.locator('#rwaSeablueprintCommerceLaunch').click();
    await page.waitForFunction(()=>document.querySelector('#rwaShopScreen')?.classList.contains('open'));
  }
  const stressed=await inspectOpen(page,v);
  if(!stressed.audit?.ok||stressed.rootOverflow>4)throw Error(`${v.name}: repeated open/close regression ${JSON.stringify(stressed)}`);
  await page.locator('#rwaShopClose').click();
  await page.waitForFunction(()=>!document.querySelector('#rwaShopScreen')?.classList.contains('open'));
  if(pageErrors.length)throw Error(`${v.name}: page errors ${pageErrors.join(' | ')}`);
  results.push({name:v.name,ok:true,panelWidth:Math.round(s.panel.width),panelLeft:Math.round(s.panel.left),rightGap:Math.round(rightGap),visibleChartWidth:Math.round(s.visibleChartWidth),products:s.products,overflow:Math.max(s.rootOverflow,s.bodyOverflow)});
  await page.close();
}

for(let i=0;i<viewports.length;i++)await runViewport(viewports[i],i);

const restore=await context.newPage();
await restore.setViewportSize({width:1600,height:1000});
await restore.goto(base,{waitUntil:'domcontentloaded',timeout:30000});
await restore.waitForFunction(()=>window.RWASeablueprintCommerceBridge?.version==='1.3.0'&&window.RWASuperApp?.version,{timeout:20000});
await restore.waitForSelector('#rwaSeablueprintCommerceLaunch',{state:'visible'});
await restore.evaluate(()=>window.RWASuperApp.navigate('asset/PENDLE'));
await restore.waitForFunction(()=>location.hash==='#asset/PENDLE'&&document.body.classList.contains('rwa-super-asset-workspace'));
const beforeAsset=await restore.evaluate(()=>({path:location.pathname,hash:location.hash}));
await restore.locator('#rwaSeablueprintCommerceLaunch').click();
await restore.waitForFunction(()=>document.querySelector('#rwaShopScreen')?.classList.contains('open'));
const background=await restore.evaluate(()=>({hash:location.hash,market:document.body.classList.contains('rwa-super-market-open'),workspace:document.body.classList.contains('rwa-super-asset-workspace')}));
if(background.hash!=='#shop'||!background.market||background.workspace)throw Error(`asset -> ecommerce did not anchor to market shell ${JSON.stringify(background)}`);
await restore.locator('#rwaShopClose').click();
await restore.waitForFunction(()=>location.hash==='#asset/PENDLE'&&document.body.classList.contains('rwa-super-asset-workspace'));
const afterAsset=await restore.evaluate(()=>({path:location.pathname,hash:location.hash,open:document.querySelector('#rwaShopScreen')?.classList.contains('open')}));
if(afterAsset.path!==beforeAsset.path||afterAsset.hash!==beforeAsset.hash||afterAsset.open)throw Error(`asset context not restored ${JSON.stringify({beforeAsset,afterAsset})}`);
await restore.screenshot({path:`${proof}/12-desktop-1600-asset-restored.png`,fullPage:false});
await restore.close();

if(extraPages.length!==12)throw Error(`unexpected popup/new page count: context created ${extraPages.length}, expected only our 12 test pages`);
const result={ok:true,version:'1.3.0',source:'SEABLUEPRINT_COMMERCE_CONTRACT',placement:'MARKET_SIDE_RAIL',singleMainDocument:true,marketChartRetained:true,productsVisibleBesideMarket:true,backendFailClosed:true,assetContextRestored:true,noExternalPageNavigation:true,zeroHorizontalOverflow:true,repeatedOpenClose:true,viewports:results};
await writeFile(`${proof}/browser-result.json`,JSON.stringify(result,null,2));
console.log(JSON.stringify(result,null,2));
await context.close();
await browser.close();