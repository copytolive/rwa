import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';

const base=process.env.RWA_UI_URL||'http://127.0.0.1:4173/rwa/';
const proof=process.env.RWA_UI_PROOF_DIR||'proof/visual-style-audit';
await mkdir(proof,{recursive:true});
const browser=await chromium.launch({headless:true});
const failures=[];
const results=[];
const fail=(viewport,message,detail=null)=>failures.push({viewport,message,detail});
const viewports=[
  [1672,941],[2048,1129],[1600,1000],[1440,900],[1366,768],[1280,800],[1024,768],[412,915],[390,844]
];
const styleSelectors={
  brand:'.rwa-target-brand',
  topNav:'[data-rwa-target-nav="ecommerce"]',
  watchHeading:'.layout>.left .left-title,.layout>.left .watchlist-title,.layout>.left h2',
  watchSymbol:'.layout>.left .symbol,.layout>.left .watch-symbol,.layout>.left [data-symbol] .symbol-name',
  instrument:'#symbolTitle,.instrument-title,.pair-title',
  chartToolbar:'.chart-toolbar button,.timeframes button,.tf-btn',
  bookHeading:'.layout>.right .right-title,.layout>.right .order-title',
  bookRow:'.layout>.right .book-row,.layout>.right .orderbook-row,.layout>.right tbody tr',
  ecommerceHeading:'.rwa-ecom-head-title b',
  ecommerceTab:'.rwa-ecom-tabs button',
  storeName:'.rwa-ecom-store h3',
  productTitle:'.rwa-ecom-product h4',
  productPrice:'.rwa-ecom-price',
  warning:'.rwa-ecom-warning'
};
const safeLabels=new Set(['markets','ecommerce','intelligence','portfolio','orders','reports','all','rwa','gainers','losers','stores','products','cart (2)','view store','back to stores','back','view all','review cart','limit','market','stop limit','buy','sell','spot','rwa spot','cross','isolated']);

for(const [width,height] of viewports){
  const ctx=await browser.newContext({viewport:{width,height},deviceScaleFactor:1,serviceWorkers:'block'});
  const page=await ctx.newPage();
  const vp=`${width}x${height}`;
  page.on('pageerror',e=>fail(vp,'pageerror',String(e?.message||e)));
  const u=new URL(base);u.hash='ecommerce';u.searchParams.set('__visual_audit',Date.now());
  await page.goto(u.href,{waitUntil:'domcontentloaded',timeout:45000});
  await page.waitForFunction(()=>document.body&&document.querySelector('.layout'),{timeout:30000});
  await page.waitForTimeout(900);
  const ecomButton=page.locator('[data-rwa-target-nav="ecommerce"],button:has-text("Ecommerce")').first();
  if(await ecomButton.count()) await ecomButton.click({timeout:5000}).catch(()=>{});
  await page.waitForTimeout(250);

  const audit=await page.evaluate(({styleSelectors,safeLabels})=>{
    const round=n=>Math.round((Number(n)||0)*100)/100;
    const rect=el=>{const r=el?.getBoundingClientRect();return r?{x:round(r.x),y:round(r.y),width:round(r.width),height:round(r.height),right:round(r.right),bottom:round(r.bottom)}:null};
    const style=el=>{if(!el)return null;const c=getComputedStyle(el);return{fontFamily:c.fontFamily,fontSize:c.fontSize,fontWeight:c.fontWeight,lineHeight:c.lineHeight,letterSpacing:c.letterSpacing,color:c.color,backgroundColor:c.backgroundColor,borderColor:c.borderColor,borderRadius:c.borderRadius,width:c.width,height:c.height,x:rect(el)?.x,y:rect(el)?.y,display:c.display,visibility:c.visibility,opacity:c.opacity}};
    const one=s=>document.querySelector(s);
    const styles=Object.fromEntries(Object.entries(styleSelectors).map(([k,s])=>[k,style(one(s))]));
    const visible=el=>{const r=el.getBoundingClientRect(),c=getComputedStyle(el);return r.width>0&&r.height>0&&c.display!=='none'&&c.visibility!=='hidden'&&Number(c.opacity)>0};
    const buttonInventory=[...document.querySelectorAll('button,[role="button"],a[href],input[type="button"],input[type="submit"]')].filter(visible).map((el,i)=>{const label=(el.getAttribute('aria-label')||el.textContent||el.value||'').replace(/\s+/g,' ').trim();const lower=label.toLowerCase();const locked=el.disabled||el.getAttribute('aria-disabled')==='true'||/backend locked|unavailable|verification required/.test(lower);return{index:i,label,tag:el.tagName,id:el.id||null,disabled:!!el.disabled,ariaDisabled:el.getAttribute('aria-disabled'),pressed:el.getAttribute('aria-pressed'),selected:el.getAttribute('aria-selected'),classes:el.className||'',safeNamed:[...safeLabels].some(x=>lower===x||lower.startsWith(x+' ')),status:locked?'LOCKED-BY-DESIGN':'DISCOVERED'}});
    const legacySelectors=['#rwaExperienceRail','.context-card','.assistant-panel','.browser-panel','.multichain.open','.rwa-screenshot-parity:not([hidden])'];
    const legacyVisible=legacySelectors.flatMap(s=>[...document.querySelectorAll(s)].filter(visible).map(el=>({selector:s,id:el.id||null,classes:el.className||''})));
    const allVisible=[...document.body.querySelectorAll('*')].filter(visible);
    const tinyText=allVisible.filter(el=>{const t=(el.textContent||'').trim();if(!t||el.children.length)return false;const px=parseFloat(getComputedStyle(el).fontSize)||0;return px>0&&px<8.5}).slice(0,50).map(el=>({tag:el.tagName,id:el.id||null,classes:el.className||'',text:(el.textContent||'').trim().slice(0,60),fontSize:getComputedStyle(el).fontSize}));
    const unicodeIconText=allVisible.filter(el=>el.children.length===0&&/[♧≋▣☾⌕]/.test(el.textContent||'')).slice(0,30).map(el=>({tag:el.tagName,id:el.id||null,text:el.textContent.trim(),classes:el.className||''}));
    const layout=one('.layout'),left=one('.layout>.left'),main=one('.layout>.main'),right=one('.layout>.right'),dock=one('#rwaCommerceDock'),shop=one('#rwaShopScreen');
    return{
      url:location.href,hash:location.hash,bodyClass:document.body.className,bodyDataset:{...document.body.dataset},
      geometry:{layout:rect(layout),watchlist:rect(left),center:rect(main),orderBook:rect(right),ecommerce:rect(dock)||rect(shop)},
      styles,buttonInventory,legacyVisible,tinyText,unicodeIconText,
      horizontalOverflow:Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)-innerWidth,
      ecommerce:{open:!!shop?.classList.contains('open'),text:(shop?.textContent||'').replace(/\s+/g,' ').trim().slice(0,1500),audit:window.RWAEcommerceTargetController?.audit?.()||null},
      symbol:{body:document.body.dataset.symbol||document.body.dataset.activeSymbol||null,title:one('#symbolTitle,.instrument-title,.pair-title')?.textContent?.trim()||null,activeWatch:one('.layout>.left .active,[data-symbol].active')?.textContent?.replace(/\s+/g,' ').trim().slice(0,100)||null},
      viewport:{width:innerWidth,height:innerHeight}
    };
  },{styleSelectors,safeLabels:[...safeLabels]});

  if(width===1672){
    const g=audit.geometry;
    const expect={watchlist:[0,291],center:[291,682],orderBook:[973,239],ecommerce:[1212,460]};
    for(const [k,[x,w]] of Object.entries(expect)){const r=g[k];if(!r||Math.abs(r.x-x)>1||Math.abs(r.width-w)>1)fail(vp,`canonical geometry ${k}`,{expected:{x,width:w},actual:r})}
    if(!audit.ecommerce.open)fail(vp,'Ecommerce did not open');
    if(!/BACKEND LOCKED/i.test(audit.ecommerce.text))fail(vp,'fail-closed BACKEND LOCKED copy missing');
    if(audit.legacyVisible.length)fail(vp,'legacy/competing panel visible',audit.legacyVisible);
    if(audit.unicodeIconText.length)fail(vp,'legacy Unicode icon remains visible',audit.unicodeIconText);
    if(audit.tinyText.length)fail(vp,'visible text below 8.5px',audit.tinyText);
  }
  if(audit.horizontalOverflow>2)fail(vp,'horizontal overflow',audit.horizontalOverflow);
  await page.screenshot({path:`${proof}/public-${vp}.png`,fullPage:false});
  if(width===1672){
    const clips={topbar:{x:0,y:0,width:1672,height:62},watchlist:{x:0,y:62,width:291,height:819},center:{x:291,y:62,width:682,height:819},orderbook:{x:973,y:62,width:239,height:819},ecommerce:{x:1212,y:62,width:460,height:819},footer:{x:0,y:881,width:1672,height:60}};
    for(const [name,clip] of Object.entries(clips))await page.screenshot({path:`${proof}/region-${name}-1672x941.png`,clip}).catch(()=>{});
  }
  results.push({viewport:vp,audit});
  await ctx.close();
}

/* Interaction/state proof on exact target viewport. */
const ctx=await browser.newContext({viewport:{width:1672,height:941},deviceScaleFactor:1,serviceWorkers:'block'});const page=await ctx.newPage();
const u=new URL(base);u.searchParams.set('__interaction_audit',Date.now());await page.goto(u.href,{waitUntil:'domcontentloaded',timeout:45000});await page.waitForTimeout(900);
const interactions=[];
const snap=async label=>page.evaluate(label=>{const a=[...document.querySelectorAll('button,[role="button"]')].find(x=>(x.getAttribute('aria-label')||x.textContent||'').replace(/\s+/g,' ').trim().toLowerCase()===label.toLowerCase());const active=a?{classes:a.className||'',pressed:a.getAttribute('aria-pressed'),selected:a.getAttribute('aria-selected'),current:a.getAttribute('aria-current')}:null;return{label,url:location.href,hash:location.hash,active,bodyClass:document.body.className,symbol:document.body.dataset.symbol||document.body.dataset.activeSymbol||null,shopOpen:!!document.querySelector('#rwaShopScreen.open'),target:window.RWAEcommerceTargetController?.state?.()||null}},label);
const clickLabel=async(label,{locked=false}={})=>{const before=await snap(label);const loc=page.getByRole('button',{name:new RegExp(`^${label.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}`,'i')}).first();if(!(await loc.count())){interactions.push({label,status:'FAIL',reason:'missing',before});return}if(locked){const dis=await loc.isDisabled().catch(()=>false);interactions.push({label,status:'LOCKED-BY-DESIGN',disabled:dis,before});return}await loc.click({timeout:5000}).catch(e=>interactions.push({label,status:'FAIL',reason:String(e)}));await page.waitForTimeout(80);const after=await snap(label);if(!interactions.some(x=>x.label===label&&x.status==='FAIL'))interactions.push({label,status:'PASS',before,after})};
for(const label of ['Ecommerce','Stores','Products','Cart (2)','View Store'])await clickLabel(label);
let back=page.getByRole('button',{name:/Back/i}).first();if(await back.count()){await back.click();interactions.push({label:'Back',status:'PASS',after:await page.evaluate(()=>window.RWAEcommerceTargetController?.state?.())})}
await clickLabel('View all');
await page.getByRole('button',{name:/Stores/i}).first().click().catch(()=>{});await page.waitForTimeout(50);await clickLabel('Review Cart');
const locked=page.getByRole('button',{name:/Checkout unavailable|Purchase unavailable/i}).first();if(await locked.count()){await locked.click();await page.waitForTimeout(30);interactions.push({label:'locked checkout/purchase',status:'LOCKED-BY-DESIGN',text:await page.locator('[data-ecom-lock-result]').first().textContent().catch(()=>null)})}
const fav=page.locator('[data-ecom-action="favorite"]').first();if(await fav.count()){const b=await fav.getAttribute('aria-pressed');await fav.click();const a=await fav.getAttribute('aria-pressed');interactions.push({label:'Favorite/heart',status:b!==a?'PASS':'FAIL',before:b,after:a})}
const close=page.locator('#rwaShopClose').first();if(await close.count()){await close.click();await page.waitForTimeout(100);const closed=!(await page.locator('#rwaShopScreen.open').count());interactions.push({label:'close Ecommerce',status:closed?'PASS':'FAIL'});await page.getByRole('button',{name:/Ecommerce/i}).first().click().catch(()=>{});await page.waitForTimeout(100);interactions.push({label:'reopen Ecommerce',status:(await page.locator('#rwaShopScreen.open').count())?'PASS':'FAIL'})}
const urlBeforeBack=page.url();await page.goBack({waitUntil:'domcontentloaded',timeout:15000}).catch(()=>{});await page.waitForTimeout(100);const urlAfterBack=page.url();await page.goForward({waitUntil:'domcontentloaded',timeout:15000}).catch(()=>{});await page.waitForTimeout(100);interactions.push({label:'browser Back/Forward',status:urlBeforeBack===page.url()&&urlAfterBack!==urlBeforeBack?'PASS':'FAIL',urlBeforeBack,urlAfterBack,urlAfterForward:page.url()});
await page.reload({waitUntil:'domcontentloaded',timeout:30000});await page.waitForTimeout(700);interactions.push({label:'refresh state',status:(await page.locator('#rwaShopScreen.open').count())?'PASS':'FAIL',url:page.url()});
await page.screenshot({path:`${proof}/settled-1672x941.png`,fullPage:false});
await ctx.close();

const out={ok:failures.length===0&&interactions.every(x=>x.status!=='FAIL'),contract:'visual-style-audit-v1',base,results,interactions,failures};
await writeFile(`${proof}/computed-styles.json`,JSON.stringify(results.map(x=>({viewport:x.viewport,styles:x.audit.styles,geometry:x.audit.geometry})),null,2));
await writeFile(`${proof}/button-audit.json`,JSON.stringify({interactions,inventory:results.find(x=>x.viewport==='1672x941')?.audit.buttonInventory||[]},null,2));
await writeFile(`${proof}/browser-result.json`,JSON.stringify(out,null,2));
console.log(JSON.stringify(out,null,2));
await browser.close();
if(!out.ok)process.exit(1);
