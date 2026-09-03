const { chromium } = require('playwright');
const fs=require('fs');
const path=require('path');
const OUT=process.env.OUT_DIR, ID=process.env.ACCEPT_ID;
fs.mkdirSync(OUT,{recursive:true});
const cand={
 shell:fs.readFileSync('ai3-candidate/ai3_public_shell_v2.js'),
 runtime:fs.readFileSync('ai3-candidate/ai5_signal_scan_runtime_v2.js'),
 fundamental:fs.readFileSync('ai3-candidate/fundamental.html')
};
const report={id:ID,ok:false,acceptance:'FAIL',issues:[],desktop:{},mobile:{}};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function issue(view,msg){report.issues.push(view+': '+msg)}
async function setup(page){
 await page.route(/\/assets\/js\/ai3_public_shell_v1\.js(?:\?.*)?$/,r=>r.fulfill({status:200,contentType:'application/javascript; charset=utf-8',body:cand.shell}));
 await page.route(/\/assets\/js\/ai5_signal_scan_runtime_v1\.js(?:\?.*)?$/,r=>r.fulfill({status:200,contentType:'application/javascript; charset=utf-8',body:cand.runtime}));
 await page.route(/\/fundamental\.html(?:\?.*)?$/,r=>r.fulfill({status:200,contentType:'text/html; charset=utf-8',body:cand.fundamental}));
}
async function rootHome(page,tag){
 await page.goto('https://copytolive.com/?ai3candidate='+encodeURIComponent(ID)+'&s='+tag,{waitUntil:'domcontentloaded',timeout:60000});
 await page.evaluate(()=>localStorage.setItem('ot_backtest_view_mode','home'));
 await page.reload({waitUntil:'domcontentloaded',timeout:60000});
 await page.waitForTimeout(3500);
}
async function visible(el){return el&&await el.isVisible().catch(()=>false)}
async function topNav(page){
 return await page.evaluate(()=>{
  const clean=s=>String(s||'').replace(/\s+/g,' ').trim(),vis=e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return r.width>0&&r.height>0&&s.display!=='none'&&s.visibility!=='hidden'&&Number(s.opacity||1)>0};
  const names=['Home','Fundamental','Signal Scan','Crypto','Renko'],norm=t=>{t=clean(t);if(t.endsWith(' Crypto'))return'Crypto';return names.find(n=>t===n||t.endsWith(' '+n))||t};
  const navs=[...document.querySelectorAll('nav')].filter(n=>!n.closest('#desktop-sidebar')&&vis(n)&&names.filter(x=>clean(n.innerText).includes(x)).length>=4&&n.getBoundingClientRect().top<230).sort((a,b)=>a.getBoundingClientRect().top-b.getBoundingClientRect().top);
  const nav=navs[0];if(!nav)return null;const nr=nav.getBoundingClientRect();
  const items=[...nav.querySelectorAll(':scope > button')].filter(vis).map(b=>{const r=b.getBoundingClientRect(),svg=b.querySelector('svg'),sr=svg?svg.getBoundingClientRect():null,sp=[...b.querySelectorAll('span')].filter(vis),lab=sp.find(x=>norm(x.textContent)===norm(b.innerText).replace(/^₿\s*/,''))||sp[sp.length-1]||b,lr=lab.getBoundingClientRect(),cs=getComputedStyle(lab);return{name:norm(b.innerText).replace(/^₿\s*/,''),x:r.x,y:r.y,w:r.width,h:r.height,icon:sr?{w:sr.width,h:sr.height}:null,label:{w:lr.width,h:lr.height,fontSize:parseFloat(cs.fontSize)||0,fontWeight:cs.fontWeight}}});
  return{nav:{x:nr.x,y:nr.y,w:nr.width,h:nr.height},items,scrollWidth:document.documentElement.scrollWidth,innerWidth,mode:localStorage.getItem('ot_backtest_view_mode'),error:/Terjadi Kesalahan|Aplikasi mengalami error/i.test(document.body.innerText),body:clean(document.body.innerText).slice(0,1600)};
 });
}
async function filterBar(page,labels){
 return await page.evaluate((labels)=>{
  const clean=s=>String(s||'').replace(/\s+/g,' ').trim(),vis=e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return r.width>0&&r.height>0&&s.display!=='none'&&s.visibility!=='hidden'};
  const cs=[...document.querySelectorAll('[data-ai3-filterbar="1"],#ai3-signal-filter')].filter(vis);
  const e=cs.find(x=>labels.filter(k=>clean(x.innerText).includes(k)).length>=Math.min(3,labels.length));if(!e)return null;const r=e.getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height,text:clean(e.innerText)};
 },labels);
}
async function clickTop(page,name){
 return await page.evaluate(name=>{
  const clean=s=>String(s||'').replace(/\s+/g,' ').trim(),vis=e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return r.width>0&&r.height>0&&s.display!=='none'&&s.visibility!=='hidden'};
  const names=['Home','Fundamental','Signal Scan','Crypto','Renko'];const navs=[...document.querySelectorAll('nav')].filter(n=>!n.closest('#desktop-sidebar')&&vis(n)&&names.filter(x=>clean(n.innerText).includes(x)).length>=4&&n.getBoundingClientRect().top<230).sort((a,b)=>a.getBoundingClientRect().top-b.getBoundingClientRect().top);const nav=navs[0];if(!nav)return false;
  const b=[...nav.querySelectorAll(':scope > button')].find(b=>{let t=clean(b.innerText).replace(/^₿\s*/,'');return t===name||t.endsWith(' '+name)});if(!b)return false;b.click();return true;
 },name);
}
function geom(m){return m&&m.items.map(x=>[+x.x.toFixed(2),+x.y.toFixed(2),+x.w.toFixed(2),+x.h.toFixed(2),+(x.icon?.w||0).toFixed(2),+(x.icon?.h||0).toFixed(2),+x.label.fontSize.toFixed(2)])}
function delta(a,b){const A=geom(a),B=geom(b);if(!A||!B||A.length!==B.length)return 999;let d=0;for(let i=0;i<A.length;i++)for(let j=0;j<A[i].length;j++)d=Math.max(d,Math.abs(A[i][j]-B[i][j]));return d}
async function shot(page,name){await page.screenshot({path:path.join(OUT,name+'.png'),fullPage:false})}
async function assertNav(view,m,expW,expIcon){
 if(!m){issue(view,'top nav missing');return}
 const names=m.items.map(x=>x.name);
 if(JSON.stringify(names)!==JSON.stringify(['Home','Fundamental','Signal Scan','Crypto','Renko']))issue(view,'labels '+JSON.stringify(names));
 if(m.error)issue(view,'application error visible');
 if(m.scrollWidth>m.innerWidth+2)issue(view,'body horizontal overflow '+m.scrollWidth+'>'+m.innerWidth);
 const ws=m.items.map(x=>x.w),hs=m.items.map(x=>x.h),icons=m.items.map(x=>x.icon?.w||0);
 if(Math.max(...ws)-Math.min(...ws)>1.1)issue(view,'button width drift '+JSON.stringify(ws));
 if(Math.max(...hs)-Math.min(...hs)>1.1)issue(view,'button height drift '+JSON.stringify(hs));
 if(Math.max(...icons)-Math.min(...icons)>1.1)issue(view,'icon width drift '+JSON.stringify(icons));
 if(Math.max(...ws.map(x=>Math.abs(x-expW)))>1.1)issue(view,'button width not '+expW+' '+JSON.stringify(ws));
 if(Math.max(...icons.map(x=>Math.abs(x-expIcon)))>1.1)issue(view,'icon width not '+expIcon+' '+JSON.stringify(icons));
}
async function fundamentalMetrics(frame){
 return frame.evaluate(()=>{
  const clean=s=>String(s||'').replace(/\s+/g,' ').trim(),vis=e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return r.width>0&&r.height>0&&s.display!=='none'&&s.visibility!=='hidden'};
  const nav=document.querySelector('.mainNav'),bar=document.querySelector('#fundSearchBar');if(!nav)return null;const nr=nav.getBoundingClientRect(),br=bar&&bar.getBoundingClientRect();
  return{nav:{x:nr.x,y:nr.y,w:nr.width,h:nr.height},items:[...nav.querySelectorAll(':scope > button')].filter(vis).map(b=>{const r=b.getBoundingClientRect(),svg=b.querySelector('svg'),sr=svg&&svg.getBoundingClientRect(),l=b.querySelector('.mainNavLabel'),lr=l&&l.getBoundingClientRect(),cs=l&&getComputedStyle(l);return{name:clean(b.innerText),w:r.width,h:r.height,x:r.x,y:r.y,icon:sr?{w:sr.width,h:sr.height}:null,label:lr?{w:lr.width,h:lr.height,fontSize:parseFloat(cs.fontSize)||0,fontWeight:cs.fontWeight}:null}}),filter:br?{x:br.x,y:br.y,w:br.width,h:br.height}:null,scrollWidth:document.documentElement.scrollWidth,innerWidth};
 });
}
async function testViewport(browser,view,viewport,expW,expIcon){
 const context=await browser.newContext({viewport,serviceWorkers:'block'});
 const page=await context.newPage();await setup(page);
 page.on('pageerror',e=>issue(view,'pageerror '+e.message));
 const consoleErrors=[];page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text())});
 const rr=report[view];
 await rootHome(page,view+'-home');let home=await topNav(page);rr.home=home;await assertNav(view,home,expW,expIcon);await shot(page,view+'-home');
 const homeFilter=await filterBar(page,['Max Loss','Profit Factor','Win Rate','Risk Reward']);rr.homeFilter=homeFilter;
 if(!homeFilter)issue(view,'Home filter missing');else{const eh=view==='desktop'?64:56;if(Math.abs(homeFilter.h-eh)>2)issue(view,'Home filter height '+homeFilter.h)}
 // Fundamental overlay and direct frame metrics
 if(!await clickTop(page,'Fundamental'))issue(view,'Fundamental click missing');else{
   await page.waitForSelector('#ai4-fundamental-root-view iframe',{timeout:15000}).catch(()=>null);await page.waitForTimeout(2500);
   const el=page.locator('#ai4-fundamental-root-view iframe');if(await el.count()){
    const frame=el.contentFrame();const fm=await fundamentalMetrics(frame);rr.fundamental=fm;await shot(page,view+'-fundamental');
    if(!fm)issue(view,'Fundamental frame metrics missing');else{
      const names=fm.items.map(x=>x.name);if(JSON.stringify(names)!==JSON.stringify(['Home','Fundamental','Signal Scan','Crypto','Renko']))issue(view,'Fundamental labels '+JSON.stringify(names));
      const ws=fm.items.map(x=>x.w),icons=fm.items.map(x=>x.icon?.w||0);if(Math.max(...ws)-Math.min(...ws)>1.1)issue(view,'Fundamental button width drift '+JSON.stringify(ws));if(Math.max(...icons)-Math.min(...icons)>1.1)issue(view,'Fundamental icon drift '+JSON.stringify(icons));
      if(view==='desktop'&&fm.filter&&(Math.abs(fm.filter.w-1170)>2||Math.abs(fm.filter.h-64)>2))issue(view,'Fundamental filter '+JSON.stringify(fm.filter));
      if(fm.scrollWidth>fm.innerWidth+2)issue(view,'Fundamental body overflow '+fm.scrollWidth+'>'+fm.innerWidth);
    }
    await frame.locator('[data-main-nav="home"]').click();await page.waitForTimeout(1500);
    if(await page.locator('#ai4-fundamental-root-view').count())issue(view,'Fundamental Home did not close overlay');
   }else issue(view,'Fundamental iframe missing');
 }
 // Signal and exact outer back arrow
 if(!await clickTop(page,'Signal Scan'))issue(view,'Signal Scan click missing');else{
   await page.waitForTimeout(4500);rr.signalState=await topNav(page);const sf=await filterBar(page,['Instruments','Timeframe','R:R','Mode']);rr.signalFilter=sf;await shot(page,view+'-signal');
   const body=await page.locator('body').innerText();if(!/Market Scanner|Scanner Signal/.test(body))issue(view,'Signal Scan did not render');if(!sf)issue(view,'Signal filter missing');else{const eh=view==='desktop'?64:56;if(Math.abs(sf.h-eh)>2)issue(view,'Signal filter height '+sf.h)}
   const backOk=await page.evaluate(()=>{const clean=s=>String(s||'').replace(/\s+/g,' ').trim(),sp=[...document.querySelectorAll('span')].find(x=>clean(x.textContent)==='Scanner Signal');if(!sp)return false;const row=sp.parentElement&&sp.parentElement.parentElement,b=row&&row.querySelector(':scope > button');if(!b)return false;b.click();return true});
   rr.signalBackClicked=backOk;if(!backOk)issue(view,'Signal outer back missing');else{await page.waitForTimeout(1800);const st=await page.evaluate(()=>({mode:localStorage.getItem('ot_backtest_view_mode'),text:document.body.innerText.slice(0,3000)}));rr.afterSignalBack=st;await shot(page,view+'-signal-back');if(st.mode!=='home')issue(view,'Signal Back storage='+st.mode);if(/Scanner Signal/.test(st.text)&&!/Max Loss/.test(st.text))issue(view,'Signal Back did not render Home')}
 }
 // Route geometry and mixed cycles
 await rootHome(page,view+'-routes');home=await topNav(page);
 for(const name of ['Crypto','Renko']){
   if(!await clickTop(page,name)){issue(view,name+' click missing');continue}
   await page.waitForTimeout(name==='Renko'?5500:3500);const m=await topNav(page);rr[name.toLowerCase()]={metrics:m,deltaPx:delta(home,m)};await shot(page,view+'-'+name.toLowerCase());if(m){await assertNav(view,m,expW,expIcon);if(delta(home,m)>1.5)issue(view,name+' geometry drift '+delta(home,m));if(m.error)issue(view,name+' app error')}
   if(await clickTop(page,'Home'))await page.waitForTimeout(3000);else{await rootHome(page,view+'-recover-'+name,3)}
 }
 for(let cycle=0;cycle<3;cycle++){
   await rootHome(page,view+'-cycle-'+cycle,3);
   for(const name of ['Crypto','Home','Renko','Home','Fundamental']){
     const ok=await clickTop(page,name);if(!ok){issue(view,'cycle '+cycle+' click '+name+' missing');break}
     await page.waitForTimeout(name==='Renko'?4200:2600);
     if(name==='Fundamental'){
       const frameEl=page.locator('#ai4-fundamental-root-view iframe');if(!(await frameEl.count())){issue(view,'cycle '+cycle+' Fundamental iframe missing');break}
       const frame=frameEl.contentFrame();await frame.locator('[data-main-nav="home"]').click();await page.waitForTimeout(1200);
     }else{
       const m=await topNav(page);if(m?.error){issue(view,'cycle '+cycle+' '+name+' app error');break}
     }
   }
 }
 rr.consoleErrors=consoleErrors.filter(x=>!/favicon|ResizeObserver loop/i.test(x)).slice(0,30);
 if(rr.consoleErrors.some(x=>/Minified React error|uncaught|TypeError/i.test(x)))issue(view,'serious console '+rr.consoleErrors.join(' | '));
 await context.close();
}
(async()=>{
 let browser;
 try{
  browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
  await testViewport(browser,'desktop',{width:1600,height:1000},88,32);
  await testViewport(browser,'mobile',{width:390,height:844},76,28);
  report.ok=report.issues.length===0;report.acceptance=report.ok?'PASS':'FAIL';
 }catch(e){report.issues.push('fatal: '+e.stack)}
 finally{if(browser)await browser.close();fs.writeFileSync(path.join(OUT,'report.json'),JSON.stringify(report,null,2)+'\n');if(!report.ok)process.exitCode=1}
})();