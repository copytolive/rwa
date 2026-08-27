/* Deep ATR coverage/date integrity lock.
 * Keeps the visible coverage label tied to the exact deep-worker entry instead
 * of the small resident render window. It never fabricates an earlier date: an
 * entry whose timestamps do not span its claimed 1s source count is marked
 * invalid so the browser regression gate must fail.
 */
(()=>{
'use strict';
if(window.RWARenkoDeepCoverageLock)return;
const fmtDate=ms=>{try{return new Date(Number(ms)).toLocaleString(undefined,{month:'short',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit'})}catch{return'—'}};
let busy=false,lastSig='';
function current(){
  const T=window.RWARenkoTV,A=window.RWARenkoATRInstant;
  if(!T||!A||T.settings.method!=='atr'||typeof A.entryFor!=='function')return null;
  const n=Math.floor(Number(T.settings.atrLength)||0),e=A.entryFor(n);
  if(!e||e.length!==n)return null;
  return{T,e,n};
}
function stamp(){
  if(busy)return false;const c=current();if(!c)return false;
  const {T,e,n}=c,from=Number(e.fromTime)||0,to=Number(e.toTime||e.revision)||0,count=Number(e.sourceCount)||0;
  const span=Math.max(0,to-from),expected=Math.max(0,(Math.min(count,n)-1)*900);
  const valid=n<1000||(from>0&&to>=from&&span>=expected);
  const sig=[n,from,to,count,valid].join('|');
  T.state.atrHistoryFrom=from;T.state.atrHistoryTo=to;T.state.atrHistorySourceCount=count;T.state.atrHistorySpanMs=span;T.state.atrHistoryExpectedMinSpanMs=expected;T.state.atrHistorySpanPass=valid;
  const root=document.documentElement;root.dataset.atrHistoryFrom=String(from);root.dataset.atrHistoryTo=String(to);root.dataset.atrHistorySpanMs=String(span);root.dataset.atrHistorySpanPass=valid?'true':'false';
  if(sig===lastSig)return valid;lastSig=sig;busy=true;
  try{
    const countEl=document.getElementById('sourceBarCount');if(countEl&&count>0)countEl.textContent=count.toLocaleString();
    const cov=document.getElementById('tvCoverage');if(cov){
      cov.textContent=valid?`${fmtDate(from)} → ${fmtDate(to)} · ${count.toLocaleString()} 1s CLOSE source bars`:`HISTORY INTEGRITY CHECK · ATR ${n.toLocaleString()} · ${count.toLocaleString()} source bars · timestamp span too short`;
      cov.dataset.deepCoverage=valid?'valid':'invalid';
    }
  }finally{busy=false}
  return valid;
}
function schedule(){queueMicrotask(stamp)}
const observer=new MutationObserver(schedule);
for(const id of ['tvCoverage','sourceBarCount']){const el=document.getElementById(id);if(el)observer.observe(el,{childList:true,characterData:true,subtree:true})}
window.addEventListener('renko:tv-ready',schedule);
document.addEventListener('click',e=>{if(e.target?.closest?.('[data-apply-method="atr"]'))setTimeout(stamp,0)},true);
setInterval(()=>{if(document.visibilityState==='visible')stamp()},250);
window.RWARenkoDeepCoverageLock={version:'1.0.0',rule:'visible-deep-atr-date-coverage-must-match-worker-timestamps-and-1s-source-span',stamp};
})();