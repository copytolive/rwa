import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';

const base=process.env.RWA_UI_URL||'http://127.0.0.1:4173/rwa/';
const proof=process.env.RWA_UI_PROOF_DIR||'proof/ecommerce-first-paint';
const publicMode=/^https:\/\//i.test(base);
await mkdir(proof,{recursive:true});
const browser=await chromium.launch({headless:true});
const failures=[],results=[];

for(const [label,width,height] of [['target-1672x941',1672,941],['mobile-390x844',390,844]]){
  const ctx=await browser.newContext({viewport:{width,height},serviceWorkers:'block'});
  const page=await ctx.newPage();
  let release;
  const hold=new Promise(r=>{release=r});
  await page.route('**/chart-core.js*',async route=>{await hold;await route.continue()});
  try{
    const u=new URL(base);
    u.searchParams.set('__first_paint_probe',String(Date.now()));
    u.hash='shop';
    await page.goto(u.href,{waitUntil:'commit',timeout:publicMode?50000:30000});
    await page.waitForSelector('.layout',{state:'attached',timeout:15000});
    const audit=await page.evaluate(()=>{
      const vis=el=>{if(!el)return false;const s=getComputedStyle(el),r=el.getBoundingClientRect();return s.display!=='none'&&s.visibility!=='hidden'&&Number(s.opacity||1)>0&&r.width>1&&r.height>1};
      const top=document.querySelector('.topbar')?.getBoundingClientRect();
      const sk=document.querySelector('#rwaFirstPaintCommerceSkeleton')?.getBoundingClientRect();
      return{
        brand:document.querySelector('.brandcopy strong')?.textContent||'',
        nav:[...document.querySelectorAll('.topnav>[data-rwa-target-nav]')].filter(vis).map(x=>x.dataset.rwaTargetNav),
        legacyNav:[...document.querySelectorAll('.topnav>button')].filter(vis).map(x=>x.textContent.trim()).filter(x=>/^(Assets|Research|Company)$/.test(x)),
        productbarVisible:vis(document.querySelector('.productbar')),
        trustbarVisible:vis(document.querySelector('.trustbar')),
        leftLabel:document.querySelector('.left .aside-label span')?.textContent?.trim()||'',
        marketDepthVisible:vis(document.querySelector('.right>.aside-label')),
        orderBookVisible:vis(document.querySelector('.right .order-section')),
        topbarHeight:Math.round(top?.height||0),
        skeletonVisible:vis(document.querySelector('#rwaFirstPaintCommerceSkeleton')),
        skeletonWidth:Math.round(sk?.width||0),
        skeletonText:document.querySelector('#rwaFirstPaintCommerceSkeleton')?.textContent||'',
        runtimeReady:document.documentElement.classList.contains('rwa-target-runtime-ready')
      };
    });
    await page.screenshot({path:`${proof}/${label}-0ms.png`,fullPage:false});
    if(!/Seablueprint/.test(audit.brand))failures.push({label,reason:'legacy brand at first paint',audit});
    if(width>680&&audit.nav.join('|')!=='markets|ecommerce|intelligence|portfolio|orders|reports')failures.push({label,reason:'canonical six-item nav missing at first paint',audit});
    if(audit.legacyNav.length||audit.productbarVisible||audit.trustbarVisible||audit.marketDepthVisible)failures.push({label,reason:'legacy shell visible at first paint',audit});
    if(audit.leftLabel!=='WATCHLIST'||!audit.orderBookVisible)failures.push({label,reason:'target market chrome not visible at first paint',audit});
    if(width>680&&(Math.abs(audit.topbarHeight-62)>2||!audit.skeletonVisible||Math.abs(audit.skeletonWidth-440)>2||!/BACKEND LOCKED/i.test(audit.skeletonText)))failures.push({label,reason:'desktop #shop first-paint skeleton geometry/truth failed',audit});
    if(audit.runtimeReady)failures.push({label,reason:'probe waited for target runtime instead of testing pre-runtime first paint',audit});
    results.push({label,width,height,captureDelayMs:0,audit});
  }catch(e){
    failures.push({label,reason:String(e?.stack||e)});
  }finally{
    release();
    await ctx.close();
  }
}
await browser.close();
const out={ok:failures.length===0,contract:'ecommerce-first-paint-0ms-v1',base,publicMode,results,failures};
await writeFile(`${proof}/browser-result.json`,JSON.stringify(out,null,2));
console.log(JSON.stringify(out,null,2));
if(!out.ok)process.exit(1);
