import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';

const base=process.env.RWA_UI_URL||'http://127.0.0.1:4173/rwa/';
const proof=process.env.RWA_UI_PROOF_DIR||'proof/ecommerce-first-paint';
const publicMode=/^https:\/\//i.test(base);
await mkdir(proof,{recursive:true});
const browser=await chromium.launch({headless:true});
const failures=[],results=[];
for(const [label,width,height] of [['root-1672x941',1672,941],['root-mobile-390x844',390,844]]){
  const ctx=await browser.newContext({viewport:{width,height},serviceWorkers:'block'}),page=await ctx.newPage();
  await page.route('**/chart-core.js*',route=>route.abort('blockedbyclient'));
  try{
    const u=new URL(base);u.searchParams.set('__first_paint_probe',String(Date.now()));u.hash='';
    await page.goto(u.href,{waitUntil:'domcontentloaded',timeout:publicMode?50000:30000});
    const audit=await page.evaluate(()=>{const vis=el=>{if(!el)return false;const s=getComputedStyle(el),r=el.getBoundingClientRect();return s.display!=='none'&&s.visibility!=='hidden'&&Number(s.opacity||1)>0&&r.width>1&&r.height>1};const rr=sel=>{const r=document.querySelector(sel)?.getBoundingClientRect();return r?{left:Math.round(r.left),right:Math.round(r.right),width:Math.round(r.width),height:Math.round(r.height),top:Math.round(r.top),bottom:Math.round(r.bottom)}:null};const right=document.querySelector('.layout>.right'),orderSection=right?.querySelector(':scope>.order-section');const extraRight=[...(right?.children||[])].filter(x=>x!==orderSection&&vis(x)).map(x=>({tag:x.tagName,id:x.id||'',cls:String(x.className||''),text:(x.textContent||'').trim().slice(0,80)}));return{hash:location.hash,brand:document.querySelector('.brandcopy strong')?.textContent||'',nav:[...document.querySelectorAll('.topnav>[data-rwa-target-nav]')].filter(vis).map(x=>x.dataset.rwaTargetNav),legacyNav:[...document.querySelectorAll('.topnav>[data-v5-route],.topnav>button')].filter(vis).map(x=>x.textContent.trim()).filter(x=>/^(Assets|Research|Company|Institutional)$/.test(x)),productbarVisible:vis(document.querySelector('.productbar')),trustbarVisible:vis(document.querySelector('.trustbar')),leftLabel:document.querySelector('.left .aside-label span')?.textContent?.trim()||'',marketDepthVisible:vis(document.querySelector('.right>.aside-label')),orderBookVisible:vis(document.querySelector('.right .order-section')),extraRight,topbar:rr('.topbar'),layout:rr('.layout'),left:rr('.layout>.left'),main:rr('.layout>.main'),order:rr('.layout>.right'),skeleton:rr('#rwaFirstPaintCommerceSkeleton'),skeletonVisible:vis(document.querySelector('#rwaFirstPaintCommerceSkeleton')),skeletonText:document.querySelector('#rwaFirstPaintCommerceSkeleton')?.textContent||'',runtimeReady:document.documentElement.classList.contains('rwa-target-runtime-ready'),clientWidth:document.documentElement.clientWidth,innerWidth};});
    await page.screenshot({path:`${proof}/${label}-0ms.png`,fullPage:false});
    if(audit.hash!=='#shop')failures.push({label,reason:'root did not synchronously enter #shop',audit});
    if(!/Seablueprint/.test(audit.brand))failures.push({label,reason:'legacy brand at first paint',audit});
    if(width>680&&audit.nav.join('|')!=='markets|ecommerce|intelligence|portfolio|orders|reports')failures.push({label,reason:'canonical six-item nav missing at first paint',audit});
    if(audit.legacyNav.length||audit.productbarVisible||audit.trustbarVisible||audit.marketDepthVisible)failures.push({label,reason:'legacy shell visible at first paint',audit});
    if(width>680&&audit.extraRight.length)failures.push({label,reason:'legacy/context right-rail surface visible at first paint',extraRight:audit.extraRight,audit});
    if(audit.leftLabel!=='WATCHLIST')failures.push({label,reason:'WATCHLIST target chrome missing at first paint',audit});
    if(width>680&&!audit.orderBookVisible)failures.push({label,reason:'desktop Order Book missing at first paint',audit});
    if(width>680){
      const expectedDock=width>=1600?460:440,expectedLeft=width>=1600?291:(width<=1400?260:286),expectedOrder=width>=1600?239:(width<=1400?220:236);
      if(Math.abs(Number(audit.topbar?.height||0)-62)>2||!audit.skeletonVisible||Math.abs(Number(audit.skeleton?.width||0)-expectedDock)>2||!/BACKEND LOCKED/i.test(audit.skeletonText))failures.push({label,reason:'desktop root first-paint shell geometry/truth failed',audit});
      if(Math.abs(Number(audit.left?.width||0)-expectedLeft)>2||Math.abs(Number(audit.order?.width||0)-expectedOrder)>2)failures.push({label,reason:'first-paint desktop grid geometry mismatch',audit});
      if(width===1672){const exact={topbar:[0,1672],layout:[0,1212],left:[0,291],main:[291,973],order:[973,1212],skeleton:[1212,1672]};for(const [k,[l,r]] of Object.entries(exact)){if(Math.abs(Number(audit[k]?.left??-999)-l)>2||Math.abs(Number(audit[k]?.right??-999)-r)>2)failures.push({label,reason:`1672 first-paint ${k} edge mismatch`,expected:{left:l,right:r},actual:audit[k]})}if(Math.abs(Number(audit.main?.width||0)-682)>2||Math.abs(Number(audit.order?.top||0)-62)>2||Math.abs(Number(audit.skeleton?.top||0)-62)>2||Math.abs(Number(audit.skeleton?.bottom||0)-881)>2)failures.push({label,reason:'1672 target first-paint vertical/center geometry mismatch',audit})}
      if(Math.abs(audit.innerWidth-audit.clientWidth)>1)failures.push({label,reason:'first-paint viewport has scrollbar gutter',audit});
    } else if(!audit.skeletonVisible||Math.abs(Number(audit.skeleton?.width||0)-width)>2||Math.abs(Number(audit.skeleton?.left||0))>2||Math.abs(Number(audit.skeleton?.right||0)-width)>2||!/BACKEND LOCKED/i.test(audit.skeletonText))failures.push({label,reason:'mobile root first-paint contextual shell failed',audit});
    if(audit.runtimeReady)failures.push({label,reason:'probe accidentally loaded target runtime; 0ms first paint was not isolated',audit});
    results.push({label,width,height,captureDelayMs:0,audit});
  }catch(e){failures.push({label,reason:String(e?.stack||e)})}finally{await ctx.close()}
}
await browser.close();const out={ok:failures.length===0,contract:'ecommerce-root-first-paint-0ms-v1.7',base,publicMode,results,failures};await writeFile(`${proof}/browser-result.json`,JSON.stringify(out,null,2));console.log(JSON.stringify(out,null,2));if(!out.ok)process.exit(1);