/* RENKO stable-chart layer for fixed 1s CLOSE production.
 *
 * Goal: the source may close every second, but the visible Renko chart must not
 * "heartbeat" when Renko geometry did not change. We therefore:
 * 1) suppress redundant open-1s kline events when their projected Renko bricks
 *    are identical to the projection already on screen;
 * 2) deduplicate Lightweight Charts setData / visible-range writes;
 * 3) keep the chart price line tied to the last Renko brick, while REAL LAST
 *    continues to update in the stat area without forcing a chart repaint;
 * 4) distinguish app-authored range changes from actual user panning so a
 *    latest-view/zoom write cannot accidentally trigger repeated old-history
 *    paging and heavy main-thread Renko rebuilds.
 *
 * Closed 1s source bars are never dropped. A genuine confirmed/projection brick
 * change is still rendered immediately.
 */
(()=>{
'use strict';
if(window.RWARenkoStableChart)return;
const VERSION='1.0.0';
const stats={partialEvents:0,partialForwarded:0,partialSuppressed:0,closedForwarded:0,dataWrites:0,dataWritesSkipped:0,rangeWrites:0,rangeWritesSkipped:0,programmaticRangeCallbacksSuppressed:0,priceWrites:0,priceWritesSkipped:0,lastSuppressedAt:0,lastGeometryWriteAt:0};
const fmt=n=>{n=Number(n);if(!Number.isFinite(n))return'—';const a=Math.abs(n),d=a>=1000?2:a>=100?3:a>=1?4:a>=.01?6:8;try{return n.toLocaleString(undefined,{maximumFractionDigits:d})}catch{return String(n)}};
const num=v=>Number(v);
function brickSig(bricks){const a=Array.isArray(bricks)?bricks:[],n=a.length;if(!n)return'0';const picks=[0,Math.floor((n-1)/4),Math.floor((n-1)/2),Math.floor((n-1)*3/4),n-1];return `${n}|${picks.map(i=>{const b=a[i]||{};return [num(b.sourceTime)||0,num(b.open)||0,num(b.high)||0,num(b.low)||0,num(b.close)||0,num(b.direction)||0].join(',')}).join('|')}`}
function dataSig(data){const a=Array.isArray(data)?data:[],n=a.length;if(!n)return'0';const picks=[0,Math.floor((n-1)/4),Math.floor((n-1)/2),Math.floor((n-1)*3/4),n-1];return `${n}|${picks.map(i=>{const b=a[i]||{};return [num(b.time)||0,num(b.open)||0,num(b.high)||0,num(b.low)||0,num(b.close)||0].join(',')}).join('|')}`}
function rangeSig(r){if(!r)return'';return `${Number(r.from).toFixed(5)}|${Number(r.to).toFixed(5)}`}
function updateRealLast(price){const T=window.RWARenkoTV;if(T){T.state.lastPrice=Number(price);T.state.lastEventAt=Date.now()}const el=document.getElementById('lastPrice');if(el)el.textContent=fmt(price)}
function lastRenkoClose(){const T=window.RWARenkoTV;return Number(T?.state?.confirmed?.at?.(-1)?.close)}

// Wrap the global LightweightCharts namespace by replacement rather than
// mutating its frozen namespace object.
(function installChartWrapper(){
  const L=window.LightweightCharts;if(!L?.createChart)return;
  const originalCreate=L.createChart.bind(L);
  function wrapPriceLine(line){let last=NaN;return new Proxy(line,{get(t,p,r){if(p==='applyOptions')return opts=>{const renko=lastRenkoClose(),next=Number.isFinite(renko)?renko:Number(opts?.price);if(Number.isFinite(next)&&next===last){stats.priceWritesSkipped++;return}last=next;stats.priceWrites++;return t.applyOptions({...opts,price:next,title:'RENKO'})};const v=Reflect.get(t,p,r);return typeof v==='function'?v.bind(t):v}})}
  function wrapSeries(series){let sig='';return new Proxy(series,{get(t,p,r){if(p==='setData')return data=>{const next=dataSig(data);if(next===sig){stats.dataWritesSkipped++;return}sig=next;stats.dataWrites++;stats.lastGeometryWriteAt=performance.now();return t.setData(data)};if(p==='createPriceLine')return opts=>{const renko=lastRenkoClose(),line=t.createPriceLine({...opts,price:Number.isFinite(renko)?renko:opts?.price,title:'RENKO'});stats.priceWrites++;return wrapPriceLine(line)};const v=Reflect.get(t,p,r);return typeof v==='function'?v.bind(t):v}})}
  function wrapTimeScale(ts){
    let sig='',programmaticSig='',programmaticUntil=0;
    return new Proxy(ts,{get(t,p,r){
      if(p==='setVisibleLogicalRange')return range=>{
        const next=rangeSig(range);
        if(next&&next===sig){stats.rangeWritesSkipped++;return}
        sig=next;stats.rangeWrites++;
        // Lightweight Charts may notify visible-range subscribers either
        // synchronously or on the next frame. Mark this exact range briefly so
        // the legacy subscriber cannot treat an app-authored latest/zoom range
        // as a real user left-edge pan and start old-history pagination.
        programmaticSig=next;programmaticUntil=performance.now()+120;
        return t.setVisibleLogicalRange(range)
      };
      if(p==='subscribeVisibleLogicalRangeChange')return cb=>t.subscribeVisibleLogicalRangeChange(range=>{
        const next=rangeSig(range);
        if(next&&next===programmaticSig&&performance.now()<=programmaticUntil){stats.programmaticRangeCallbacksSuppressed++;return}
        return cb(range)
      });
      const v=Reflect.get(t,p,r);return typeof v==='function'?v.bind(t):v
    }})
  }
  function wrapChart(chart){let tsProxy=null;return new Proxy(chart,{get(t,p,r){if(p==='addSeries'&&typeof t.addSeries==='function')return(...args)=>wrapSeries(t.addSeries(...args));if(p==='addCandlestickSeries'&&typeof t.addCandlestickSeries==='function')return(...args)=>wrapSeries(t.addCandlestickSeries(...args));if(p==='timeScale')return()=>tsProxy||(tsProxy=wrapTimeScale(t.timeScale()));const v=Reflect.get(t,p,r);return typeof v==='function'?v.bind(t):v}})}
  try{
    const replacement={...L,createChart:(...args)=>wrapChart(originalCreate(...args))};
    window.LightweightCharts=replacement;
    document.documentElement.dataset.renkoStableChart='true';
  }catch(e){console.warn('[RENKO stable chart wrapper]',e);document.documentElement.dataset.renkoStableChart='failed'}
})();

// Suppress only redundant *open* 1s kline events. Closed 1s bars always reach
// the base runtime, preserving the fixed 1s CLOSE source contract.
(function installWebSocketGuard(){
  const Native=window.WebSocket;if(typeof Native!=='function')return;
  const isKline=url=>/binance.*\/ws\/.+@kline_1s/i.test(String(url||''));
  function StableWebSocket(url,protocols){
    const socket=protocols===undefined?new Native(url):new Native(url,protocols);
    if(!isKline(url))return socket;
    let userMessage=null,lastProjectionSig='0';
    const proxy=new Proxy(socket,{get(t,p,r){if(p==='onmessage')return userMessage;const v=Reflect.get(t,p,t);return typeof v==='function'?v.bind(t):v},set(t,p,v){if(p==='onmessage'){userMessage=v;t.onmessage=ev=>{let m,k;try{m=JSON.parse(ev.data);k=m?.k}catch{}if(!k||typeof userMessage!=='function')return userMessage?.call(proxy,ev);const price=Number(k.c);if(Number.isFinite(price))updateRealLast(price);if(k.x){stats.closedForwarded++;lastProjectionSig='0';return userMessage.call(proxy,ev)}stats.partialEvents++;const T=window.RWARenkoTV,E=window.RWARenkoTVEngine;if(!T?.state?.base||!E?.project){stats.partialForwarded++;return userMessage.call(proxy,ev)}const b={openTime:Number(k.t),closeTime:Number(k.T),open:Number(k.o),high:Number(k.h),low:Number(k.l),close:Number(k.c),volume:Number(k.v)||0};let sig='0';try{sig=brickSig(E.project(T.state.base,b,T.settings,T.state.tickSize))}catch{}if(sig===lastProjectionSig){stats.partialSuppressed++;stats.lastSuppressedAt=Date.now();document.documentElement.dataset.renkoHeartbeatSuppressed='true';return}lastProjectionSig=sig;stats.partialForwarded++;return userMessage.call(proxy,ev)};return true}return Reflect.set(t,p,v,t)}});
    return proxy;
  }
  for(const k of ['CONNECTING','OPEN','CLOSING','CLOSED'])try{Object.defineProperty(StableWebSocket,k,{value:Native[k]})}catch{}
  try{StableWebSocket.prototype=Native.prototype}catch{}
  window.WebSocket=StableWebSocket;
})();

window.RWARenkoStableChart={version:VERSION,rule:'render-only-on-renko-geometry-change-fixed-1s-close',stats,brickSig,dataSig};
})();
