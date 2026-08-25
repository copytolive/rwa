/* RENKO V11 clean-room engine.
 * Behavioral targets are based on publicly documented TradingView Renko rules:
 * 1-box continuation, 2-box reversal, Close/OHLC sources, direction-specific wicks,
 * and fixed chart-wide ATR / Percentage box snapshots for each rebuild.
 */
(function(root){
'use strict';

const EPS=Number.EPSILON;
const num=v=>Number(v);

function decimalPlaces(x){
  const s=String(x);
  if(s.includes('e-'))return Math.min(12,Number(s.split('e-')[1])||0);
  const i=s.indexOf('.');
  return i<0?0:Math.min(12,s.length-i-1);
}
function roundToTick(value,tick){
  value=num(value);tick=num(tick);
  if(!(value>0))return EPS;
  if(!(tick>0))return value;
  const q=Math.max(1,Math.round(value/tick));
  const d=decimalPlaces(tick);
  return Number((q*tick).toFixed(d));
}
function floorToTick(value,tick){
  value=num(value);tick=num(tick);
  if(!(tick>0))return value;
  const d=decimalPlaces(tick);
  return Number((Math.floor((value+tick*1e-9)/tick)*tick).toFixed(d));
}
function floorToBox(price,box,tick){
  price=num(price);box=num(box);
  if(!(box>0))return price;
  const raw=Math.floor(price/box)*box;
  return floorToTick(raw,tick>0?tick:box/1e8);
}
function trueRanges(bars){
  const out=[];let prev=NaN;
  for(const b of bars||[]){
    const h=num(b?.[2]),l=num(b?.[3]),c=num(b?.[4]);
    if(![h,l,c].every(Number.isFinite))continue;
    const tr=Number.isFinite(prev)?Math.max(h-l,Math.abs(h-prev),Math.abs(l-prev)):h-l;
    out.push(Math.max(0,tr));prev=c;
  }
  return out;
}
function wilderAtrLatest(bars,len=14){
  len=Math.max(1,Math.floor(num(len)||14));
  const tr=trueRanges(bars);
  if(!tr.length)return NaN;
  if(tr.length<len)return tr.reduce((a,b)=>a+b,0)/tr.length;
  let atr=tr.slice(0,len).reduce((a,b)=>a+b,0)/len;
  for(let i=len;i<tr.length;i++)atr=((atr*(len-1))+tr[i])/len;
  return atr;
}
function latestClose(bars){
  for(let i=(bars?.length||0)-1;i>=0;i--){const c=num(bars[i]?.[4]);if(Number.isFinite(c))return c}
  return NaN;
}
function computeBox(opts,bars){
  const method=String(opts.method||'atr').toLowerCase();
  const tick=num(opts.tickSize)>0?num(opts.tickSize):EPS;
  const close=latestClose(bars);
  let atr=NaN,raw=NaN;
  if(method==='traditional')raw=num(opts.traditionalBox);
  else if(method==='percentage')raw=Math.abs(close)*Math.max(.000001,num(opts.percentage)||.01);
  else {atr=wilderAtrLatest(bars,opts.atrLength);raw=atr;}
  if(!(raw>0))raw=Math.max(tick,Math.abs(close||1)*.001);
  const box=roundToTick(raw,tick);
  return{box:Math.max(tick,box),atr:Number.isFinite(atr)?atr:null,rawBox:raw};
}
function cloneState(s){
  return{lastClose:num(s.lastClose),direction:num(s.direction)||0,pendingHigh:num(s.pendingHigh),pendingLow:num(s.pendingLow),anchor:num(s.anchor),lastSourceTime:num(s.lastSourceTime)||0};
}
function initState(anchor){return{lastClose:anchor,direction:0,pendingHigh:anchor,pendingLow:anchor,anchor,lastSourceTime:0};}
function resetPendingTo(state,price){state.pendingHigh=price;state.pendingLow=price;}
function touch(state,p){
  if(!Number.isFinite(state.pendingHigh))state.pendingHigh=p;
  if(!Number.isFinite(state.pendingLow))state.pendingLow=p;
  if(p>state.pendingHigh)state.pendingHigh=p;
  if(p<state.pendingLow)state.pendingLow=p;
}
function emitBrick(state,out,open,close,dir,time,box,wicks,isReversal,sourceIndex){
  let high=Math.max(open,close),low=Math.min(open,close);
  if(wicks){if(dir>0&&Number.isFinite(state.pendingLow))low=Math.min(low,state.pendingLow);if(dir<0&&Number.isFinite(state.pendingHigh))high=Math.max(high,state.pendingHigh);}
  out.push({time:num(time)||0,open,high,low,close,direction:dir,box,isReversal:!!isReversal,sourceIndex:Number.isFinite(sourceIndex)?sourceIndex:null});
  state.lastClose=close;state.direction=dir;state.lastSourceTime=num(time)||state.lastSourceTime;resetPendingTo(state,close);
}
function processPoint(state,p,time,out,box,wicks,sourceIndex){
  p=num(p);if(!Number.isFinite(p)||!(box>0))return;touch(state,p);let guard=0;
  while(guard++<20000){
    const lc=state.lastClose,dir=state.direction;
    if(dir===0){if(p>=lc+box){emitBrick(state,out,lc,lc+box,1,time,box,wicks,false,sourceIndex);continue;}if(p<=lc-box){emitBrick(state,out,lc,lc-box,-1,time,box,wicks,false,sourceIndex);continue;}break;}
    if(dir>0){if(p>=lc+box){emitBrick(state,out,lc,lc+box,1,time,box,wicks,false,sourceIndex);continue;}if(p<=lc-2*box){emitBrick(state,out,lc-box,lc-2*box,-1,time,box,wicks,true,sourceIndex);continue;}break;}
    if(p<=lc-box){emitBrick(state,out,lc,lc-box,-1,time,box,wicks,false,sourceIndex);continue;}
    if(p>=lc+2*box){emitBrick(state,out,lc+box,lc+2*box,1,time,box,wicks,true,sourceIndex);continue;}
    break;
  }
  touch(state,p);
}
function barPath(bar,source){
  const o=num(bar?.[1]),h=num(bar?.[2]),l=num(bar?.[3]),c=num(bar?.[4]);
  if(source!=='ohlc')return Number.isFinite(c)?[c]:[];
  if(![o,h,l,c].every(Number.isFinite))return Number.isFinite(c)?[c]:[];
  return c>=o?[o,l,h,c]:[o,h,l,c];
}
function firstPrice(bars,source){for(const b of bars||[]){const p=barPath(b,source)[0];if(Number.isFinite(p))return p}return NaN;}
function buildRenko(opts){
  const bars=Array.isArray(opts?.bars)?opts.bars:[];
  const source=String(opts?.source||'close').toLowerCase()==='ohlc'?'ohlc':'close';
  const wicks=opts?.wicks!==false;
  const tick=num(opts?.tickSize)>0?num(opts.tickSize):EPS;
  const bx=computeBox(opts||{},bars),box=bx.box,p0=firstPrice(bars,source);
  if(!Number.isFinite(p0)||!(box>0))return{bricks:[],box,atr:bx.atr,tailState:null};
  const anchor=floorToBox(p0,box,tick),state=initState(anchor),bricks=[];
  for(let i=0;i<bars.length;i++){const b=bars[i],t=num(b?.[0])||0,path=barPath(b,source);for(const p of path)processPoint(state,p,t,bricks,box,wicks,i);}
  return{bricks,box,atr:bx.atr,rawBox:bx.rawBox,anchor,tailState:cloneState(state)};
}
const API={buildRenko,wilderAtrLatest,roundToTick,floorToBox,processPoint,cloneState,initState};
root.RenkoV11Engine=API;
root.onmessage=function(e){
  const m=e.data||{};if(m.type!=='build')return;
  try{const r=buildRenko(m);root.postMessage({type:'built',id:m.id,generation:m.generation,method:m.method,source:m.source,barCount:Array.isArray(m.bars)?m.bars.length:0,bricks:r.bricks,box:r.box,atr:r.atr,rawBox:r.rawBox,anchor:r.anchor,tailState:r.tailState});}
  catch(err){root.postMessage({type:'error',id:m.id,generation:m.generation,message:String(err?.message||err)})}
};
})(typeof self!=='undefined'?self:globalThis);
