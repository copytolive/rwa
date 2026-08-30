/* Allocation-light production rebuild fast path.
 *
 * Keeps the exact fixed-1s source, raw Wilder ATR, Traditional 1x/2x rules,
 * directional Close-source wicks, and the complete source window. It removes
 * redundant filter/sort/ATR allocations from the hot method-apply path. The
 * original engine remains the fallback for unsorted/invalid rows and OHLC mode.
 */
(()=>{
'use strict';
const E=window.RWARenkoTVEngine;if(!E||E.__fullHistoryFastPath)return;
const originalBuild=E.build.bind(E),originalLatestAtr=E.latestAtr.bind(E);
const num=v=>Number(v),finite=v=>Number.isFinite(Number(v));
function latestAtrFast(bars,length=14){
  length=Math.max(1,Math.floor(Number(length)||14));
  const src=Array.isArray(bars)?bars:[];
  let prev=NaN,atr=NaN,seed=0,count=0;
  for(let i=0;i<src.length;i++){
    const b=src[i],h=Number(b?.high),l=Number(b?.low),c=Number(b?.close);
    if(!Number.isFinite(h)||!Number.isFinite(l)||!Number.isFinite(c))continue;
    const tr=Number.isFinite(prev)?Math.max(h-l,Math.abs(h-prev),Math.abs(l-prev)):h-l;
    prev=c;count++;
    if(count<=length){seed+=tr;if(count===length)atr=seed/length}
    else atr=((atr*(length-1))+tr)/length;
  }
  if(!count)return NaN;
  return count<length?seed/count:atr;
}
function sortedCloseRows(rows){
  if(!Array.isArray(rows)||!rows.length)return false;
  let prev=-Infinity;
  for(let i=0;i<rows.length;i++){
    const b=rows[i],c=Number(b?.close),t=Number(b?.openTime??b?.time??0);
    if(!Number.isFinite(c)||!Number.isFinite(t)||t<prev)return false;
    prev=t;
  }
  return true;
}
function emit(state,out,open,close,dir,box,tm,wicks,reversal){
  let high=Math.max(open,close),low=Math.min(open,close);
  if(wicks){if(dir>0&&Number.isFinite(state.pendingLow))low=Math.min(low,state.pendingLow);if(dir<0&&Number.isFinite(state.pendingHigh))high=Math.max(high,state.pendingHigh)}
  out.push({open,high,low,close,direction:dir,box,isReversal:!!reversal,sourceTime:tm,sourceKind:'confirmed'});
  state.lastClose=close;state.direction=dir;state.lastSourceTime=tm;state.pendingHigh=close;state.pendingLow=close;
}
function buildFast(bars,settings={},tickSize=0){
  const src=Array.isArray(bars)?bars:[];
  const source=String(settings.source||'close').toLowerCase()==='ohlc'?'ohlc':'close';
  if(source!=='close'||!sortedCloseRows(src))return originalBuild(bars,settings,tickSize);
  const tick=Number(tickSize)>0?Number(tickSize):0,method=String(settings.method||'atr').toLowerCase();
  const exact=Number(settings?._exactBox);
  const rawAtr=Number.isFinite(exact)&&exact>0?exact:latestAtrFast(src,settings.atrLength||14);
  let box;
  if(method==='traditional')box=E.traditionalBox(Number(settings.boxSize)||Number(settings.traditionalBox)||tick||1,tick);
  else if(method==='percentage'){
    let last=NaN;for(let i=src.length-1;i>=0;i--){const c=Number(src[i]?.close);if(Number.isFinite(c)){last=c;break}}
    box=E.percentageLtpStableRound(last*Math.max(.000001,Number(settings.percentage)||.01),tick);
  }else box=Number.isFinite(exact)&&exact>0?exact:(Number.isFinite(rawAtr)&&rawAtr>0?rawAtr:(tick>0?tick:Number.EPSILON));
  if(!src.length||!(box>0))return{bricks:[],box,atr:rawAtr,state:null,anchor:NaN,source};
  const first=Number(src[0].close),anchor=E.floorGrid(first,box,tickSize),state={lastClose:anchor,direction:0,pendingHigh:anchor,pendingLow:anchor,anchor,lastSourceTime:0},out=[],wicks=settings.wicks!==false;
  for(let i=0;i<src.length;i++){
    const b=src[i],p=Number(b.close),tm=Number(b.closeTime??b.time??b.openTime)||0;
    if(!Number.isFinite(p))continue;
    if(p>state.pendingHigh)state.pendingHigh=p;if(p<state.pendingLow)state.pendingLow=p;
    let guard=0;
    while(guard++<20000){
      const lc=state.lastClose,d=state.direction;
      if(d===0){if(p>=lc+box){emit(state,out,lc,lc+box,1,box,tm,wicks,false);continue}if(p<=lc-box){emit(state,out,lc,lc-box,-1,box,tm,wicks,false);continue}break}
      if(d>0){if(p>=lc+box){emit(state,out,lc,lc+box,1,box,tm,wicks,false);continue}if(p<=lc-2*box){emit(state,out,lc-box,lc-2*box,-1,box,tm,wicks,true);continue}break}
      if(p<=lc-box){emit(state,out,lc,lc-box,-1,box,tm,wicks,false);continue}if(p>=lc+2*box){emit(state,out,lc+box,lc+2*box,1,box,tm,wicks,true);continue}break;
    }
  }
  return{bricks:out,box,atr:rawAtr,state:{lastClose:state.lastClose,direction:state.direction,pendingHigh:state.pendingHigh,pendingLow:state.pendingLow,anchor:state.anchor,lastSourceTime:state.lastSourceTime},anchor,source};
}
E.latestAtr=latestAtrFast;E.build=buildFast;E.__fullHistoryFastPath=true;E.fastPathVersion='1.0.0-full-history-zero-allocation';
window.RWARenkoEngineFastPath={version:E.fastPathVersion,rule:'sorted-fixed1s-close-full-window-no-filter-sort-no-atr-array',originalBuild,originalLatestAtr,latestAtrFast,buildFast};
})();
