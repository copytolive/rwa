(()=>{
'use strict';
if(window.RWAReferenceParityV22Final)return;
const VERSION='2.2.3';
let attempted=false,selected='',source='unchanged',guardFrame=0,guarding=false,stabilizeToken=0;
function state(){try{return window.RWAMarketRuntime?.state?.()||null}catch{return null}}
function hasMarketOverride(){try{return new URLSearchParams(location.search).has('market')}catch{return false}}
function baseOf(sym){return String(sym||'').toUpperCase().replace(/USDT$/,'')}
function syncMarketLabels(){
  const s=state(),base=baseOf(s?.selected||selected);if(!base)return;
  document.querySelectorAll('[data-live-base]').forEach(el=>{if(el.textContent!==base)el.textContent=base});
  const chartBase=document.querySelector('.rwa-v22-chart-title b');if(chartBase&&chartBase.textContent!==base)chartBase.textContent=base;
}
function stabilize(sym){
  const token=++stabilizeToken,target=String(sym||'');if(!target)return;
  const again=delay=>setTimeout(()=>{if(token!==stabilizeToken)return;const s=state();if(String(s?.selected||'')!==target)return;try{window.RWAMarketRuntime?.selectPair?.(target,false)}catch{}syncMarketLabels()},delay);
  again(900);again(2200);
  setTimeout(()=>{if(token!==stabilizeToken)return;const s=state();if(String(s?.selected||'')!==target)return;try{window.RWAMarketRuntime?.reload?.()}catch{}syncMarketLabels()},3600)
}
function choose(){
  const s=state();
  if(hasMarketOverride()){source='market-override';selected=String(s?.selected||'');return true}
  if(!s?.pairs?.length||s.pairs.length<50)return false;
  if(attempted)return true;
  attempted=true;
  const paxg=s.pairs.find(p=>p?.symbol==='PAXGUSDT'&&Number(p?.price)>0);
  const runtimeRwa=s.pairs.filter(p=>p?.rwa&&Number(p?.price)>0).sort((a,b)=>Number(b?.vol||0)-Number(a?.vol||0))[0];
  const pick=paxg||runtimeRwa;
  if(!pick?.symbol){selected=String(s.selected||'');source='no-verified-rwa-pair';syncMarketLabels();return true}
  selected=pick.symbol;source=paxg?'verified-paxg-market':'runtime-rwa-classification';
  if(String(s.selected||'')!==pick.symbol){try{window.RWAMarketRuntime?.selectPair?.(pick.symbol,false)}catch{}}
  stabilize(pick.symbol);syncMarketLabels();return true
}
function shellTargets(){return['.topbar','.layout','.layout>.left','.layout>.main','.layout>.right','#liveRail','#rwaV5Bottom','#rwaV5Footer','.quickstats .price-stat'].map(s=>document.querySelector(s)).filter(Boolean)}
let shellObserver=null;
function observeShell(){
  if(!shellObserver)shellObserver=new MutationObserver(()=>{if(guarding)return;cancelAnimationFrame(guardFrame);guardFrame=requestAnimationFrame(enforceShell)});
  shellObserver.disconnect();
  for(const el of shellTargets())shellObserver.observe(el,{attributes:true,attributeFilter:['style','class']});
}
function enforceShell(){
  if(guarding)return;guarding=true;
  try{
    shellObserver?.disconnect();
    if(innerWidth>=1281)window.RWAReferenceParityV22?.desktopGeometry?.();
    const desktopPrice=document.querySelector('.quickstats .price-stat');
    if(desktopPrice){
      if(innerWidth<=680)desktopPrice.style.setProperty('display','none','important');
      else desktopPrice.style.removeProperty('display');
    }
    syncMarketLabels();
  }finally{guarding=false;observeShell()}
}
function consistency(){
  const s=state(),sym=String(s?.selected||selected||''),p=s?.pairs?.find(x=>x?.symbol===sym),px=Number(p?.price||0),close=Number(s?.klines?.at?.(-1)?.c||0),bid=Number(s?.book?.bids?.[0]?.[0]||0),ask=Number(s?.book?.asks?.[0]?.[0]||0),mid=bid>0&&ask>0?(bid+ask)/2:(bid||ask||0),rel=(v)=>px>0&&v>0?Math.abs(v/px-1):0;
  return{symbol:sym,base:baseOf(sym),price:px,chartClose:close,bookMid:mid,chartCoherent:!(px>0&&close>0)||rel(close)<.12,bookCoherent:!(px>0&&mid>0)||rel(mid)<.12}
}
function audit(){const c=consistency();return{version:VERSION,attempted,selected:String(state()?.selected||selected||''),source,mainnetReady:window.RWAExchangeCore?.mainnetUnlocked?.()===true,overlayImages:document.querySelectorAll('.reference,.pixel-stage>.reference,#rwaScreenshotParity').length,marketConsistency:c,marketConsistent:c.chartCoherent&&c.bookCoherent}}
function boot(){
  document.documentElement.dataset.rwaReferenceV22Final='1';
  choose();
  enforceShell();
  window.addEventListener('resize',()=>requestAnimationFrame(enforceShell),{passive:true});
  let n=0;const timer=setInterval(()=>{n++;enforceShell();if(choose()||n>80)clearInterval(timer)},250);
  const labelTimer=setInterval(()=>{syncMarketLabels();if(document.hidden)return;const a=audit();if(a.attempted&&a.marketConsistent&&n>8)clearInterval(labelTimer)},500);
  window.RWAReferenceParityV22Final={version:VERSION,active:true,choose,audit,enforceShell,syncMarketLabels,consistency};
  window.dispatchEvent(new CustomEvent('rwa:reference-v22-final-ready',{detail:{version:VERSION}}))
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();