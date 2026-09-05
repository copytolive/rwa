(()=>{
'use strict';
if(window.RWAReferenceParityV22Final)return;
const VERSION='2.2.2';
let attempted=false,selected='',source='unchanged',guardFrame=0,guarding=false;
function state(){try{return window.RWAMarketRuntime?.state?.()||null}catch{return null}}
function hasMarketOverride(){try{return new URLSearchParams(location.search).has('market')}catch{return false}}
function choose(){
  const s=state();
  if(!s?.pairs?.length||s.pairs.length<50||hasMarketOverride())return false;
  attempted=true;
  if(String(s.selected||'').toUpperCase()!=='BTCUSDT'){selected=String(s.selected||'');source='existing-selection';return true}
  const paxg=s.pairs.find(p=>p?.symbol==='PAXGUSDT'&&Number(p?.price)>0);
  const runtimeRwa=s.pairs.filter(p=>p?.rwa&&Number(p?.price)>0).sort((a,b)=>Number(b?.vol||0)-Number(a?.vol||0))[0];
  const pick=paxg||runtimeRwa;
  if(!pick?.symbol){selected=String(s.selected||'');source='no-verified-rwa-pair';return true}
  selected=pick.symbol;source=paxg?'verified-paxg-market':'runtime-rwa-classification';
  try{window.RWAMarketRuntime?.selectPair?.(pick.symbol,false)}catch{}
  return true
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
  }finally{guarding=false;observeShell()}
}
function audit(){return{version:VERSION,attempted,selected:String(state()?.selected||selected||''),source,mainnetReady:window.RWAExchangeCore?.mainnetUnlocked?.()===true,overlayImages:document.querySelectorAll('.reference,.pixel-stage>.reference,#rwaScreenshotParity').length}}
function boot(){
  document.documentElement.dataset.rwaReferenceV22Final='1';
  choose();
  enforceShell();
  window.addEventListener('resize',()=>requestAnimationFrame(enforceShell),{passive:true});
  let n=0;const timer=setInterval(()=>{n++;enforceShell();if(choose()||n>12)clearInterval(timer)},250);
  window.RWAReferenceParityV22Final={version:VERSION,active:true,choose,audit,enforceShell};
  window.dispatchEvent(new CustomEvent('rwa:reference-v22-final-ready',{detail:{version:VERSION}}))
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();