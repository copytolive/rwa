/* Completes the deep ATR lazy-start guard.
 * Loaded immediately after renko-tv-atr-1s-million-cache.js.
 */
(()=>{
'use strict';
const G=window.RWARenkoDeepLazyGuard,A=window.RWARenkoATRInstant;
if(!G||!A)return;
G.restore();
const activate=reason=>G.activate(reason);

// Explicit API calls from regression gates or diagnostics are valid activation.
for(const name of ['warm','applyPrepared','stageInstant']){
  const original=A[name];
  if(typeof original!=='function')continue;
  A[name]=function(...args){activate(`api:${name}`);return original.apply(this,args)};
}

// User intent activates maintenance before the next 120 ms tick. The deep
// cache's own listeners may run first on the same event; that is fine because
// this guard only controls ongoing maintenance, not the explicit warm itself.
const input=document.getElementById('atrLength');
input?.addEventListener('focus',()=>activate('user:focus'),{passive:true});
input?.addEventListener('change',()=>activate('user:change'),{passive:true});
input?.addEventListener('keydown',e=>{if(e.key==='Enter')activate('user:enter')},{passive:true});
document.addEventListener('click',e=>{if(e.target?.closest?.('[data-apply-method="atr"]'))activate('user:apply')},true);
document.querySelector('.method[data-method="atr"]')?.addEventListener('pointerenter',()=>activate('user:hover'),{passive:true});

document.documentElement.dataset.atrDeepLazy='true';
window.RWARenkoDeepLazyGuardEnd={version:'1.0.0',rule:'restore-globals-and-activate-deep-atr-only-from-user-or-explicit-api'};
})();