import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const id=process.env.QA_ID;
const out=process.env.OUT_DIR;
fs.mkdirSync(out,{recursive:true});
const shell=fs.readFileSync('ai3-nav-candidate/ai3_public_shell_v1.js','utf8');
const fundamental=fs.readFileSync('ai3-nav-candidate/fundamental.html','utf8');
const report={id,ok:false,acceptance:'FAIL',issues:[],desktop:{},mobile:{}};

const clean=s=>String(s||'').replace(/\s+/g,' ').trim();
function issue(view,msg){report.issues.push(view+': '+msg)}

async function installRoutes(page){
  await page.route(/\/assets\/js\/ai3_public_shell_v1\.js(?:\?.*)?$/,route=>route.fulfill({status:200,contentType:'application/javascript; charset=utf-8',body:shell}));
  await page.route(/\/fundamental\.html(?:\?.*)?$/,route=>route.fulfill({status:200,contentType:'text/html; charset=utf-8',body:fundamental}));
}
async function setHome(page,tag){
  await page.goto('https://copytolive.com/?cand='+encodeURIComponent(id)+'&tag='+tag,{waitUntil:'domcontentloaded',timeout:60000});
  await page.evaluate(()=>localStorage.setItem('ot_backtest_view_mode','home'));
  await page.reload({waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForTimeout(2500);
}
async function topMetrics(page){
 return await page.evaluate(()=>{
  const clean=s=>String(s||'').replace(/\s+/g,' ').trim();
  const vis=e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return r.width>0&&r.height>0&&s.display!=='none'&&s.visibility!=='hidden'&&Number(s.opacity||1)>0};
  const names=['Home','Fundamental','Signal Scan','Crypto','Renko'];
  const norm=t=>{t=clean(t);return names.find(n=>t===n||t.endsWith(' '+n))||t};
  const navs=[...document.querySelectorAll('nav')].filter(n=>!n.closest('#desktop-sidebar')&&vis(n)&&names.filter(x=>clean(n.innerText).includes(x)).length>=4);
  navs.sort((a,b)=>a.getBoundingClientRect().top-b.getBoundingClientRect().top);
  const nav=navs[0]; if(!nav)return null;
  const nr=nav.getBoundingClientRect();
  const items=[...nav.querySelectorAll(':scope > button')].filter(vis).map(b=>{
    const r=b.getBoundingClientRect(),svg=b.querySelector('svg'),sr=svg?svg.getBoundingClientRect():null;
    const labs=[...b.querySelectorAll('span')].filter(s=>vis(s)&&['Home','Fundamental','Signal Scan','Crypto','Renko'].includes(norm(s.textContent)));
    const lab=labs[0]||b,lr=lab.getBoundingClientRect(),cs=getComputedStyle(lab);
    return {name:norm(b.innerText),raw:clean(b.innerText),x:r.x,y:r.y,w:r.width,h:r.height,icon:sr?{w:sr.width,h:sr.height}:null,label:{w:lr.width,h:lr.height,fontSize:parseFloat(cs.fontSize)||0,fontWeight:cs.fontWeight,lineHeight:cs.lineHeight}};
  });
  return {nav:{x:nr.x,y:nr.y,w:nr.width,h:nr.height},items,scrollWidth:document.documentElement.scrollWidth,innerWidth,viewMode:localStorage.getItem('ot_backtest_view_mode')};
 });
}
async function clickTop(page,name){
 return await page.evaluate(name=>{
   const clean=s=>String(s||'').replace(/\s+/g,' ').trim();
   const vis=e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return r.width>0&&r.height>0&&s.display!=='none'&&s.visibility!=='hidden'};
   const names=['Home','Fundamental','Signal Scan','Crypto','Renko'];
   const navs=[...document.querySelectorAll('nav')].filter(n=>!n.closest('#desktop-sidebar')&&vis(n)&&names.filter(x=>clean(n.innerText).includes(x)).length>=4);
   navs.sort((a,b)=>a.getBoundingClientRect().top-b.getBoundingClientRect().top);
   const nav=navs[0];if(!nav)return false;
   const b=[...nav.querySelectorAll(':scope > button')].find(b=>{const t=clean(b.innerText);return t===name||t.endsWith(' '+name)});
   if(!b)return false;b.click();return true;
 },name);
}
function assertTop(view,m,baseX=null){
 if(!m){issue(view,'top nav missing');return}
 const names=m.items.map(x=>x.name);
 const exp=['Home','Fundamental','Signal Scan','Crypto','Renko'];
 if(JSON.stringify(names)!==JSON.stringify(exp))issue(view,'top nav labels '+JSON.stringify(names));
 const ws=m.items.map(x=>x.w),hs=m.items.map(x=>x.h),icons=m.items.map(x=>x.icon?.w||0),fonts=m.items.map(x=>x.label.fontSize);
 if(Math.max(...ws)-Math.min(...ws)>0.75)issue(view,'button width drift '+JSON.stringify(ws));
 if(Math.max(...hs)-Math.min(...hs)>0.75)issue(view,'button height drift '+JSON.stringify(hs));
 if(Math.max(...icons)-Math.min(...icons)>0.75)issue(view,'icon size drift '+JSON.stringify(icons));
 if(Math.max(...fonts)-Math.min(...fonts)>0.75)issue(view,'font size drift '+JSON.stringify(fonts));
 if(m.scrollWidth>m.innerWidth+2)issue(view,'horizontal overflow '+m.scrollWidth+'>'+m.innerWidth);
 if(baseX!=null&&Math.abs(m.nav.x-baseX)>1)issue(view,'nav x drift '+Math.abs(m.nav.x-baseX).toFixed(2)+'px');
}
async function fundamentalMetrics(page){
  const frames=page.frames();
  for(const fr of frames){
    try{
      const has=await fr.locator('.mainNav').count();
      if(!has)continue;
      return await fr.evaluate(()=>{
        const nav=document.querySelector('.mainNav'),bar=document.querySelector('#fundSearchBar'),nr=nav.getBoundingClientRect(),br=bar?.getBoundingClientRect();
        const vis=e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return r.width&&r.height&&s.display!=='none'};
        return {nav:{x:nr.x,y:nr.y,w:nr.width,h:nr.height},items:[...nav.querySelectorAll(':scope > button')].filter(vis).map(b=>{const r=b.getBoundingClientRect(),svg=b.querySelector('svg'),sr=svg?.getBoundingClientRect(),l=b.querySelector('.mainNavLabel'),cs=l?getComputedStyle(l):null;return{name:String(b.innerText||'').trim(),x:r.x,y:r.y,w:r.width,h:r.height,icon:sr?{w:sr.width,h:sr.height}:null,label:l?{fontSize:parseFloat(cs.fontSize)||0,fontWeight:cs.fontWeight}:null}}),filter:br?{x:br.x,y:br.y,w:br.width,h:br.height}:null,scrollWidth:document.documentElement.scrollWidth,innerWidth};
      });
    }catch{}
  }
  return null;
}
async function clickSignalBack(page){
 return await page.evaluate(()=>{
   const buttons=[...document.querySelectorAll('button')].filter(b=>{const r=b.getBoundingClientRect(),s=getComputedStyle(b);return r.width>0&&r.height>0&&s.display!=='none'&&!b.closest('#desktop-sidebar')&&r.top<90&&r.width<=64&&r.height<=64});
   const b=buttons.find(b=>{const ds=[...b.querySelectorAll('svg path')].map(p=>String(p.getAttribute('d')||'').replace(/\s+/g,''));return ds.some(d=>d.includes('M19')&&d.includes('12H5'))&&ds.some(d=>d.includes('m1219-7-77-7')||d.includes('m12 19-7-7 7-7'))});
   if(!b)return false;b.click();return true;
 });
}
async function homeFilter(page){
 return await page.evaluate(()=>{
   const clean=s=>String(s||'').replace(/\s+/g,' ').trim();
   const btn=[...document.querySelectorAll('button')].find(b=>clean(b.innerText)==='Cari');
   if(!btn)return null;let p=btn.parentElement;
   for(let i=0;i<8&&p;i++,p=p.parentElement){const t=clean(p.innerText);if(['Max Loss','Profit Factor','Win Rate','Risk Reward'].filter(x=>t.includes(x)).length>=3){const r=p.getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height}}}
   return null;
 });
}
async function signalFilter(page){
 return await page.evaluate(()=>{const e=document.querySelector('#ai3-signal-filter');if(!e)return null;const r=e.getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height}});
}

const browser=await chromium.launch({headless:true});
try{
 for(const cfg of [{view:'desktop',w:1600,h:1000},{view:'mobile',w:390,h:844}]){
   const ctx=await browser.newContext({viewport:{width:cfg.w,height:cfg.h},deviceScaleFactor:1});
   const page=await ctx.newPage();await installRoutes(page);
   const v=cfg.view,r=report[v];
   await setHome(page,v+'-home');
   const hm=await topMetrics(page);r.home=hm;assertTop(v,hm);const baseX=hm?.nav.x??null;
   r.homeFilter=await homeFilter(page);
   if(v==='desktop'&&r.homeFilter&&Math.abs(r.homeFilter.w-1170)>2)issue(v,'Home filter width '+r.homeFilter.w);
   await page.screenshot({path:path.join(out,v+'-home.png'),fullPage:false});

   for(const label of ['Crypto','Renko']){
      await setHome(page,v+'-'+label.toLowerCase());
      if(!await clickTop(page,label)){issue(v,label+' click missing');continue}
      await page.waitForTimeout(2500);
      const m=await topMetrics(page);r[label.toLowerCase()]=m;assertTop(v,m,baseX);
      await page.screenshot({path:path.join(out,v+'-'+label.toLowerCase()+'.png'),fullPage:false});
   }

   await setHome(page,v+'-fund');
   if(!await clickTop(page,'Fundamental'))issue(v,'Fundamental click missing');
   await page.waitForTimeout(3000);
   const fm=await fundamentalMetrics(page);r.fundamental=fm;
   if(!fm) issue(v,'Fundamental frame/nav missing');
   else{
     const names=fm.items.map(x=>x.name);
     if(JSON.stringify(names)!==JSON.stringify(['Home','Fundamental','Signal Scan','Crypto','Renko']))issue(v,'Fundamental labels '+JSON.stringify(names));
     const ws=fm.items.map(x=>x.w),icons=fm.items.map(x=>x.icon?.w||0);
     if(Math.max(...ws)-Math.min(...ws)>0.75)issue(v,'Fundamental button widths '+JSON.stringify(ws));
     if(Math.max(...icons)-Math.min(...icons)>0.75)issue(v,'Fundamental icon widths '+JSON.stringify(icons));
     if(v==='desktop'&&fm.filter&&(Math.abs(fm.filter.w-1170)>2||Math.abs(fm.filter.h-64)>2))issue(v,'Fundamental filter '+fm.filter.w+'x'+fm.filter.h);
     if(fm.scrollWidth>fm.innerWidth+2)issue(v,'Fundamental overflow '+fm.scrollWidth+'>'+fm.innerWidth);
   }
   await page.screenshot({path:path.join(out,v+'-fundamental.png'),fullPage:false});

   await setHome(page,v+'-signal');
   if(!await clickTop(page,'Signal Scan')) issue(v,'Signal Scan click missing');
   await page.waitForTimeout(3000);
   r.signalFilter=await signalFilter(page);
   if(!r.signalFilter)issue(v,'Signal filter missing');
   else if(v==='desktop'&&(Math.abs(r.signalFilter.w-1170)>2||Math.abs(r.signalFilter.h-64)>2))issue(v,'Signal filter '+r.signalFilter.w+'x'+r.signalFilter.h);
   r.signalMode=await page.evaluate(()=>localStorage.getItem('ot_backtest_view_mode'));
   await page.screenshot({path:path.join(out,v+'-signal.png'),fullPage:false});
   const back=await clickSignalBack(page);r.signalBackClicked=back;
   if(!back)issue(v,'Signal back arrow not found');
   else{
     await page.waitForTimeout(3000);
     const mode=await page.evaluate(()=>localStorage.getItem('ot_backtest_view_mode'));r.afterSignalBackMode=mode;
     const hf=await homeFilter(page);r.afterSignalBackFilter=hf;
     if(mode!=='home')issue(v,'Signal back mode '+mode);
     if(!hf)issue(v,'Signal back did not restore Home filter');
     const bm=await topMetrics(page);r.afterSignalBackNav=bm;if(bm)assertTop(v,bm,baseX);
     await page.screenshot({path:path.join(out,v+'-signal-back-home.png'),fullPage:false});
   }

   // Route stress: visible top nav cycles on desktop; mobile cycles where nav remains visible.
   const cycle=['Crypto','Home','Renko','Home','Signal Scan','Home'];
   r.cycle=[];
   await setHome(page,v+'-cycle');
   for(const label of cycle){
     let ok;
     if(label==='Home' && (await page.evaluate(()=>localStorage.getItem('ot_backtest_view_mode')))==='scanner-signal') ok=await clickSignalBack(page);
     else ok=await clickTop(page,label);
     await page.waitForTimeout(1800);
     const state=await page.evaluate(()=>({mode:localStorage.getItem('ot_backtest_view_mode'),hasError:/Terjadi Kesalahan|Something went wrong/i.test(document.body.innerText),scrollWidth:document.documentElement.scrollWidth,innerWidth}));
     r.cycle.push({label,clicked:ok,state});
     if(!ok)issue(v,'cycle click missing '+label);
     if(state.hasError)issue(v,'cycle error screen at '+label);
     if(state.scrollWidth>state.innerWidth+2)issue(v,'cycle horizontal overflow at '+label);
   }
   await ctx.close();
 }
 report.ok=report.issues.length===0;report.acceptance=report.ok?'PASS':'FAIL';
} catch(e){report.error=String(e?.stack||e);report.issues.push('fatal: '+String(e));}
finally{await browser.close();fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');}
if(!report.ok)process.exit(1);
