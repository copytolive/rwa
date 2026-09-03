/* Deep ATR lazy-start + warm-order guard.
 * Loaded immediately before the deep ATR cache and restored by
 * renko-tv-deep-lazy-guard-end.js immediately afterwards.
 *
 * Two invariants are enforced:
 * 1) the million-row cache must not start merely because the page booted;
 * 2) the cache's 120 ms live-close maintenance timer must not run until the
 *    initial historical worker warm is fully READY. Otherwise a newly closed
 *    1s bar can become state.from before older history is consumed, corrupting
 *    coverage chronology (fromTime > toTime) even though sourceCount is large.
 */
(()=>{
'use strict';
if(window.RWARenkoDeepLazyGuard)return;
const nativeSetInterval=window.setInterval.bind(window);
const nativeAddEventListener=window.addEventListener.bind(window);
const state={activated:false,blockedBootReady:0,gatedIntervals:0,maintenanceTicks:0,warmOrderHolds:0,restored:false};
let readyInterceptActive=true;
window.setInterval=function(fn,ms,...args){
  if(Number(ms)===120&&typeof fn==='function'){
    state.gatedIntervals++;
    return nativeSetInterval(()=>{
      if(!state.activated)return;
      if(document.documentElement.dataset.atrInstantReady!=='true'){
        state.warmOrderHolds++;
        return;
      }
      state.maintenanceTicks++;
      fn();
    },ms,...args);
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
  version:'1.1.0',
  rule:'deep-atr-lazy-start-plus-historical-warm-before-live-maintenance',
  state,
  activate(reason='explicit'){state.activated=true;state.reason=reason;document.documentElement.dataset.atrDeepActivated='true';return true},
  restore(){if(state.restored)return;window.setInterval=nativeSetInterval;window.addEventListener=nativeAddEventListener;readyInterceptActive=false;state.restored=true;document.documentElement.dataset.atrDeepLazy='true'}
};
})();