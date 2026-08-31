(()=>{
'use strict';
if(window.RWATradeUIPolish)return;

function ensureCss(){
  if(document.querySelector('link[data-rwa-trade-polish]'))return;
  const l=document.createElement('link');
  l.rel='stylesheet';
  l.href='./ui-polish.css?v=2';
  l.dataset.rwaTradePolish='2';
  document.head.appendChild(l);
}

function injectOnce(){
  ensureCss();
  const nav=document.querySelector('.product-nav');
  if(nav&&!nav.querySelector('.rwa-store-link')){
    const a=document.createElement('a');
    a.className='rwa-store-link';
    a.href='../?shop=1';
    a.textContent='Physical Stores';
    const backtest=[...nav.querySelectorAll('a')].find(x=>x.textContent.toLowerCase().includes('backtest'));
    nav.insertBefore(a,backtest||null);
  }
}

function boot(){
  requestAnimationFrame(injectOnce);
}

window.RWATradeUIPolish={
  version:'2.0.0',
  runtime:'stable-no-observer-v2',
  refresh:injectOnce
};

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
else boot();
})();
