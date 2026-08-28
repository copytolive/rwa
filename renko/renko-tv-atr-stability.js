/* RENKO ATR chart stability lock.
 *
 * Problem: rebuilding the full Renko history on every fixed-1s close while ATR
 * box size is allowed to drift rewrites historical geometry. Visually this can
 * make the chart alternate between very different confirmed-brick counts and
 * appear to shake/pulse once per second.
 *
 * Rule: ATR is sampled when the symbol becomes ready or when the user applies a
 * new ATR length, then that positive box is held in settings._exactBox for all
 * subsequent 1s closes. A new symbol or a new explicit ATR Apply is the only
 * time a fresh local ATR snapshot is taken. XAUT keeps its existing deep-ATR
 * OKX matrix, which already uses _exactBox.
 */
(()=>{
'use strict';
if(window.RWARenkoATRStability)return;
const XAUT='XAUTUSDT';
const T=()=>window.RWARenkoTV||null;
const stats={locks:0,refreshes:0,skippedXaut:0,lastSymbol:'',lastLength:0,lastBox:NaN,lastAt:0};
function positive(v){v=Number(v);return Number.isFinite(v)&&v>0?v:NaN}
function lockCurrent(reason='runtime'){
  const t=T();if(!t||t.settings?.method!=='atr'||t.state?.symbol===XAUT){if(t?.state?.symbol===XAUT)stats.skippedXaut++;return false}
  const box=positive(t.state?.box),atr=positive(t.state?.atr),exact=positive(t.settings?._exactBox);
  const next=Number.isFinite(box)?box:atr;if(!Number.isFinite(next))return false;
  if(Number.isFinite(exact)&&Math.abs(exact-next)<=Math.max(1e-12,Math.abs(next)*1e-12))return true;
  t.settings._exactBox=next;t.state.atrRaw=next;t.state.atrHistorySatisfied=true;t.state.atrAppliedLength=Math.max(1,Math.floor(Number(t.settings.atrLength)||14));
  stats.locks++;stats.lastSymbol=t.state.symbol;stats.lastLength=t.state.atrAppliedLength;stats.lastBox=next;stats.lastAt=Date.now();
  document.documentElement.dataset.renkoAtrStableBox='true';document.documentElement.dataset.renkoAtrStableReason=String(reason);document.documentElement.dataset.renkoAtrStableBoxValue=String(next);return true;
}
function unlockForExplicitApply(){const t=T();if(!t||t.state?.symbol===XAUT)return false;delete t.settings._exactBox;stats.refreshes++;document.documentElement.dataset.renkoAtrStableBox='refreshing';return true}
window.addEventListener('renko:tv-ready',()=>queueMicrotask(()=>lockCurrent('tv-ready')));
window.addEventListener('renko:symbol-switch-end',e=>{if(e.detail?.ok!==false)queueMicrotask(()=>lockCurrent('symbol-ready'))});
window.addEventListener('renko:atr-control-before-apply',()=>unlockForExplicitApply());
window.addEventListener('renko:atr-control-applied',e=>{if(e.detail?.pass!==false)queueMicrotask(()=>lockCurrent('explicit-apply'))});
window.RWARenkoATRStability={version:'1.0.0',rule:'sample-atr-on-symbol-ready-or-explicit-apply-hold-box-between-fixed1s-closes',lockCurrent,unlockForExplicitApply,stats};
})();
