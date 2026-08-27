(()=>{
'use strict';
if(window.RWAMarketPerformanceGuard)return;

const PERF={version:'1.3.3',runtime:'root-terminal-low-jank-v1'};
const hotIds=new Set(['pairList','pairCount','liveDot','statHigh','statLow','statVol','statChange','buyPct','tradeCount']);
const NativeMutationObserver=window.MutationObserver;
const periodic=new Map();
let periodicTimer=0;

function installSingleRowHeader(){
  const top=document.querySelector('.topbar');
  if(!top||top.dataset.rwaSingleRow==='1')return;
  document.querySelector('.productbar')?.remove();
  document.querySelector('.trustbar')?.remove();
  top.dataset.rwaSingleRow='1';
  top.dataset.rwaHeader='premium-minimal-v2';
}

function loadPersistentMarketLayer(){
  if(!document.querySelector('link[data-rwa-persistent-market-v3]')){
    const l=document.createElement('link');l.rel='stylesheet';l.href='persistent-market-shell-v3.css?v=3';l.dataset.rwaPersistentMarketV3='1';document.head.appendChild(l);
  }
  if(!document.querySelector('link[data-rwa-persistent-market-operability]')){
    const l=document.createElement('link');l.rel='stylesheet';l.href='persistent-market-operability-patch-v1.css?v=10';l.dataset.rwaPersistentMarketOperability='1';document.head.appendChild(l);
  }
}

function startPeriodic(){
  if(periodicTimer)return;
  periodicTimer=setInterval(()=>{
    if(document.hidden)return;
    for(const [cb,count] of periodic){
      if(count<=0)continue;
      try{cb([],null)}catch(e){console.warn('RWA stable observer callback',e)}
    }
  },1200);
}

if(typeof NativeMutationObserver==='function'){
  class StableMutationObserver{
    constructor(cb){this.cb=cb;this.native=null;this.hot=false;this.targets=[]}
    observe(target,options){
      const hot=target===document.documentElement||target===document.body||hotIds.has(target?.id||'');
      if(hot){
        this.hot=true;
        periodic.set(this.cb,(periodic.get(this.cb)||0)+1);
        this.targets.push(target);
        startPeriodic();
        return;
      }
      if(!this.native)this.native=new NativeMutationObserver(this.cb);
      this.native.observe(target,options);
    }
    disconnect(){
      this.native?.disconnect();
      if(this.hot){const n=(periodic.get(this.cb)||1)-1;if(n<=0)periodic.delete(this.cb);else periodic.set(this.cb,n)}
      this.hot=false;this.targets=[];
    }
    takeRecords(){return this.native?.takeRecords?.()||[]}
  }
  window.MutationObserver=StableMutationObserver;
}

const rowCache=new Map();
const dirtyRows=new Set();
let rowFlushTimer=0;
function scheduleRowFlush(){
  if(rowFlushTimer)return;
  rowFlushTimer=setTimeout(()=>{
    rowFlushTimer=0;
    if(document.hidden){dirtyRows.clear();return}
    for(const sym of dirtyRows){
      const row=rowCache.get(sym);if(!row)continue;
      let x=null;try{x=S.map.get(sym)}catch{}if(!x)continue;
      const p=row._rwaPrice||row.querySelector('[data-p]');
      const c=row._rwaChange||row.querySelector('[data-c]');
      if(p)p.textContent=price(x.price);
      if(c){c.textContent=pct(x.change);c.className='chg '+((x.change||0)>=0?'up':'down')}
    }
    dirtyRows.clear();
  },500);
}

const baseUpdatePairDOM=typeof window.updatePairDOM==='function'?window.updatePairDOM:null;
if(baseUpdatePairDOM){
  window.updatePairDOM=function(x){if(!x?.symbol)return;dirtyRows.add(x.symbol);scheduleRowFlush()};
}

if(typeof window.renderPairs==='function'&&typeof filtered==='function'){
  window.renderPairs=function(){
    const all=filtered();
    const limit=innerWidth<=680?70:innerWidth<=1100?90:140;
    const a=all.slice(0,limit),frag=document.createDocumentFragment();
    rowCache.clear();
    for(const x of a){
      const d=document.createElement('div');
      d.className='pairrow'+(x.symbol===S.selected?' active':'');
      d.dataset.sym=x.symbol;
      const name=document.createElement('div');name.className='pairname';
      const icon=document.createElement('div');icon.className='tokenicon';icon.textContent=String(x.base||'').slice(0,2);
      const meta=document.createElement('div');meta.className='pairmeta';
      const b=document.createElement('b');b.textContent=`${x.base} / USDT`;
      const sm=document.createElement('small');sm.textContent=(x.rwa?'RWA · ':'')+'Spot';
      meta.append(b,sm);name.append(icon,meta);
      const pp=document.createElement('div');pp.className='pairprice';
      const pe=document.createElement('b');pe.dataset.p=x.symbol;pe.textContent=price(x.price);
      const ce=document.createElement('div');ce.dataset.c=x.symbol;ce.className='chg '+((x.change||0)>=0?'up':'down');ce.textContent=pct(x.change);
      pp.append(pe,ce);d.append(name,pp);d._rwaPrice=pe;d._rwaChange=ce;d.onclick=()=>selectPair(x.symbol,true);rowCache.set(x.symbol,d);frag.appendChild(d);
    }
    const list=document.getElementById('pairList');if(list)list.replaceChildren(frag);
    if(list&&!a.length)list.innerHTML='<div class="empty">No markets match this filter.</div>';
    const count=document.getElementById('pairCount');if(count)count.textContent=`${S.pairs.length} live USDT pairs · showing ${a.length}${all.length>a.length?` of ${all.length}`:''}`;
  };
}

const baseRenderBook=typeof window.renderBook==='function'?window.renderBook:null;
let latestBook=null,bookTimer=0;
if(baseRenderBook){
  window.renderBook=function(bids,asks){
    latestBook=[bids,asks];
    if(bookTimer)return;
    bookTimer=setTimeout(()=>{
      bookTimer=0;if(document.hidden||!latestBook)return;
      const v=latestBook;latestBook=null;try{baseRenderBook(v[0],v[1])}catch(e){console.warn('RWA book paint',e)}
    },320);
  };
}

let pendingTrade=null,tradeTimer=0,paintedTrades=0;
function flushTrade(){
  tradeTimer=0;if(document.hidden||!pendingTrade)return;
  const t=pendingTrade;pendingTrade=null;
  const buy=!t.m,p=Number(t.p),q=Number(t.q);if(!Number.isFinite(p)||!Number.isFinite(q))return;
  const tape=document.getElementById('tradeTape');
  if(tape){
    if(tape.querySelector('.empty'))tape.replaceChildren();
    const d=document.createElement('div');d.className='trade';
    const a=document.createElement('span');a.className=buy?'up':'down';a.textContent=price(p);
    const b=document.createElement('span');b.textContent=q.toFixed(q<1?5:3);
    const c=document.createElement('span');c.textContent=new Date(t.T||Date.now()).toLocaleTimeString();
    d.append(a,b,c);tape.prepend(d);while(tape.children.length>28)tape.lastChild.remove();
  }
  const tick=document.getElementById('lastTick');if(tick)tick.textContent=new Date().toLocaleTimeString();
  try{renderPulse()}catch{}
  paintedTrades++;
  if(paintedTrades%10===0)try{addActivity(buy,p,q)}catch{}
}

if(typeof window.addTrade==='function'){
  window.addTrade=function(t){
    const p=Number(t?.p),q=Number(t?.q);if(!Number.isFinite(p)||!Number.isFinite(q))return;
    const value=p*q,buy=!t.m;
    try{if(buy)S.buyVol+=value;else S.sellVol+=value;S.trades++}catch{}
    pendingTrade=t;
    if(!tradeTimer)tradeTimer=setTimeout(flushTrade,250);
  };
}

let lastResize=0;
const baseDraw=typeof window.drawFallback==='function'?window.drawFallback:null;
if(baseDraw){
  window.drawFallback=function(){
    const now=performance.now();if(now-lastResize<180)return;lastResize=now;return baseDraw();
  };
}

function suspendWhenHidden(){
  if(!document.hidden){scheduleRowFlush();return}
  dirtyRows.clear();latestBook=null;pendingTrade=null;
}
document.addEventListener('visibilitychange',suspendWhenHidden,{passive:true});

installSingleRowHeader();
loadPersistentMarketLayer();
PERF.header='single-row-global-shell-v1';
PERF.header_variant='premium-minimal-v2';
PERF.row_limit=()=>innerWidth<=680?70:innerWidth<=1100?90:140;
PERF.observer_policy='hot-dom-periodic-1200ms';
PERF.market_dom_flush_ms=500;
PERF.book_flush_ms=320;
PERF.trade_flush_ms=250;
PERF.persistent_market_workspaces='css-core-router-v3';
window.RWAMarketPerformanceGuard=PERF;
})();