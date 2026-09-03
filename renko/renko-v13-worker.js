/* RENKO V13 lossless tick-native engine.
 * Every supplied trade is processed in sequence.
 * Continuation = 1 current box. Reversal = 2 current boxes.
 * Traditional = fixed box.
 * ATR = completed-bar Wilder ATR snapshot × ATR factor.
 * Percentage = confirmed Renko level × percentage, recalculated after each confirmed brick.
 */
(function(root){
'use strict';
const EPS=Number.EPSILON;
const num=v=>Number(v);
function decimals(x){const s=String(x);if(s.includes('e-'))return Math.min(12,Number(s.split('e-')[1])||0);const i=s.indexOf('.');return i<0?0:Math.min(12,s.length-i-1)}
function roundTick(v,t){v=num(v);t=num(t);if(!(v>0))return EPS;if(!(t>0))return v;const q=Math.max(1,Math.round(v/t)),d=decimals(t);return Number((q*t).toFixed(d))}
function floorBox(p,b,t){p=num(p);b=num(b);if(!(b>0))return p;const step=t>0?t:Math.max(EPS,b/1e8),d=decimals(step),raw=Math.floor(p/b)*b;return Number((Math.floor((raw+step*1e-9)/step)*step).toFixed(d))}
function init(anchor){return{lastClose:anchor,direction:0,pendingHigh:anchor,pendingLow:anchor,anchor,lastTime:0}}
function clone(s){return s?{lastClose:num(s.lastClose),direction:num(s.direction)||0,pendingHigh:num(s.pendingHigh),pendingLow:num(s.pendingLow),anchor:num(s.anchor),lastTime:num(s.lastTime)||0}:null}
function touch(s,p){if(!Number.isFinite(s.pendingHigh))s.pendingHigh=p;if(!Number.isFinite(s.pendingLow))s.pendingLow=p;if(p>s.pendingHigh)s.pendingHigh=p;if(p<s.pendingLow)s.pendingLow=p}
function resetPending(s,p){s.pendingHigh=p;s.pendingLow=p}
function rawBox(o,state,price){
  const method=String(o.method||'traditional').toLowerCase();
  if(method==='traditional')return num(o.traditionalBox);
  if(method==='atr')return num(o.atrValue)*Math.max(.000001,num(o.atrFactor)||1);
  if(method==='percentage'){
    const base=Number.isFinite(num(state?.lastClose))&&Math.abs(num(state.lastClose))>0?Math.abs(num(state.lastClose)):Math.abs(num(price));
    return base*Math.max(.000001,num(o.percentage)||.001);
  }
  return num(o.traditionalBox);
}
function currentBox(o,state,price){const tick=num(o.tickSize)>0?num(o.tickSize):EPS,raw=rawBox(o,state,price);const fallback=Math.max(tick,Math.abs(num(price)||1)*.001);return roundTick(raw>0?raw:fallback,tick)}
function emit(s,out,open,close,dir,t,box,wicks,rev,sourceId){
  let high=Math.max(open,close),low=Math.min(open,close);
  if(wicks){if(dir>0&&Number.isFinite(s.pendingLow))low=Math.min(low,s.pendingLow);if(dir<0&&Number.isFinite(s.pendingHigh))high=Math.max(high,s.pendingHigh)}
  out.push({time:num(t)||0,open,high,low,close,direction:dir,box,isReversal:!!rev,sourceId:sourceId??null});
  s.lastClose=close;s.direction=dir;s.lastTime=num(t)||s.lastTime;resetPending(s,close)
}
function processTick(s,tick,out,o){
  const p=num(tick?.price),tm=num(tick?.time)||0;if(!Number.isFinite(p))return 0;
  touch(s,p);const before=out.length;let guard=0;
  while(guard++<20000){
    const box=currentBox(o,s,p),lc=s.lastClose,d=s.direction;if(!(box>0)||!Number.isFinite(lc))break;
    if(d===0){if(p>=lc+box){emit(s,out,lc,lc+box,1,tm,box,o.wicks!==false,false,tick?.id);continue}if(p<=lc-box){emit(s,out,lc,lc-box,-1,tm,box,o.wicks!==false,false,tick?.id);continue}break}
    if(d>0){if(p>=lc+box){emit(s,out,lc,lc+box,1,tm,box,o.wicks!==false,false,tick?.id);continue}if(p<=lc-2*box){emit(s,out,lc-box,lc-2*box,-1,tm,box,o.wicks!==false,true,tick?.id);continue}break}
    if(p<=lc-box){emit(s,out,lc,lc-box,-1,tm,box,o.wicks!==false,false,tick?.id);continue}
    if(p>=lc+2*box){emit(s,out,lc+box,lc+2*box,1,tm,box,o.wicks!==false,true,tick?.id);continue}
    break
  }
  touch(s,p);return out.length-before
}
function buildTicks(o){
  const ticks=(Array.isArray(o?.ticks)?o.ticks:[]).filter(x=>Number.isFinite(num(x?.price))).sort((a,b)=>(num(a.time)-num(b.time))||((num(a.id)||0)-(num(b.id)||0)));
  const p0=num(ticks[0]?.price),tickSize=num(o?.tickSize)>0?num(o.tickSize):EPS;
  if(!Number.isFinite(p0)){const box=currentBox(o||{},null,num(o?.ltpSnapshot)||1);return{bricks:[],box,tailState:null,anchor:null}}
  const firstBox=currentBox(o||{},null,p0),anchor=floorBox(p0,firstBox,tickSize),state=init(anchor),bricks=[];
  for(const t of ticks)processTick(state,t,bricks,o||{});
  const lastPrice=num(ticks.at(-1)?.price),box=currentBox(o||{},state,lastPrice);
  return{bricks,box,tailState:clone(state),anchor}
}
const API={buildTicks,processTick,currentBox,roundTick,floorBox,initState:init,cloneState:clone};
root.RenkoV13Engine=API;
root.onmessage=e=>{const m=e.data||{};if(m.type!=='build')return;try{const r=buildTicks(m);root.postMessage({type:'built',id:m.id,generation:m.generation,bricks:r.bricks,box:r.box,tailState:r.tailState,anchor:r.anchor,tickCount:Array.isArray(m.ticks)?m.ticks.length:0})}catch(err){root.postMessage({type:'error',id:m.id,generation:m.generation,message:String(err?.message||err)})}};
})(typeof self!=='undefined'?self:globalThis);
