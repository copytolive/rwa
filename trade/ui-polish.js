(()=>{
'use strict';
if(window.RWATradeUIPolish)return;
function css(){if(document.querySelector('link[data-rwa-trade-polish]'))return;const l=document.createElement('link');l.rel='stylesheet';l.href='./ui-polish.css?v=1';l.dataset.rwaTradePolish='1';document.head.appendChild(l)}
function inject(){css();const nav=document.querySelector('.product-nav');if(nav&&!nav.querySelector('.rwa-store-link')){const a=document.createElement('a');a.className='rwa-store-link';a.href='../?shop=1';a.textContent='Physical Stores';const backtest=[...nav.querySelectorAll('a')].find(x=>x.textContent.toLowerCase().includes('backtest'));nav.insertBefore(a,backtest||null)}const market=document.querySelector('.market.card');if(market&&!document.getElementById('rwaTradeCommerceStrip')){const d=document.createElement('div');d.id='rwaTradeCommerceStrip';d.className='rwa-trade-commerce-strip';d.innerHTML='<div><small>RWA × REAL COMMERCE</small><b>Each RWA store-token maps to one verified physical storefront + ecommerce catalog.</b></div><a href="../?shop=1">Open physical stores →</a>';market.prepend(d)}if(!document.getElementById('rwaTradeMobileStore')){const a=document.createElement('a');a.id='rwaTradeMobileStore';a.className='rwa-trade-mobile-store';a.href='../?shop=1';a.setAttribute('aria-label','Open RWA physical stores');a.textContent='▦';document.body.appendChild(a)}}
function bind(){inject();new MutationObserver(inject).observe(document.documentElement,{subtree:true,childList:true});window.addEventListener('resize',inject)}
window.RWATradeUIPolish={version:'1.0.0',runtime:'desktop-mobile-commerce-polish-v1',refresh:inject};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});else bind();
})();
