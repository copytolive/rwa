(()=>{
'use strict';
if(window.RWAReferenceParityV21)return;
const VERSION='2.1.0',$=s=>document.querySelector(s),qa=s=>[...document.querySelectorAll(s)];
const API=['https://data-api.binance.vision','https://api.binance.com'];
const num=v=>{const n=Number(v);return Number.isFinite(n)?n:0};
const market=()=>{try{return window.RWAMarketRuntime?.state?.()||null}catch{return null}};
const fmtPrice=v=>{const n=num(v);if(!(n>0))return'—';const f=window.RWAMarketRuntime?.format?.price;return f?f(n):'$'+n.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:n>=1000?2:n>=1?4:6})};
const compact=v=>{const n=num(v),a=Math.abs(n);if(!Number.isFinite(n))return'—';return a>=1e9?'$'+(n/1e9).toFixed(2)+'B':a>=1e6?'$'+(n/1e6).toFixed(2)+'M':a>=1e3?'$'+(n/1e3).toFixed(1)+'K':'$'+n.toFixed(2)};
let chart=null,tip=null,ro=null,drawPending=false,lastSymbol='',lastBars=0,lastClose=0,depthBusy=false,lastDepthAt=0,lastBookSymbol='';
function ensureChart(){
 const wrap=$('.chart-wrap');if(!wrap)return null;
 if(!chart){chart=document.createElement('canvas');chart.id='rwaV21Chart';chart.setAttribute('aria-label','Live candlestick chart');chart.setAttribute('role','img');const anchor=$('#rwaRefIndicatorOverlay')||$('#rwaRefLineChart')||$('#rwaRefOrderOverlays');anchor?wrap.insertBefore(chart,anchor):wrap.appendChild(chart);chart.addEventListener('pointermove',chartPointer,{passive:true});chart.addEventListener('pointerleave',()=>{if(tip)tip.style.display='none'});}
 if(!tip){tip=document.createElement('div');tip.className='rwa-v21-chart-tip';wrap.appendChild(tip)}
 if(!ro&&window.ResizeObserver){ro=new ResizeObserver(()=>queueDraw());ro.observe(wrap)}
 return chart
}
function chartRect(){const c=ensureChart();return c?c.getBoundingClientRect():null}
function queueDraw(){if(drawPending)return;drawPending=true;requestAnimationFrame(()=>{drawPending=false;drawChart()})}
function bars(){const a=market()?.klines||[];return a.filter(k=>[k?.o,k?.h,k?.l,k?.c].every(v=>Number.isFinite(Number(v)))).slice(innerWidth<=680?-72:-120)}
function priceDecimals(v){return v>=1000?2:v>=1?4:v>=.01?5:7}
function drawChart(){
 const c=ensureChart(),r=chartRect();if(!c||!r||r.width<20||r.height<20)return;
 const d=Math.min(2,devicePixelRatio||1),w=Math.max(1,Math.round(r.width)),h=Math.max(1,Math.round(r.height));if(c.width!==Math.round(w*d)||c.height!==Math.round(h*d)){c.width=Math.round(w*d);c.height=Math.round(h*d)}
 const x=c.getContext('2d');x.setTransform(d,0,0,d,0,0);x.clearRect(0,0,w,h);x.fillStyle='#020810';x.fillRect(0,0,w,h);
 const a=bars(),mobile=innerWidth<=680,pad={l:mobile?8:12,r:mobile?44:62,t:mobile?12:16,b:mobile?24:30};
 const cw=Math.max(1,w-pad.l-pad.r),ch=Math.max(1,h-pad.t-pad.b),volH=Math.max(34,Math.min(72,ch*.19)),priceH=Math.max(1,ch-volH-8);
 x.strokeStyle='#132334';x.lineWidth=1;x.globalAlpha=.9;
 for(let i=0;i<=5;i++){const yy=pad.t+priceH*i/5;x.beginPath();x.moveTo(pad.l,yy+.5);x.lineTo(w-pad.r,yy+.5);x.stroke()}
 for(let i=0;i<=6;i++){const xx=pad.l+cw*i/6;x.beginPath();x.moveTo(xx+.5,pad.t);x.lineTo(xx+.5,pad.t+priceH+8+volH);x.stroke()}
 x.globalAlpha=1;
 if(a.length<2){x.fillStyle='#718399';x.font=(mobile?'10':'11')+'px Inter,system-ui';x.textAlign='center';x.fillText('Loading verified live market history…',w/2,h/2);c.dataset.v21State='loading';return}
 const lo=Math.min(...a.map(k=>num(k.l)).filter(v=>v>0)),hi=Math.max(...a.map(k=>num(k.h))),range=Math.max(1e-12,hi-lo),vmax=Math.max(1,...a.map(k=>num(k.v))),step=cw/a.length,body=Math.max(1,Math.min(mobile?5:8,step*.64));
 const yy=v=>pad.t+(hi-v)/range*priceH;
 x.font=(mobile?'8':'9')+'px Inter,system-ui';x.textAlign='left';x.fillStyle='#7b8da2';for(let i=0;i<=5;i++){const val=hi-range*i/5;x.fillText(val.toFixed(priceDecimals(val)),w-pad.r+6,pad.t+priceH*i/5+3)}
 a.forEach((k,i)=>{const xx=pad.l+i*step+step/2,o=num(k.o),cl=num(k.c),high=num(k.h),low=num(k.l),up=cl>=o,col=up?'#36d7a2':'#ff626e';x.strokeStyle=col;x.fillStyle=col;x.globalAlpha=.94;x.beginPath();x.moveTo(xx,yy(high));x.lineTo(xx,yy(low));x.stroke();const y1=yy(Math.max(o,cl)),y2=yy(Math.min(o,cl));x.fillRect(xx-body/2,y1,body,Math.max(1,y2-y1));const vh=(num(k.v)/vmax)*volH;x.globalAlpha=.38;x.fillRect(xx-body/2,pad.t+priceH+8+volH-vh,body,vh)});x.globalAlpha=1;
 const last=a.at(-1),lp=num(last.c),ly=yy(lp);x.strokeStyle='#36d7a288';x.setLineDash([3,4]);x.beginPath();x.moveTo(pad.l,ly+.5);x.lineTo(w-pad.r,ly+.5);x.stroke();x.setLineDash([]);x.fillStyle='#36d7a2';const tag=fmtPrice(lp).replace('$','');x.fillRect(w-pad.r,ly-9,pad.r,18);x.fillStyle='#03110d';x.font='800 '+(mobile?'8':'9')+'px Inter,system-ui';x.fillText(tag,w-pad.r+4,ly+3);
 x.fillStyle='#63758a';x.textAlign='center';x.font=(mobile?'7':'8')+'px Inter,system-ui';const marks=[0,Math.floor((a.length-1)/3),Math.floor((a.length-1)*2/3),a.length-1];for(const i of marks){const dt=new Date(num(a[i]?.t)||Date.now()),label=dt.toLocaleDateString(undefined,{month:'short',day:'numeric'});x.fillText(label,pad.l+i*step+step/2,h-8)}
 c.dataset.v21State='live';c.dataset.v21Bars=String(a.length);lastBars=a.length;lastClose=lp;lastSymbol=String(market()?.selected||'');
}
function chartPointer(e){const a=bars(),r=chartRect();if(!tip||!r||a.length<2)return;const padL=innerWidth<=680?8:12,padR=innerWidth<=680?44:62,cw=r.width-padL-padR,rel=Math.max(0,Math.min(cw,e.clientX-r.left-padL)),i=Math.max(0,Math.min(a.length-1,Math.floor(rel/(cw/a.length)))),k=a[i];if(!k)return;const ch=num(k.c)-num(k.o),p=num(k.o)?ch/num(k.o)*100:0;tip.innerHTML='<b>'+new Date(num(k.t)||Date.now()).toLocaleString()+'</b><br>O '+fmtPrice(k.o)+' · H '+fmtPrice(k.h)+'<br>L '+fmtPrice(k.l)+' · C <span class="'+(p>=0?'pos':'neg')+'">'+fmtPrice(k.c)+' ('+(p>=0?'+':'')+p.toFixed(2)+'%)</span><br>Vol '+Number(num(k.v)).toLocaleString(undefined,{maximumFractionDigits:3});tip.style.display='block';const left=Math.min(r.width-160,Math.max(6,e.clientX-r.left+12)),top=Math.min(r.height-72,Math.max(42,e.clientY-r.top+12));tip.style.left=left+'px';tip.style.top=top+'px'}
function rowNumbers(row){const sp=[...row.querySelectorAll('span')].map(n=>String(n.textContent||'').trim());return{p:num((sp[0]||'').replace(/[^0-9.-]/g,'')),q:num((sp[1]||'').replace(/[^0-9.eE+-]/g,''))}}
function styleBook(){for(const sel of ['#asks','#bids']){const rows=qa(sel+' .bookrow'),vals=rows.map(r=>rowNumbers(r).q),mx=Math.max(0,...vals);rows.forEach((r,i)=>{const {p,q}=rowNumbers(r);r.style.setProperty('--v21-depth',(mx>0?Math.max(7,Math.min(100,q/mx*100)):0).toFixed(1)+'%');if(p>0)r.dataset.v21Price=String(p);r.dataset.v21Side=sel==='#asks'?'ask':'bid'})}}
async function fetchJson(path){let last;for(const base of API){try{const r=await fetch(base+path,{cache:'no-store'});if(r.ok)return await r.json();last=Error(String(r.status))}catch(e){last=e}}throw last||Error('market data unavailable')}
function renderDepthRows(host,rows,side){const f=window.RWAMarketRuntime?.format?.price;const a=rows.slice(0,9),max=Math.max(1,...a.map(r=>num(r[1])));host.innerHTML=a.map(([p,q])=>{const px=num(p),qty=num(q),value=px*qty,width=Math.max(7,Math.min(100,qty/max*100)).toFixed(1);return '<div class="bookrow" data-v21-price="'+px+'" data-v21-side="'+side+'" style="--v21-depth:'+width+'%"><span class="'+(side==='bid'?'up':'down')+'">'+(f?f(px):fmtPrice(px))+'</span><span>'+qty.toLocaleString(undefined,{maximumFractionDigits:6})+'</span><span>'+compact(value)+'</span></div>'}).join('')}
async function ensureDepth(){
 const s=market(),sym=String(s?.selected||'');if(!sym||depthBusy)return;const bids=$('#bids'),asks=$('#asks');if(!bids||!asks)return;
 const has=bids.querySelector('.bookrow')&&asks.querySelector('.bookrow');if(has){styleBook();lastBookSymbol=sym;return}
 if(Date.now()-lastDepthAt<1200)return;depthBusy=true;lastDepthAt=Date.now();try{const d=await fetchJson('/api/v3/depth?symbol='+encodeURIComponent(sym)+'&limit=50');if(sym!==String(market()?.selected||''))return;if(!Array.isArray(d?.bids)||!Array.isArray(d?.asks))return;if(!bids.querySelector('.bookrow'))renderDepthRows(bids,d.bids,'bid');if(!asks.querySelector('.bookrow'))renderDepthRows(asks,[...d.asks].reverse(),'ask');const bp=num(d.bids?.[0]?.[0]),ap=num(d.asks?.[0]?.[0]);if(bp>0&&ap>0){const mid=$('#midPrice');if(mid&&!mid.querySelector('strong'))mid.innerHTML='<strong>'+fmtPrice((bp+ap)/2)+'</strong><span>Spread '+(((ap-bp)/((ap+bp)/2))*100).toFixed(4)+'%</span>'}styleBook();lastBookSymbol=sym}catch(e){console.warn('RWA V21 truthful depth fallback unavailable',e)}finally{depthBusy=false}}
function bindBook(){for(const h of [$('#asks'),$('#bids')].filter(Boolean)){if(h.dataset.v21Bound)return;h.dataset.v21Bound='1';h.addEventListener('click',e=>{const row=e.target.closest('.bookrow');if(!row)return;const p=num(row.dataset.v21Price)||rowNumbers(row).p;if(!(p>0))return;const mode=$('#rwaRefTradeTicket [data-ref-mode="LIMIT"]');mode?.click();const inp=$('#rwaRefTradeTicket [data-ref-order-price]');if(inp){inp.value=String(p);inp.dispatchEvent(new Event('input',{bubbles:true}))}if(innerWidth<=680)window.RWATerminalV5?.setMobile?.('trade')})}}
function ensureRuntime(){ensureChart();bindBook();queueDraw();ensureDepth();styleBook()}
const obs=new MutationObserver(m=>{let chartDirty=false,bookDirty=false;for(const x of m){const t=x.target instanceof Element?x.target:null;if(t?.closest?.('.chart-wrap')||[...x.addedNodes].some(n=>n instanceof Element&&n.closest?.('.chart-wrap')))chartDirty=true;if(t?.closest?.('#asks,#bids')||[...x.addedNodes].some(n=>n instanceof Element&&(n.matches?.('.bookrow')||n.closest?.('#asks,#bids'))))bookDirty=true}if(chartDirty)queueDraw();if(bookDirty)queueMicrotask(styleBook)});
function boot(){ensureRuntime();const root=document.documentElement;obs.observe(root,{subtree:true,childList:true,characterData:true});window.addEventListener('rwa:history-first-paint',queueDraw);window.addEventListener('rwa:exchange-state',queueDraw);window.addEventListener('resize',queueDraw,{passive:true});setInterval(()=>{if(document.hidden)return;const s=market(),sym=String(s?.selected||''),a=s?.klines||[],close=num(a.at(-1)?.c);if(sym!==lastSymbol||a.length!==lastBars||close!==lastClose)queueDraw();ensureDepth();styleBook();if(!a.length)window.RWAMarketRuntime?.reload?.()},1200);document.documentElement.dataset.rwaReferenceV21='1';window.dispatchEvent(new CustomEvent('rwa:reference-v21-ready',{detail:{version:VERSION}}))}
window.RWAReferenceParityV21={version:VERSION,active:true,redraw:queueDraw,refreshDepth:ensureDepth,audit:()=>({version:VERSION,chartState:chart?.dataset.v21State||'missing',bars:Number(chart?.dataset.v21Bars||0),bookBids:qa('#bids .bookrow').length,bookAsks:qa('#asks .bookrow').length,symbol:String(market()?.selected||''),mainnetReady:window.RWAExchangeCore?.mainnetUnlocked?.()===true})};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
