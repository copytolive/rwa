(()=>{
'use strict';
if(!window.RENKO_GOLD_ONLY||window.RWARenkoGoldDisplayGuard)return;
const root=document.documentElement,$=id=>document.getElementById(id),stats={syncs:0,emptyStates:0,visibleStates:0,startupRecoveries:0,lastConfirmed:0,lastReason:''};
let startupRecoveryDone=false;
function methodLabel(T){if(T?.settings?.method==='traditional')return `Traditional ${Number(T.settings.boxSize)||1}`;if(T?.settings?.method==='atr')return `ATR ${Math.max(1,Math.floor(Number(T.settings.atrLength)||14))}`;return'Renko'}
function setEmptyContent(T){const empty=$('chartEmpty');if(!empty)return;let b=empty.querySelector('b'),s=empty.querySelector('small');if(!b){b=document.createElement('b');empty.appendChild(b)}if(!s){s=document.createElement('small');empty.appendChild(s)}b.textContent='No Renko bricks at this setting';s.textContent=`${methodLabel(T)} produced no confirmed brick in the loaded GOLD window. Use ATR 14 or Traditional 1, or move to a wider history window.`}
function sync(reason='sync'){const T=window.RWARenkoTV,empty=$('chartEmpty');if(!T?.state||!empty)return false;const n=Number(T.state.confirmedData?.length||T.state.confirmed?.length||0);stats.syncs++;stats.lastConfirmed=n;stats.lastReason=String(reason);root.dataset.renkoGoldConfirmedVisible=String(n);if(n>0){empty.classList.add('hide');empty.setAttribute('aria-hidden','true');stats.visibleStates++;root.dataset.renkoGoldChartVisible='true';try{window.__RWARenkoChart?.priceScale?.('right')?.applyOptions?.({autoScale:true})}catch(_){ }return true}setEmptyContent(T);empty.classList.remove('hide');empty.setAttribute('aria-hidden','false');stats.emptyStates++;root.dataset.renkoGoldChartVisible='false';return false}
async function recoverStartup(reason='startup'){if(startupRecoveryDone)return false;const T=window.RWARenkoTV;if(!T?.state)return false;const n=Number(T.state.confirmedData?.length||T.state.confirmed?.length||0);if(n>0){startupRecoveryDone=true;return true}if(sessionStorage.getItem('rwa_renko_gold_manual_setting_v1')==='1'){startupRecoveryDone=true;return false}startupRecoveryDone=true;try{if(window.RWARenkoATRControl?.applyLocal){const ok=await window.RWARenkoATRControl.applyLocal(14,`gold-display-${reason}`);if(ok){stats.startupRecoveries++;requestAnimationFrame(()=>sync('startup-atr14'));return true}}}catch(_){ }return false}
function markManual(e){if(e.target?.closest?.('[data-apply-method]'))sessionStorage.setItem('rwa_renko_gold_manual_setting_v1','1')}
document.addEventListener('click',markManual,true);for(const ev of ['renko:gold-recent','renko:gold-total','renko:gold-origin','renko:atr-control-applied','renko:traditional-applied'])window.addEventListener(ev,()=>setTimeout(()=>{if(!sync(ev)&&ev==='renko:gold-recent')void recoverStartup(ev)},60));window.addEventListener('renko:tv-ready',()=>setTimeout(()=>sync('tv-ready'),80));window.addEventListener('load',()=>setTimeout(()=>{if(!sync('load'))void recoverStartup('load')},500),{once:true});
window.RWARenkoGoldDisplayGuard={version:'1.0.1',rule:'visible-chart-or-explicit-zero-brick-state-plus-one-time-stale-startup-recovery',stats,sync,recoverStartup};
})();

(()=>{
'use strict';
if(!window.RENKO_GOLD_ONLY||window.RWARenkoGoldGeometrySplice)return;
const T=window.RWARenkoTV,H=window.RWARenkoGoldTotalHistory;if(!T?.rebuild||!H)return;
const root=document.documentElement,stats={rebuilds:0,matches:0,misses:0,virtualized:0,maxRenderedBricks:0,lastMatchRun:0,lastPrefix:0,lastSuffix:0,lastRendered:0};
const MATCH_RUN=12,RENDER_CAP=12000,LEFT_CONTEXT=1200,EPS=1e-9;
let last=null;
const finite=v=>Number.isFinite(Number(v));
const ts=()=>window.__RWARenkoChart?.timeScale?.()||null;
const timeRange=()=>{try{const r=ts()?.getVisibleRange?.();return r&&finite(r.from)&&finite(r.to)?{from:Number(r.from),to:Number(r.to)}:null}catch(_){return null}};
function same(a,b){if(!a||!b||Number(a.sourceTime)!==Number(b.sourceTime)||Number(a.direction)!==Number(b.direction)||!!a.isReversal!==!!b.isReversal)return false;for(const k of ['open','high','low','close','box'])if(Math.abs(Number(a[k])-Number(b[k]))>EPS)return false;return true}
function key(b){const q=v=>Math.round(Number(v)*1e9);return `${Number(b?.sourceTime)||0}|${Number(b?.direction)||0}|${b?.isReversal?1:0}|${q(b?.open)}|${q(b?.close)}`}
function findMatch(fresh,old,oldEnd){
  if(fresh.length<MATCH_RUN||oldEnd<MATCH_RUN)return null;const map=new Map(),maxOld=oldEnd-MATCH_RUN;
  for(let i=0;i<=maxOld;i++){const k=key(old[i]);let a=map.get(k);if(!a)map.set(k,a=[i]);else if(a.length<4)a.push(i)}
  const firstOldTime=Number(old[0]?.sourceTime)||0;
  for(let ni=0;ni<=fresh.length-MATCH_RUN;ni++){
    if(Number(fresh[ni]?.sourceTime)<firstOldTime)continue;const candidates=map.get(key(fresh[ni]));if(!candidates)continue;
    for(const oi of candidates){let ok=true;for(let k=0;k<MATCH_RUN;k++){if(!same(fresh[ni+k],old[oi+k])){ok=false;break}}if(ok)return{ni,oi,run:MATCH_RUN}}
  }
  return null;
}
function lowerSource(bricks,ms){let lo=0,hi=bricks.length;while(lo<hi){const mid=(lo+hi)>>>1;if(Number(bricks[mid]?.sourceTime)<ms)lo=mid+1;else hi=mid}return lo}
function virtualize(bricks,view){
  if(bricks.length<=RENDER_CAP)return{bricks,start:0,end:bricks.length,virtualized:false};let idx=0;
  if(view){const anchor=((Number(view.from)+Number(view.to))/2)*1000;idx=lowerSource(bricks,anchor)}
  let start=Math.max(0,idx-LEFT_CONTEXT),end=Math.min(bricks.length,start+RENDER_CAP);if(end-start<RENDER_CAP)start=Math.max(0,end-RENDER_CAP);
  while(start>0&&Number(bricks[start-1]?.sourceTime)===Number(bricks[start]?.sourceTime))start--;
  if(end-start>RENDER_CAP+256)end=start+RENDER_CAP+256;
  return{bricks:bricks.slice(start,end),start,end,virtualized:true};
}
function spliceBase(base,oldConfirmed,newestMs,view){
  const fresh=Array.isArray(base?.bricks)?base.bricks:[],old=Array.isArray(oldConfirmed)?oldConfirmed:[];let oldEnd=old.length;
  while(oldEnd>0&&Number(old[oldEnd-1]?.sourceTime)>Number(newestMs))oldEnd--;
  const boxSame=!old.length||!finite(old[0]?.box)||!finite(base?.box)||Math.abs(Number(old[0].box)-Number(base.box))<=EPS;
  const match=boxSame?findMatch(fresh,old,oldEnd):null;let joined=fresh,prefix=fresh.length,suffix=0;
  if(match){joined=fresh.slice(0,match.ni).concat(old.slice(match.oi,oldEnd));prefix=match.ni;suffix=oldEnd-match.oi;stats.matches++;stats.lastMatchRun=match.run}else stats.misses++;
  const v=virtualize(joined,view);if(v.virtualized)stats.virtualized++;stats.maxRenderedBricks=Math.max(stats.maxRenderedBricks,v.bricks.length);stats.lastPrefix=prefix;stats.lastSuffix=suffix;stats.lastRendered=v.bricks.length;
  last={matched:!!match,matchRun:match?.run||0,prefix,suffix,fresh:fresh.length,joined:joined.length,rendered:v.bricks.length,virtualized:v.virtualized,windowStart:v.start,windowEnd:v.end,view:view?{...view}:null,newestMs:Number(newestMs)||0};
  Object.assign(root.dataset,{renkoGoldGeometryMatched:match?'true':'false',renkoGoldGeometryMatchRun:String(match?.run||0),renkoGoldGeometryRendered:String(v.bricks.length),renkoGoldGeometryVirtualized:v.virtualized?'true':'false'});
  return{...base,bricks:v.bricks};
}
const priorRebuild=T.rebuild.bind(T);
T.rebuild=(opts={})=>{
  if(!H.busy)return priorRebuild(opts);stats.rebuilds++;const E=T.engine||window.RWARenkoTVEngine;if(!E?.build)return priorRebuild(opts);
  const oldConfirmed=Array.isArray(T.state?.confirmed)?T.state.confirmed.slice():[],newestMs=Number(T.state?.closedBars?.at(-1)?.closeTime)||0,view=timeRange(),priorBuild=E.build;
  E.build=(...args)=>spliceBase(priorBuild(...args),oldConfirmed,newestMs,view);
  try{return priorRebuild(opts)}finally{E.build=priorBuild}
};
window.RWARenkoGoldGeometrySplice={version:'1.0.0-stable-overlap-virtual-window',rule:'prepend rebuild may replace only genuinely new prefix; exact converged old suffix remains immutable and render set is bounded around operator viewport',stats,get last(){return last?{...last,view:last.view?{...last.view}:null}:null},spliceBase};
})();

(()=>{
'use strict';
if(!window.RENKO_GOLD_ONLY||window.RWARenkoGoldViewportAuthority)return;
const M=window.RWARenkoGoldManualViewport;if(!M?.endHistoryMutation)return;
const root=document.documentElement,stats={holds:0,clears:0,rangeEvents:0,repairs:0,repairChecks:0,scaleWrites:0,scrollWrites:0,timeWrites:0,lastReason:'',lastHold:null};
let hold=null,queued=false,applying=false,bound=false;
const ts=()=>window.__RWARenkoChart?.timeScale?.()||null,finite=v=>Number.isFinite(Number(v)),timeRange=r=>r&&finite(r.from)&&finite(r.to)?{from:Number(r.from),to:Number(r.to)}:null;
const nextFrame=()=>new Promise(resolve=>requestAnimationFrame(()=>resolve()));
function options(t=ts()){try{const o=t?.options?.()||{};return{barSpacing:finite(o.barSpacing)?Number(o.barSpacing):null,rightOffset:finite(o.rightOffset)?Number(o.rightOffset):null}}catch(_){return{barSpacing:null,rightOffset:null}}}
function scroll(t=ts()){try{const v=t?.scrollPosition?.();return finite(v)?Number(v):null}catch(_){return null}}
function followingOff(){const T=window.RWARenkoTV;if(T?.state)T.state.following=false}
function clear(reason='user'){if(hold)stats.clears++;hold=null;stats.lastReason=reason;root.dataset.renkoGoldViewportAuthorityHold='false'}
function actual(){const t=ts(),o=options(t);return{time:timeRange(t?.getVisibleRange?.()),logical:t?.getVisibleLogicalRange?.()||null,barSpacing:o.barSpacing,rightOffset:o.rightOffset,scrollPosition:scroll(t)}}
function refreshResult(result){const a=actual(),wanted=timeRange(result?.targetTime||result?.beforeTime),beforeSpan=wanted?Number(wanted.to)-Number(wanted.from):null,afterSpan=a.time?Number(a.time.to)-Number(a.time.from):null,anchorBefore=wanted?(Number(wanted.from)+Number(wanted.to))/2:null,anchorAfter=a.time?(Number(a.time.from)+Number(a.time.to))/2:null;return Object.assign(result,{afterTime:a.time,afterLogical:a.logical,barSpacingAfter:a.barSpacing,rightOffsetAfter:a.rightOffset,scrollPositionAfter:a.scrollPosition,timeSpanAfter:afterSpan,timeSpanDeltaPct:finite(beforeSpan)&&beforeSpan!==0&&finite(afterSpan)?Math.abs(afterSpan-beforeSpan)/Math.abs(beforeSpan)*100:null,fromDelta:wanted&&a.time?Math.abs(Number(a.time.from)-Number(wanted.from)):null,toDelta:wanted&&a.time?Math.abs(Number(a.time.to)-Number(wanted.to)):null,anchorTimeBefore:anchorBefore,anchorTimeAfter:anchorAfter,anchorDelta:finite(anchorBefore)&&finite(anchorAfter)?Math.abs(anchorAfter-anchorBefore):null,barSpacingDelta:finite(result?.barSpacingBefore)&&finite(a.barSpacing)?Math.abs(a.barSpacing-Number(result.barSpacingBefore)):null,rightOffsetDelta:finite(result?.rightOffsetBefore)&&finite(a.rightOffset)?Math.abs(a.rightOffset-Number(result.rightOffsetBefore)):null})}
function drift(){if(!hold)return false;const a=actual(),w=hold.time,beforeSpan=w?Number(w.to)-Number(w.from):null,afterSpan=a.time?Number(a.time.to)-Number(a.time.from):null;return !a.time||(w&&(Math.abs(a.time.from-w.from)>1||Math.abs(a.time.to-w.to)>1||Math.abs(afterSpan-beforeSpan)>Math.max(1e-9,Math.abs(beforeSpan)*0.0001)))||(finite(hold.barSpacing)&&finite(a.barSpacing)&&Math.abs(a.barSpacing-hold.barSpacing)>1e-9)||(finite(hold.rightOffset)&&finite(a.rightOffset)&&Math.abs(a.rightOffset-hold.rightOffset)>1e-9)||(finite(hold.scrollPosition)&&finite(a.scrollPosition)&&Math.abs(a.scrollPosition-hold.scrollPosition)>1e-6)}
function apply(reason='range-drift'){
  if(!hold||applying||M.inHistoryMutation)return false;const t=ts();if(!t)return false;applying=true;
  try{const a=actual();if(!finite(hold.scrollPosition)&&hold.time&&(a.time&&(Math.abs(a.time.from-hold.time.from)>1||Math.abs(a.time.to-hold.time.to)>1))){t.setVisibleRange(hold.time);stats.timeWrites++}const now=options(t),fix={};if(finite(hold.barSpacing)&&(!finite(now.barSpacing)||Math.abs(now.barSpacing-hold.barSpacing)>1e-9))fix.barSpacing=hold.barSpacing;if(finite(hold.rightOffset)&&(!finite(now.rightOffset)||Math.abs(now.rightOffset-hold.rightOffset)>1e-9))fix.rightOffset=hold.rightOffset;if(Object.keys(fix).length){t.applyOptions?.(fix);stats.scaleWrites++}if(finite(hold.scrollPosition)&&typeof t.scrollToPosition==='function'){t.scrollToPosition(hold.scrollPosition,false);stats.scrollWrites++}followingOff();stats.repairs++;stats.lastReason=reason;root.dataset.renkoGoldViewportAuthorityRepairs=String(stats.repairs);return true}catch(_){return false}finally{applying=false}}
function check(reason='range-event'){queued=false;if(!hold||M.inHistoryMutation)return;stats.repairChecks++;if(drift())apply(reason);else followingOff()}
function schedule(reason='range-event'){if(!hold||queued||applying)return;queued=true;requestAnimationFrame(()=>check(reason))}
function arm(result,useScroll){const t=timeRange(result?.targetTime||result?.beforeTime);hold={id:result?.id??null,time:t,barSpacing:finite(result?.barSpacingBefore)?Number(result.barSpacingBefore):null,rightOffset:finite(result?.rightOffsetBefore)?Number(result.rightOffsetBefore):null,scrollPosition:useScroll&&finite(result?.scrollPositionBefore)?Number(result.scrollPositionBefore):null};stats.holds++;stats.lastHold={...hold,time:t?{...t}:null};stats.lastReason='history-end';root.dataset.renkoGoldViewportAuthorityHold='true';root.dataset.renkoGoldViewportAuthorityId=String(hold.id??'');followingOff();schedule('history-end')}
const originalEnd=M.endHistoryMutation.bind(M);
M.endHistoryMutation=async(token,opts={})=>{let result=await originalEnd(token,opts);if(opts?.panOlder){clear('explicit-pan');return result}const stable=!!window.RWARenkoGoldGeometrySplice?.last?.matched,t=ts();if(t&&!stable){const fix={};if(finite(result?.barSpacingBefore))fix.barSpacing=Number(result.barSpacingBefore);if(finite(result?.rightOffsetBefore))fix.rightOffset=Number(result.rightOffsetBefore);if(Object.keys(fix).length){t.applyOptions?.(fix);stats.scaleWrites++}if(finite(result?.scrollPositionBefore)&&typeof t.scrollToPosition==='function'){t.scrollToPosition(Number(result.scrollPositionBefore),false);stats.scrollWrites++}}followingOff();await nextFrame();await nextFrame();result=refreshResult(result);arm(result,!stable);return result};
function bind(){if(bound)return true;const t=ts();if(!t?.subscribeVisibleLogicalRangeChange)return false;bound=true;t.subscribeVisibleLogicalRangeChange(()=>{stats.rangeEvents++;if(hold&&!M.inHistoryMutation&&!applying)schedule('programmatic-range')});root.dataset.renkoGoldViewportAuthorityBound='true';return true}
const userStart=e=>{if(e.target?.closest?.('#chartWrap,#chartHost'))clear(e.type)};document.addEventListener('wheel',userStart,{capture:true,passive:true});document.addEventListener('pointerdown',userStart,{capture:true,passive:true});document.addEventListener('touchstart',userStart,{capture:true,passive:true});document.addEventListener('click',e=>{const id=e.target?.closest?.('button')?.id||'';if(id&&(['tvLive','tvReset','tvZoomIn','tvZoomOut','tvPanOlder','tvPanNewer','tvGoldOlder','tvGoldNewer','tvGoldOrigin','tvGoldMaxZoom'].includes(id)||e.target?.closest?.('[data-apply-method]')))clear(id||'method')},true);
for(const ev of ['renko:chart-ready','renko:tv-ready'])window.addEventListener(ev,bind);const poll=setInterval(()=>{if(bind())clearInterval(poll)},50);setTimeout(()=>clearInterval(poll),5000);
window.RWARenkoGoldViewportAuthority={version:'1.3.0-geometry-aware-authority',rule:'stable-spliced geometry owns timestamp viewport; fallback rebuilds preserve scale plus relative scroll position',stats,get hold(){return hold?{...hold,time:hold.time?{...hold.time}:null}:null},clear,check,apply,bind};
})();