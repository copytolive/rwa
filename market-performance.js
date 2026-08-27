(()=>{
'use strict';
if(window.RWAMarketPerformanceGuard)return;

const PERF={version:'1.3.4',runtime:'root-terminal-low-jank-v1',enterprise_ui:'12.0.0'};
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
    const l=document.createElement('link');l.rel='stylesheet';l.href='persistent-market-operability-patch-v1.css?v=11';l.dataset.rwaPersistentMarketOperability='1';document.head.appendChild(l);
  }
  if(!document.querySelector('link[data-rwa-enterprise-ui-v12]')){
    const l=document.createElement('link');l.rel='stylesheet';l.href='enterprise-ui-v12.css?v=12';l.dataset.rwaEnterpriseUiV12='1';document.head.appendChild(l);
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

/* ENTERPRISE UI V12 — runtime enhancement stays inside an existing root script so the
   canonical external-script budget remains unchanged. */
const SVG={
  search:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"></circle><path d="m16 16 4 4"></path></svg>',
  watch:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 3Z"></path></svg>',
  bell:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.5 9.5a5.5 5.5 0 0 1 11 0c0 6 2.5 6.5 2.5 6.5H4s2.5-.5 2.5-6.5"></path><path d="M10 19h4"></path></svg>',
  share:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 5h5v5"></path><path d="m19 5-8 8"></path><path d="M19 13v5a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5"></path></svg>',
  user:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3.5"></circle><path d="M5.5 20a6.5 6.5 0 0 1 13 0"></path></svg>',
  markets:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 18V9"></path><path d="M9 18V5"></path><path d="M14 18v-7"></path><path d="M19 18V7"></path></svg>',
  trade:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h13"></path><path d="m15 4 3 3-3 3"></path><path d="M19 17H6"></path><path d="m9 14-3 3 3 3"></path></svg>',
  social:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="8" cy="9" r="3"></circle><circle cx="17" cy="7" r="2.5"></circle><path d="M3.5 19a4.5 4.5 0 0 1 9 0"></path><path d="M14 17a3.5 3.5 0 0 1 6.5 1.8"></path></svg>',
  portfolio:'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="6" width="16" height="13" rx="2"></rect><path d="M9 6V4h6v2"></path><path d="M4 11h16"></path></svg>',
  chevron:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8 10 4 4 4-4"></path></svg>'
};
function setDebugMode(){
  try{document.documentElement.dataset.rwaDebug=new URLSearchParams(location.search).get('debug')==='1'?'1':'0'}catch{document.documentElement.dataset.rwaDebug='0'}
}
function upgradeViewportMeta(){
  const m=document.querySelector('meta[name="viewport"]');if(!m)return;
  const parts=String(m.content||'').split(',').map(x=>x.trim()).filter(Boolean).filter(x=>!/^user-scalable=/i.test(x));
  if(!parts.some(x=>/^maximum-scale=/i.test(x)))parts.push('maximum-scale=5');
  m.content=parts.join(',');
}
function upgradeNavSemantics(){
  document.querySelectorAll('.topnav span[data-v5-route],.product-nav span[data-v5-route]').forEach(s=>{
    const b=document.createElement('button');b.type='button';b.className=s.className;b.textContent=s.textContent;
    for(const [k,v] of Object.entries(s.dataset))b.dataset[k]=v;
    if(s.classList.contains('active'))b.setAttribute('aria-current','page');
    s.replaceWith(b);
  });
  document.querySelectorAll('.topnav [data-v5-route],.product-nav [data-v5-route]').forEach(b=>{
    if(b.classList.contains('active'))b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');
  });
}
function upgradeIcons(){
  const command=document.querySelector('.rwa-command-button');if(command){const i=command.querySelector('span:first-child');if(i&&!i.querySelector('svg'))i.innerHTML=SVG.search}
  document.querySelectorAll('.instrument-actions button').forEach(b=>{
    if(b.dataset.rwaV12Icon)return;const t=(b.textContent||'').trim().toLowerCase();
    const label=t.includes('watch')?'Watch':t.includes('alert')?'Alert':t.includes('share')?'Share':'';if(!label)return;
    b.dataset.rwaV12Icon='1';b.innerHTML=(label==='Watch'?SVG.watch:label==='Alert'?SVG.bell:SVG.share)+`<span>${label}</span>`;
  });
  const notice=document.querySelector('[data-v5-action="notifications"]');if(notice&&!notice.querySelector('svg'))notice.innerHTML=SVG.bell;
  const profile=document.querySelector('[data-v5-action="profile"]');if(profile&&!profile.querySelector('svg'))profile.innerHTML=SVG.user;
  const map={markets:'markets',search:'search',trade:'trade',social:'social',portfolio:'portfolio'};
  document.querySelectorAll('.mobile-tabs [data-v5-mobile]').forEach(n=>{const s=n.querySelector('span');const key=map[n.dataset.v5Mobile];if(s&&key&&!s.querySelector('svg'))s.innerHTML=SVG[key]});
}
function professionalizeTradeChrome(){
  document.querySelectorAll('#rwaExchange button,#rwaExchange span,#terminal button,#terminal span').forEach(el=>{
    const t=(el.textContent||'').trim().toUpperCase();
    if(t==='CHECK'){el.dataset.rwaV12Engineering='hidden';return}
    if(t==='TESTNET'&&!el.dataset.rwaV12Env){el.textContent='SANDBOX';el.classList.add('rwa-env-badge');el.dataset.rwaV12Env='1'}
  });
}
function syncMobileInstrumentStrip(){
  const strip=document.getElementById('rwaMobileInstrumentStrip');if(!strip)return;
  const name=(document.getElementById('selName')?.textContent||'BTC / USDT').trim();
  const base=(name.split(/[\/\s]/)[0]||'BTC').toUpperCase();
  const priceText=(document.getElementById('statPrice')?.textContent||'—').trim();
  const change=document.getElementById('statChange');const changeText=(change?.textContent||'—').trim();
  const n=strip.querySelector('[data-rwa-mobile-name]'),i=strip.querySelector('[data-rwa-mobile-token]'),p=strip.querySelector('[data-rwa-mobile-price]'),c=strip.querySelector('[data-rwa-mobile-change]');
  if(n)n.textContent=name;if(i)i.textContent=base.slice(0,2);if(p)p.textContent=priceText;if(c){c.textContent=changeText;c.classList.toggle('up',!changeText.startsWith('-'));c.classList.toggle('down',changeText.startsWith('-'))}
}
function installMobileInstrumentStrip(){
  const chart=document.querySelector('.chart-wrap');if(!chart)return;
  let strip=document.getElementById('rwaMobileInstrumentStrip');
  if(!strip){
    strip=document.createElement('section');strip.id='rwaMobileInstrumentStrip';strip.className='rwa-mobile-instrument-strip';strip.setAttribute('aria-label','Selected market');
    strip.innerHTML=`<div class="rwa-mobile-instrument-main"><div class="rwa-mobile-instrument-token" data-rwa-mobile-token>BT</div><div class="rwa-mobile-instrument-copy"><b data-rwa-mobile-name>BTC / USDT</b><small>Live market</small></div></div><div class="rwa-mobile-instrument-values"><div><b data-rwa-mobile-price>—</b><span data-rwa-mobile-change>—</span></div><button type="button" data-rwa-mobile-pair aria-label="Choose market">${SVG.chevron}</button></div>`;
    chart.before(strip);
    strip.querySelector('[data-rwa-mobile-pair]')?.addEventListener('click',()=>{document.body.classList.add('market-drawer-open');document.getElementById('search')?.focus?.({preventScroll:true})});
  }
  syncMobileInstrumentStrip();
}
function reconcileEnterpriseUI(){
  setDebugMode();upgradeViewportMeta();upgradeNavSemantics();upgradeIcons();installMobileInstrumentStrip();syncMobileInstrumentStrip();professionalizeTradeChrome();
  document.documentElement.dataset.rwaEnterpriseUi='12';
}
let pairUnlock=0;
document.addEventListener('click',e=>{
  const row=e.target.closest?.('.pairrow[data-sym]');if(!row)return;
  const route=String(document.documentElement.dataset.rwaRoute||'');
  if(!route.startsWith('asset')&&!document.body.classList.contains('rwa-super-asset-workspace'))return;
  clearTimeout(pairUnlock);document.documentElement.dataset.rwaPairTransition='1';
  document.body.classList.add('rwa-super-asset-workspace','rwa-super-workspace-open');
  pairUnlock=setTimeout(()=>{delete document.documentElement.dataset.rwaPairTransition},700);
},true);

installSingleRowHeader();
loadPersistentMarketLayer();
reconcileEnterpriseUI();
setTimeout(reconcileEnterpriseUI,250);setTimeout(reconcileEnterpriseUI,900);setTimeout(reconcileEnterpriseUI,2200);
const enterpriseTimer=setInterval(()=>{if(!document.hidden)reconcileEnterpriseUI()},1600);
window.addEventListener('hashchange',()=>setTimeout(reconcileEnterpriseUI,0));
window.addEventListener('beforeunload',()=>clearInterval(enterpriseTimer),{once:true});
PERF.header='single-row-global-shell-v1';
PERF.header_variant='premium-minimal-v2';
PERF.row_limit=()=>innerWidth<=680?70:innerWidth<=1100?90:140;
PERF.observer_policy='hot-dom-periodic-1200ms';
PERF.market_dom_flush_ms=500;
PERF.book_flush_ms=320;
PERF.trade_flush_ms=250;
PERF.persistent_market_workspaces='css-core-router-v3';
PERF.asset_pair_geometry='route-owned-440px-v12';
PERF.mobile_nav='five-column-enterprise-v12';
window.RWAMarketPerformanceGuard=PERF;
})();