(()=>{
'use strict';
if(window.RWAGoldenHome)return;
const VERSION='1.0.0';
const TF={ '1m':'1','5m':'5','15m':'15','1H':'60','4H':'240','1D':'D' };
const PAIR={ 'BTC/USDT':'BTCUSDT','ETH/USDT':'ETHUSDT','USDC/USDT':'USDCUSDT','MATIC/USDT':'MATICUSDT','SOL/USDT':'SOLUSDT' };
const $=s=>document.querySelector(s);
const toast=t=>{try{typeof window.toast==='function'&&window.toast(t)}catch{}};
function clickHidden(sel){const el=$(sel);if(!el)return false;try{el.click();return true}catch{return false}}
async function ensure(){
  if(innerWidth<900)return false;
  if(!location.hash){try{history.replaceState(history.state,'',location.pathname+location.search+'#shop')}catch{location.hash='#shop'}}
  if(!window.RWAScreenshotToCodeParity)await import('./rwa-screenshot-parity-v1.js?v=1.0.0');
  window.RWAScreenshotToCodeParity?.show?.();
  document.documentElement.dataset.rwaGoldenHome='ready';
  return true;
}
function syncClick(e){
  const root=e.target.closest?.('#rwaScreenshotParity');
  if(!root)return;
  const watch=e.target.closest?.('[data-stc-watch]');
  if(watch){
    const sym=PAIR[watch.dataset.stcWatch];
    if(sym)queueMicrotask(()=>clickHidden('.pairrow[data-sym="'+sym+'"]'));
    return;
  }
  const tf=e.target.closest?.('[data-stc-tf]');
  if(tf){
    const iv=TF[tf.dataset.stcTf];
    if(iv)queueMicrotask(()=>clickHidden('#timeframes [data-iv="'+iv+'"], [data-iv="'+iv+'"]'));
    return;
  }
  const nav=e.target.closest?.('[data-stc-nav]');
  if(nav){
    const key=nav.dataset.stcNav;
    if(!['markets','ecommerce'].includes(key))queueMicrotask(()=>clickHidden('.topnav [data-rwa-target-nav="'+key+'"]'));
    return;
  }
  const act=e.target.closest?.('[data-stc-action]')?.dataset.stcAction;
  if(!act)return;
  if(act==='wallet')queueMicrotask(()=>clickHidden('.top-actions .signin,.signin'));
  else if(act==='theme')queueMicrotask(()=>clickHidden('.top-actions [aria-label="Theme"]'));
  else if(act==='alert')queueMicrotask(()=>clickHidden('.top-actions [aria-label="Alerts"]'));
  else if(act==='help')queueMicrotask(()=>clickHidden('.top-actions [aria-label="Help"]'));
  else if(act==='buy'||act==='sell')toast(act.toUpperCase()+' remains protected by the execution gate until wallet and verification are ready');
}
function audit(){
  const p=window.RWAScreenshotToCodeParity?.audit?.()||null;
  const stage=$('#rwaScreenshotParity .stc-stage')?.getBoundingClientRect();
  return {
    version:VERSION,
    ready:document.documentElement.dataset.rwaGoldenHome==='ready',
    parity:p,
    stage:stage?{left:Math.round(stage.left),top:Math.round(stage.top),width:Math.round(stage.width),height:Math.round(stage.height)}:null,
    hiddenMarketRuntime:!!$('#pairList')&&!!$('#fallbackChart'),
    hiddenWallet:!!$('.signin'),
    ecommerceBridge:!!window.RWASeablueprintCommerceBridge,
    renkoInRoot:/renko/i.test(document.documentElement.innerHTML),
    nextInRoot:/\/rwa\/_next\//i.test(document.documentElement.innerHTML)
  };
}
document.addEventListener('click',syncClick,true);
addEventListener('resize',()=>{if(innerWidth>=900)ensure();},{passive:true});
window.RWAGoldenHome={version:VERSION,ensure,audit};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>ensure(),{once:true});else ensure();
})();