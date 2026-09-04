(()=>{
'use strict';
if(window.RWAReferenceParityFix)return;
const $=s=>document.querySelector(s),qa=s=>[...document.querySelectorAll(s)];
function ensureBridge(){const nav=$('.rwa-v5-mobile-worktabs');if(!nav)return;let b=nav.querySelector('[data-ref-market-bridge]');if(!b){b=document.createElement('button');b.type='button';b.dataset.refMarketBridge='1';b.dataset.v5Action='open-markets';b.className='rwa-ref-market-bridge';b.tabIndex=-1;b.setAttribute('aria-hidden','true');nav.appendChild(b)}}
function syncMode(){const active=$('#rwaTargetOrderTicket [data-live-mode].active')?.dataset.liveMode;if(!active)return;const ref=$('#rwaRefTradeTicket [data-ref-mode="'+active+'"]');if(ref&&!ref.classList.contains('active'))ref.click()}
function syncSide(){const active=$('#rwaTargetOrderTicket')?.dataset.v5Side;if(!active)return;const ref=$('#rwaRefTradeTicket [data-ref-side="'+active+'"]');if(ref&&!ref.classList.contains('active'))ref.click()}
function patchQuick(){const q=$('#rwaV5MobileQuickTrade');if(!q)return;const meta=q.querySelector('.rwa-v5-mobile-quick-meta');if(meta&&!meta.querySelector('b')){const v=meta.querySelector('[data-v5-quick-availability]')?.textContent||'Connect wallet';meta.innerHTML='<span>Available</span><b data-v5-quick-availability>'+v+'</b>'}}
function apply(){ensureBridge();syncMode();syncSide();patchQuick();document.documentElement.dataset.rwaReferenceFix='1'}
document.addEventListener('click',e=>{if(e.target.closest('.bookrow,[data-live-mode],[data-v5-side]'))setTimeout(()=>{syncMode();syncSide()},0)},true);
setInterval(()=>{if(!document.hidden)apply()},500);apply();
window.RWAReferenceParityFix={version:'2.0.1',active:true,apply,audit:()=>({upperVisible:qa('.rwa-v5-mobile-worktabs [data-v5-mobile-mode]').map(x=>x.textContent.trim()),bridge:!!$('[data-ref-market-bridge]'),tradeFacadeVisible:!!$('#rwaRefTradeTicket')})};
})();