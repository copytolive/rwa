/* TradingView-observable historical depth ladder.
 * TradingView documents that the selected chart timeframe is the finest source
 * resolution and that, when it runs out of history, higher timeframes are used
 * for older Renko history. Documented maximum fallback tiers:
 *   chart timeframe < 1 minute  -> up to 60 minutes
 *   chart timeframe < 60 min   -> up to 240 minutes
 *   chart timeframe < 240 min  -> up to 1D
 * This module preserves the finest recent bars and prepends only non-overlapping
 * older higher-timeframe bars. It never relabels higher-timeframe rows as 1s.
 */
(()=>{
'use strict';
if(window.RWARenkoHistoryLadder)return;
const ROOT='https://data-api.binance.vision';
const ORDER=['1s','1m','3m','5m','15m','30m','1h','4h','1d'];
const MINUTES={ '1s':1/60,'1m':1,'3m':3,'5m':5,'15m':15,'30m':30,'1h':60,'4h':240,'1d':1440 };
const DEFAULT_PAGE_BUDGET=8;
let busy=false;
const num=v=>Number(v);
function highestDocumented(interval){const m=MINUTES[interval];if(!(m>=0))return interval;if(m<1)return'1h';if(m<60)return'4h';if(m<240)return'1d';return interval==='4h'?'1d':interval}
function ladder(interval){const hi=highestDocumented(interval),a=ORDER.indexOf(interval),b=ORDER.indexOf(hi);if(a<0)return[interval];if(b<a)return[interval];return ORDER.slice(a,b+1)}
function mapRows(rows,interval){return(Array.isArray(rows)?rows:[]).map(x=>({openTime:num(x[0]),open:num(x[1]),high:num(x[2]),low:num(x[3]),close:num(x[4]),volume:num(x[5])||0,closeTime:num(x[6]),_renkoSourceInterval:interval})).filter(b=>[b.openTime,b.open,b.high,b.low,b.close,b.closeTime].every(Number.isFinite)).sort((a,b)=>a.openTime-b.openTime)}
async function page(symbol,interval,endTime){const q=new URLSearchParams({symbol,interval,limit:'1000'});if(Number.isFinite(num(endTime)))q.set('endTime',String(Math.floor(num(endTime))));const r=await fetch(`${ROOT}/api/v3/klines?${q}`,{cache:'no-store',credentials:'omit'});if(!r.ok)throw new Error(`history ${interval} HTTP ${r.status}`);return mapRows(await r.json(),interval)}
function mergeOlder(older,recent,boundary){const m=new Map();for(const b of older||[]){if(num(b.closeTime)<boundary)m.set(num(b.openTime),b)}for(const b of recent||[])m.set(num(b.openTime),b);return[...m.values()].sort((a,b)=>a.openTime-b.openTime)}
function stamp(T,tiers){const s=T.state;s.historyLadderTiers=[...tiers];s.historyLadderActive=tiers.length>1;s.historyLadderOldestInterval=tiers.at(-1)||T.settings.interval;s.historyLadderRule='finest-selected-then-documented-higher-timeframes';document.documentElement.dataset.renkoHistoryLadder=tiers.join('>')}
async function extend(T=window.RWARenkoTV,{targetBars=0,maxPagesPerTier=DEFAULT_PAGE_BUDGET,rebuild=true}={}){
  if(!T||busy||!T.state?.closedBars?.length||T.state.parityFixture)return false;busy=true;
  const generation=T.state.generation,symbol=T.state.symbol,selected=T.settings.interval,tiers=ladder(selected),used=[selected];
  try{
    let bars=T.state.closedBars.slice().sort((a,b)=>a.openTime-b.openTime),boundary=num(bars[0]?.openTime),addedTotal=0;
    for(const interval of tiers){let pages=0,cursor=boundary-1;while(pages<maxPagesPerTier){if(generation!==T.state.generation||T.settings.interval!==selected)return false;if(targetBars>0&&bars.length>=targetBars)break;const rows=await page(symbol,interval,cursor),older=rows.filter(b=>b.closeTime<boundary);pages++;if(!older.length)break;const before=bars.length;bars=mergeOlder(older,bars,boundary);const added=bars.length-before;addedTotal+=Math.max(0,added);const oldest=num(older[0]?.openTime);if(!(oldest<cursor)||!added)break;cursor=oldest-1;boundary=num(bars[0]?.openTime);await new Promise(r=>setTimeout(r,0))}if(interval!==selected&&addedTotal>0&&!used.includes(interval))used.push(interval);if(targetBars>0&&bars.length>=targetBars)break}
    if(generation!==T.state.generation)return false;T.state.closedBars=bars;T.state.historyPages=Math.max(Number(T.state.historyPages)||1,5)+addedTotal/1000;stamp(T,used);if(rebuild&&addedTotal>0)T.rebuild({fit:false});return addedTotal>0;
  }catch(e){console.warn('[RENKO history ladder]',e);return false}finally{busy=false}
}
function coverage(T=window.RWARenkoTV){const b=T?.state?.closedBars||[];return{from:num(b[0]?.openTime)||0,to:num(b.at(-1)?.closeTime)||0,bars:b.length,tiers:T?.state?.historyLadderTiers||[T?.settings?.interval].filter(Boolean)}}
window.addEventListener('renko:tv-ready',()=>{const T=window.RWARenkoTV;if(!T)return;stamp(T,[T.settings.interval]);if(new URLSearchParams(location.search).get('fixture')==='gold20y')return;setTimeout(()=>void extend(T,{maxPagesPerTier:2,rebuild:true}),250)},{once:true});
window.RWARenkoHistoryLadder={version:'1.0.1',rule:'selected-finest-then-higher-timeframes-on-history-exhaustion',highestDocumented,ladder,extend,coverage,get busy(){return busy}};
})();