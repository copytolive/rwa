(()=>{
'use strict';
if(!window.RENKO_GOLD_ONLY||window.RWARenkoGoldHistoryGeometryStitch)return;
const MAX_RENDER_BRICKS=2500,PREFIX_BRICKS=600,VIEW_BUFFER=160;
const stats={wraps:0,stitches:0,misses:0,boxMismatches:0,last:null,maxRendered:0};
let wrapped=false,poll=0;
const T=()=>window.RWARenkoTV||null;
const H=()=>window.RWARenkoGoldTotalHistory||null;
const TS=()=>window.__RWARenkoChart?.timeScale?.()||null;
const num=v=>Number(v);
const finite=v=>Number.isFinite(num(v));
const canonicalTime=b=>num(b?._canonicalSourceTime??b?.sourceTime??0);
const tickKey=(v,tick)=>Math.round(num(v)/(tick>0?tick:1e-9));
function brickKey(b,tick){return `${canonicalTime(b)}|${tickKey(b?.open,tick)}|${tickKey(b?.close,tick)}|${num(b?.direction)||0}|${b?.isReversal?1:0}`}
function visibleOldIndex(oldData){const r=TS()?.getVisibleRange?.();if(!r||!oldData?.length)return 0;const from=num(r.from);let lo=0,hi=oldData.length;while(lo<hi){const m=(lo+hi)>>1;if(num(oldData[m]?.time)<from)lo=m+1;else hi=m}return Math.max(0,Math.min(oldData.length-1,lo))}
function decoratePrefix(rows,suffixStartTime){const out=rows.map(b=>({...b,_canonicalSourceTime:canonicalTime(b)}));let last=0;for(const b of out){let t=Math.max(1,Math.floor(canonicalTime(b)/1000));if(t<=last)t=last+1;last=t;b.sourceTime=t*1000}if(out.length&&finite(suffixStartTime)&&last>=suffixStartTime){const shift=last-suffixStartTime+1;for(const b of out)b.sourceTime=(Math.floor(num(b.sourceTime)/1000)-shift)*1000}return out}
function stitch(prepared,oldBricks,oldData,oldBase,tick){
  const wb=Array.isArray(prepared?.bricks)?prepared.bricks:[];if(!wb.length||!oldBricks.length||!oldData.length)return null;
  const oldBox=num(oldBase?.box),newBox=num(prepared?.box),tol=Math.max(1e-12,Math.abs(oldBox||newBox||1)*1e-10);if(finite(oldBox)&&finite(newBox)&&Math.abs(oldBox-newBox)>tol){stats.boxMismatches++;return null}
  const workerMap=new Map();for(let i=0;i<wb.length;i++)workerMap.set(brickKey(wb[i],tick),i);
  const visible=visibleOldIndex(oldData),limit=Math.min(oldBricks.length-1,Math.max(0,visible-VIEW_BUFFER));let oi=-1,wi=-1;
  for(let i=limit;i>=0;i--){const hit=workerMap.get(brickKey(oldBricks[i],tick));if(Number.isInteger(hit)){oi=i;wi=hit;break}}
  if(oi<0){for(let i=Math.min(visible,oldBricks.length-1);i>=0;i--){const hit=workerMap.get(brickKey(oldBricks[i],tick));if(Number.isInteger(hit)){oi=i;wi=hit;break}}}
  if(oi<0||wi<0)return null;
  const prefixRaw=wb.slice(Math.max(0,wi-PREFIX_BRICKS),wi),suffixData=oldData.slice(oi),suffix=oldBricks.slice(oi).map((b,j)=>({...b,_canonicalSourceTime:canonicalTime(b),sourceTime:num(suffixData[j]?.time)*1000||num(b.sourceTime)}));
  const suffixStart=finite(suffixData[0]?.time)?num(suffixData[0].time):null,prefix=decoratePrefix(prefixRaw,suffixStart);let bricks=[...prefix,...suffix];if(bricks.length>MAX_RENDER_BRICKS)bricks=bricks.slice(0,MAX_RENDER_BRICKS);
  const visibleKept=bricks.some(b=>finite(suffixStart)&&Math.floor(num(b.sourceTime)/1000)===suffixStart);if(!visibleKept)return null;
  const base={...prepared,box:finite(oldBox)?oldBox:prepared.box,atr:finite(oldBase?.atr)?num(oldBase.atr):prepared.atr,bricks};
  return{base,oi,wi,visible,prefix:prefix.length,suffix:suffix.length,rendered:bricks.length,workerBricks:wb.length,suffixStart};
}
function install(){
  const t=T();if(wrapped||!t?.rebuild||!t?.engine?.build)return false;const prior=t.rebuild.bind(t);
  t.rebuild=(opts={})=>{
    const h=H(),active=!!h?.busy&&t.state?.symbol==='XAUUSD'&&Array.isArray(t.state?.confirmed)&&t.state.confirmed.length&&Array.isArray(t.state?.confirmedData)&&t.state.confirmedData.length;if(!active)return prior(opts);
    const outerBuild=t.engine.build,oldBricks=t.state.confirmed.slice(),oldData=t.state.confirmedData.slice(),oldBase=t.state.base,tick=num(t.state.tickSize)||0.001;let prepared;try{prepared=outerBuild(t.state.closedBars,t.settings,t.state.tickSize)}catch(_){return prior({...opts,fit:false})}
    const result=stitch(prepared,oldBricks,oldData,oldBase,tick);if(!result){stats.misses++;stats.last={ok:false,oldBricks:oldBricks.length,workerBricks:prepared?.bricks?.length||0};return prior({...opts,fit:false})}
    stats.stitches++;stats.maxRendered=Math.max(stats.maxRendered,result.rendered);stats.last={ok:true,oi:result.oi,wi:result.wi,visible:result.visible,prefix:result.prefix,suffix:result.suffix,rendered:result.rendered,workerBricks:result.workerBricks,suffixStart:result.suffixStart};
    t.engine.build=()=>result.base;try{return prior({...opts,fit:false})}finally{t.engine.build=outerBuild}
  };
  wrapped=true;stats.wraps++;document.documentElement.dataset.renkoGoldGeometryStitch='true';return true;
}
poll=setInterval(()=>{if(install()){clearInterval(poll);poll=0}},25);setTimeout(()=>{if(poll)clearInterval(poll)},10000);for(const ev of ['renko:tv-ready','renko:chart-ready','renko:gold-recent'])window.addEventListener(ev,install);
window.RWARenkoGoldHistoryGeometryStitch={version:'1.1.0-bounded-2500',rule:'GOLD prepend adds bounded worker prefix while preserving already-visible Renko suffix geometry; rendered bricks stay capped while canonical source remains independently bounded',stats,install};
})();
