/* Deep ATR lazy-start guard.
 * Loaded immediately before renko-tv-atr-1s-million-cache.js and restored by
 * renko-tv-deep-lazy-guard-end.js immediately afterwards.
 *
 * The million-row cache must not start merely because the page booted. It is
 * activated by an explicit ATR interaction or an explicit RWARenkoATRInstant
 * warm() call (including the production ATR browser gate). Once activated, the
 * deep cache's 120 ms live-close maintenance timer runs normally.
 */
(()=>{
'use strict';
if(window.RWARenkoDeepLazyGuard)return;
const nativeSetInterval=window.setInterval.bind(window);
const nativeAddEventListener=window.addEventListener.bind(window);
const state={activated:false,blockedBootReady:0,gatedIntervals:0,maintenanceTicks:0,restored:false};
let readyInterceptActive=true;
window.setInterval=function(fn,ms,...args){
  if(Number(ms)===120&&typeof fn==='function'){
    state.gatedIntervals++;
    return nativeSetInterval(()=>{if(!state.activated)return;state.maintenanceTicks++;fn()},ms,...args);
  }
  return nativeSetInterval(fn,ms,...args);
};
window.addEventListener=function(type,listener,options){
  if(readyInterceptActive&&type==='renko:tv-ready'){
    state.blockedBootReady++;
    return;
  }
  return nativeAddEventListener(type,listener,options);
};
window.RWARenkoDeepLazyGuard={
  version:'1.0.0',
  rule:'deep-atr-lazy-start-explicit-user-or-gate-then-live-maintenance',
  state,
  activate(reason='explicit'){state.activated=true;state.reason=reason;document.documentElement.dataset.atrDeepActivated='true';return true},
  restore(){if(state.restored)return;window.setInterval=nativeSetInterval;window.addEventListener=nativeAddEventListener;readyInterceptActive=false;state.restored=true;document.documentElement.dataset.atrDeepLazy='true'}
};
})();