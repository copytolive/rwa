/* Instant pair-switch shell.
 * The previous confirmed chart stays visible while the next symbol's 1s source
 * is fetched. This avoids a full-screen loading blank and gives the user a
 * synchronous first frame with the target pair already acknowledged.
 */
(()=>{
'use strict';
if(window.RWARenkoSwitchFast)return;
const T=window.RWARenkoTV;if(!T?.loadSymbol)return;
const original=T.loadSymbol.bind(T);
let seq=0,active=null;
const stats={switches:0,completed:0,failed:0,aborted:0,firstFrameMaxMs:0,lastFirstFrameMs:0,lastLoadMs:0,maxLoadMs:0};
const split=s=>{s=String(s||'').toUpperCase().replace(/[^A-Z0-9]/g,'');for(const q of ['USDT','USDC','FDUSD','BTC','ETH','BNB'])if(s.endsWith(q)&&s.length>q.length)return[s.slice(0,-q.length),q];return[s,'']};
const norm=s=>{s=String(s||'').toUpperCase().replace(/[^A-Z0-9]/g,'');if(!s)return'BTCUSDT';if(!/(USDT|USDC|FDUSD|BTC|ETH|BNB)$/.test(s)&&/^[A-Z0-9]{2,10}$/.test(s))return s+'USDT';return s};
function el(id){return document.getElementById(id)}
function overlay(){let e=el('switchOverlay');if(e)return e;const wrap=el('chartWrap');if(!wrap)return null;e=document.createElement('div');e.id='switchOverlay';e.className='switch-overlay';e.hidden=true;e.innerHTML='<span class="switch-dot"></span><b></b><small>Previous chart stays visible until the new 1s data is ready.</small>';wrap.appendChild(e);return e}
function showTarget(symbol){const [base,quote]=split(symbol),pair=el('pairName'),icon=el('pairIcon'),feed=el('feedPill'),o=overlay(),wrap=el('chartWrap');if(pair)pair.textContent=`${base} / ${quote}`;if(icon)icon.textContent=base.slice(0,2);if(feed){feed.classList.remove('live');const b=feed.querySelector('b');if(b)b.textContent='SWITCHING'}if(o){o.hidden=false;const b=o.querySelector('b');if(b)b.textContent=`Switching to ${base} / ${quote} · 1s`;const s=o.querySelector('small');if(s)s.textContent='Previous chart stays visible until the new 1s source is ready.'}wrap?.classList.add('switching');document.documentElement.dataset.pairSwitching='true';document.documentElement.dataset.pairSwitchTarget=symbol}
function finish(symbol,ok,id,start){if(id!==seq)return;const elapsed=performance.now()-start,wrap=el('chartWrap'),o=overlay();wrap?.classList.remove('switching');if(o)o.hidden=true;document.documentElement.dataset.pairSwitching='false';document.documentElement.dataset.pairSwitchCompleted=ok?'true':'false';document.documentElement.dataset.pairSwitchLoadMs=elapsed.toFixed(3);stats.lastLoadMs=elapsed;stats.maxLoadMs=Math.max(stats.maxLoadMs,elapsed);if(ok)stats.completed++;else stats.failed++;active=null;window.dispatchEvent(new CustomEvent('renko:symbol-switch-end',{detail:{symbol,ok,elapsedMs:elapsed,id}}))}
async function load(symbol,opts={}){symbol=norm(symbol);if(!symbol)return false;if(active?.symbol===symbol)return active.promise;if(T.state?.symbol===symbol&&T.state?.status==='live'&&document.documentElement.dataset.pairSwitching!=='true')return true;const id=++seq,start=performance.now(),from=T.state?.symbol||'';stats.switches++;showTarget(symbol);window.dispatchEvent(new CustomEvent('renko:symbol-switch-start',{detail:{from,to:symbol,id}}));const first=performance.now()-start;stats.lastFirstFrameMs=first;stats.firstFrameMaxMs=Math.max(stats.firstFrameMaxMs,first);document.documentElement.dataset.pairSwitchFirstFrameMs=first.toFixed(3);document.documentElement.dataset.pairSwitchStartedAt=start.toFixed(3);const p=(async()=>{try{const ok=await original(symbol,{...opts,fit:opts.fit!==false});finish(symbol,!!ok,id,start);return !!ok}catch(e){finish(symbol,false,id,start);console.error('[RENKO fast switch]',e);return false}})();active={id,symbol,promise:p};return p}
function symbolFromRow(row){if(!row)return'';const direct=row.dataset?.symbol;if(direct)return norm(direct);const text=row.querySelector('.pair-main b')?.textContent||'';return norm(text.replace(/\s*\/\s*/g,''))}
document.addEventListener('click',e=>{const row=e.target?.closest?.('.pair-row');if(row){const s=symbolFromRow(row);if(s){e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();document.querySelector('.markets')?.classList.remove('open');void load(s,{fit:true});return}}const quick=e.target?.closest?.('[data-quick]');if(quick){const s=norm(quick.dataset.quick);if(s){e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();void load(s,{fit:true})}}},true);
T.loadSymbol=load;
window.RWARenkoSwitchFast={version:'1.0.0',load,stats,get active(){return active}};
})();
