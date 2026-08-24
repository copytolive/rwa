(()=>{
'use strict';
if(window.RWARenkoV5Auto)return;
const MAX_SAMPLES=7000;
const state={lastKey:'',armed:false,wrappedWorker:null,previewActive:false,previewCount:0,previewTicks:0,previewFirst:0,previewLast:0,previewMin:Infinity,previewMax:-Infinity,previewStride:1,previewSamples:[],drawTimer:0};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const $=id=>document.getElementById(id);
function current(){const v3=window.RWARenkoV3,v5=window.RWARenkoV5,s=v3?.state;return {v3,v5,s,key:s&&Number(s.box)>0?`${s.selected}|${Number(s.box)}`:''}}
function fmtN(n){return Number(n||0).toLocaleString()}
function fmtDate(ms){if(!Number(ms))return'—';return new Date(Number(ms)).toLocaleDateString(undefined,{year:'numeric',month:'short',day:'2-digit'})}
function ensurePreview(){const wrap=$('chartWrap');if(!wrap)return null;let c=$('archivePreview');if(!c){c=document.createElement('canvas');c.id='archivePreview';c.setAttribute('aria-label','Progressive total raw tick history preview');Object.assign(c.style,{position:'absolute',inset:'0',width:'100%',height:'100%',zIndex:'3',pointerEvents:'none',background:'#070b10'});wrap.appendChild(c)}return c}
function hidePreview(){state.previewActive=false;const c=$('archivePreview');if(c)c.style.display='none'}
function resetPreview(){state.previewActive=false;state.previewCount=0;state.previewTicks=0;state.previewFirst=0;state.previewLast=0;state.previewMin=Infinity;state.previewMax=-Infinity;state.previewStride=1;state.previewSamples=[];clearTimeout(state.drawTimer);state.drawTimer=0;const c=$('archivePreview');if(c){c.style.display='none';const x=c.getContext('2d');x?.clearRect(0,0,c.width,c.height)}}
function absorbChunk(m){const chunk=Array.isArray(m.bricks)?m.bricks:[];if(!chunk.length)return;state.previewActive=true;state.previewCount=Number(m.bricksTotal)||state.previewCount;state.previewTicks=Number(m.ticks)||state.previewTicks;state.previewFirst=Number(m.firstTime)||state.previewFirst;state.previewLast=Number(m.lastTime)||state.previewLast;const start=Math.max(0,state.previewCount-chunk.length);for(let j=0;j<chunk.length;j++){const b=chunk[j],o=Number(b?.[0]),c=Number(b?.[1]);if(Number.isFinite(o)&&Number.isFinite(c)){state.previewMin=Math.min(state.previewMin,o,c);state.previewMax=Math.max(state.previewMax,o,c)}const idx=start+j;if(idx%state.previewStride===0)state.previewSamples.push({idx,b})}while(state.previewSamples.length>MAX_SAMPLES){state.previewStride*=2;state.previewSamples=state.previewSamples.filter(x=>x.idx%state.previewStride===0)}scheduleDraw();const hc=$('historyCount');if(hc)hc.textContent=`${fmtN(state.previewCount)} bricks building`;const cov=$('historyCoverage');if(cov)cov.textContent=`RAW TICK HISTORY BUILDING · ${fmtDate(state.previewFirst)} → ${fmtDate(state.previewLast)}`;const hf=$('historyFrom');if(hf)hf.textContent=fmtDate(state.previewFirst);const ht=$('historyTo');if(ht)ht.textContent=`${fmtDate(state.previewLast)} → LIVE`;}
function scheduleDraw(){if(state.drawTimer)return;state.drawTimer=setTimeout(()=>{state.drawTimer=0;drawPreview()},180)}
function drawPreview(){if(!state.previewActive||!state.previewSamples.length)return;const c=ensurePreview(),wrap=$('chartWrap');if(!c||!wrap)return;c.style.display='block';const r=wrap.getBoundingClientRect(),dpr=Math.min(2,window.devicePixelRatio||1),w=Math.max(320,Math.floor(r.width)),h=Math.max(240,Math.floor(r.height));if(c.width!==Math.floor(w*dpr)||c.height!==Math.floor(h*dpr)){c.width=Math.floor(w*dpr);c.height=Math.floor(h*dpr)}const x=c.getContext('2d');x.setTransform(dpr,0,0,dpr,0,0);x.clearRect(0,0,w,h);x.fillStyle='#070b10';x.fillRect(0,0,w,h);const padL=14,padR=14,padT=34,padB=28,cw=w-padL-padR,ch=h-padT-padB,min=Number.isFinite(state.previewMin)?state.previewMin:0,max=Number.isFinite(state.previewMax)?state.previewMax:min+1,span=Math.max(Number.EPSILON,max-min);x.strokeStyle='rgba(255,255,255,.06)';x.lineWidth=1;for(let i=0;i<=4;i++){const yy=padT+(ch*i/4);x.beginPath();x.moveTo(padL,yy);x.lineTo(w-padR,yy);x.stroke()}const y=p=>padT+(max-p)/span*ch,total=Math.max(1,state.previewCount-1);for(const s of state.previewSamples){const b=s.b,o=Number(b?.[0]),cl=Number(b?.[1]),dir=Number(b?.[2]);if(!Number.isFinite(o)||!Number.isFinite(cl))continue;const xx=padL+s.idx/total*cw,yo=y(o),yc=y(cl);x.strokeStyle=dir>=0?'rgba(72,211,153,.9)':'rgba(255,104,126,.9)';x.lineWidth=Math.max(1,Math.min(3,cw/Math.max(100,state.previewSamples.length)));x.beginPath();x.moveTo(xx,yo);x.lineTo(xx,yc);x.stroke()}x.fillStyle='#dce5f3';x.font='600 12px system-ui,-apple-system,sans-serif';x.fillText(`TOTAL RAW TICK HISTORY BUILDING · ${fmtN(state.previewCount)} bricks`,padL,17);x.fillStyle='#8d99aa';x.font='11px system-ui,-apple-system,sans-serif';x.fillText(`${fmtDate(state.previewFirst)} → ${fmtDate(state.previewLast)} · ${fmtN(state.previewTicks)} individual trades processed`,padL,h-8)}
function attachWorker(){const {v5}=current(),w=v5?.state?.worker;if(!w||w===state.wrappedWorker)return;state.wrappedWorker=w;resetPreview();const prev=w.onmessage;w.onmessage=function(ev){const m=ev.data||{};if(m.type==='chunk')absorbChunk(m);if(m.type==='done'){setTimeout(hidePreview,450)}else if(m.type==='error'){setTimeout(hidePreview,200)}if(typeof prev==='function')return prev.call(this,ev)};const prevErr=w.onerror;w.onerror=function(ev){hidePreview();if(typeof prevErr==='function')return prevErr.call(this,ev)}}
async function maybeStart(reason='auto'){
  const {v5,s,key}=current();
  if(!v5||!s||!key)return;
  if(state.lastKey===key&&state.armed)return;
  state.lastKey=key;state.armed=true;resetPreview();
  if(v5.state.running)v5.cancel();
  const status=$('archiveStatus'),detail=$('archiveDetail');
  if(status){status.className='archive-status loading';status.textContent='AUTO LOADING TOTAL RAW TICK HISTORY'}
  if(detail)detail.textContent=`${s.selected} · fixed box ${s.box} · oldest available raw trade archive → live`;
  await sleep(900);
  const now=current();
  if(now.key!==key)return;
  const cached=now.v5?.state?.result;
  if(cached?.complete&&cached.symbol===s.selected&&Number(cached.box)===Number(s.box))return;
  now.v5?.start();attachWorker();
}
async function boot(){
  for(let i=0;i<150&&!window.RWARenkoV5;i++)await sleep(100);
  if(!window.RWARenkoV5)throw Error('Renko V5 unavailable');
  window.RWARenkoV5Auto={version:'5.2.0',mode:'auto-selected-market-lifetime-raw-tick',preview:'progressive-archive-brick-stream',state,maybeStart,drawPreview,previewChunk:absorbChunk,resetPreview};
  const b=$('archiveLoad');if(b)b.title='Reload total raw-tick history for the selected market';
  setInterval(()=>{attachWorker();const {key}=current();if(key&&key!==state.lastKey){state.armed=false;maybeStart('selection-or-box-change').catch(console.error)}},150);
  window.addEventListener('resize',()=>{if(state.previewActive)scheduleDraw()},{passive:true});
  maybeStart('boot').catch(console.error);
}
boot().catch(e=>console.error('[Renko V5 Auto]',e));
})();
