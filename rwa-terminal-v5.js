(()=>{
'use strict';
if(window.RWATerminalV5)return;
const VERSION='1.0.0', $=s=>document.querySelector(s), qa=s=>[...document.querySelectorAll(s)];
const LS={fav:'rwa_v5_favorites',thesis:'rwa_v5_theses',alerts:'rwa_v5_alerts'};
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
const num=v=>{const n=Number(v);return Number.isFinite(n)?n:0};
const money=v=>Number.isFinite(Number(v))?'$'+Number(v).toLocaleString(undefined,{maximumFractionDigits:2}):'—';
const pct=v=>Number.isFinite(Number(v))?(Number(v)>=0?'+':'')+Number(v).toFixed(2)+'%':'—';
const compact=v=>{const n=num(v),a=Math.abs(n);return a>=1e9?'$'+(n/1e9).toFixed(2)+'B':a>=1e6?'$'+(n/1e6).toFixed(2)+'M':a>=1e3?'$'+(n/1e3).toFixed(1)+'K':money(n)};
const shortWallet=v=>{const s=String(v||'').trim();return /^0x[a-fA-F0-9]{40}$/.test(s)?s.slice(0,6)+'…'+s.slice(-4):(s||'Market signal')};
const store={get(k,d){try{const v=JSON.parse(localStorage.getItem(k)||'null');return v??d}catch{return d}},set(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch{}}};
let leftMode='watchlist',bottomMode='positions',mobileMode='chart',tradeSide='BUY',lastPair='',lastExchangeStamp=0,alertTimer=0,renderTimer=0,serviceTimer=0,serverReady=false,serverSession=false,serverAlerts=[],serverFeed=[],serverRewards=null,serverHolders=null,serverServiceError='';
function market(){try{return window.RWAMarketRuntime?.state?.()||null}catch{return null}}
function exchange(){try{return window.RWAExchangeCore?.state?.()||null}catch{return null}}
function pair(){const s=market(),sym=s?.selected||'BTCUSDT';return s?.pairs?.find(x=>x.symbol===sym)||{symbol:sym,base:String(sym).replace(/USDT$/,''),quote:'USDT',price:0,change:0,vol:0,rwa:false}}
function selected(){return pair().symbol}
function base(){return pair().base||String(selected()).replace(/USDT$/,'')}
function toast(t){try{typeof window.toast==='function'?window.toast(t):console.info(t)}catch{}}
function keepMarket(){try{history.replaceState(history.state,'',location.pathname+location.search+'#markets')}catch{}}
function favorites(){return store.get(LS.fav,[]).filter(Boolean)}
function theses(){return store.get(LS.thesis,[]).filter(Boolean)}
function alerts(){return store.get(LS.alerts,[]).filter(Boolean)}
function visibleAlerts(){return serverReady&&serverSession?serverAlerts:alerts()}
async function syncService(force=false){
 const svc=window.RWATerminalService;if(!svc){serverReady=false;serverServiceError='client_unavailable';return false}
 try{const st=await svc.status();serverReady=!!(st?.enabled&&st?.ready?.ok);serverServiceError=serverReady?'':String(st?.ready?.error||'service_not_ready');return serverReady}catch(e){serverReady=false;serverServiceError=String(e?.message||e);return false}
}
async function syncServerAlerts({interactive=false}={}){
 if(!await syncService())return false;if(!window.RWAWalletAuth?.isLoggedIn?.())return false;
 try{const r=await window.RWATerminalService.alerts.list();serverAlerts=Array.isArray(r?.alerts)?r.alerts:[];serverSession=true;renderAlertCount();if(!$('[data-v5-alerts]')?.hidden)renderAlerts();return true}catch(e){if(interactive)toast(String(e?.message||e));serverServiceError=String(e?.message||e);return false}
}
async function syncServerFeed(){if(!await syncService())return false;try{const r=await window.RWATerminalService.social.feed(50);serverFeed=Array.isArray(r?.posts)?r.posts:[];if(bottomMode==='feed'||leftMode==='feed')renderBottom();return true}catch(e){serverServiceError=String(e?.message||e);return false}}
function setActive(selector,value,attr='v5Nav'){qa(selector).forEach(b=>b.classList.toggle('active',b.dataset[attr]===value))}
function unlockLegacyGeometry(){
 const props=['position','inset','left','right','top','bottom','width','min-width','max-width','height','min-height','max-height','display','grid-template-columns','grid-template-rows','overflow','margin','padding','transform','box-sizing'];
 for(const el of [document.documentElement,document.body,$('.app'),$('.topbar'),$('.layout'),$('.left'),$('.main'),$('.right'),$('#liveRail')].filter(Boolean))for(const p of props)el.style.removeProperty(p)
}
function lockV5Geometry(){
 if(innerWidth<1281)return;
 const imp=(el,p,v)=>el?.style?.setProperty(p,v,'important'),top=$('.topbar'),layout=$('.layout'),left=$('.layout>.left'),main=$('.layout>.main'),right=$('.layout>.right'),trade=$('#liveRail'),bottom=$('#rwaV5Bottom'),footer=$('#rwaV5Footer'),app=$('.app');
 for(const root of [document.documentElement,document.body]){imp(root,'width','100vw');imp(root,'height','100vh');imp(root,'overflow','hidden')}
 imp(app,'width','100vw');imp(app,'height','100vh');imp(app,'overflow','hidden');imp(app,'padding','0');
 imp(top,'position','fixed');imp(top,'inset','0 0 auto 0');imp(top,'width','100vw');imp(top,'height','55px');imp(top,'min-height','55px');imp(top,'max-height','55px');imp(top,'box-sizing','border-box');
 imp(layout,'position','fixed');imp(layout,'inset','55px 0 28px 0');imp(layout,'width','100vw');imp(layout,'height','calc(100vh - 83px)');imp(layout,'min-height','0');imp(layout,'margin','0');imp(layout,'padding','0');imp(layout,'display','grid');imp(layout,'grid-template-columns','238px minmax(0,1fr) 250px 300px');imp(layout,'grid-template-rows','minmax(0,1fr) 220px');imp(layout,'overflow','hidden');imp(layout,'box-sizing','border-box');
 for(const el of [left,main,right,trade,bottom]){imp(el,'position','relative');imp(el,'inset','auto');imp(el,'margin','0');imp(el,'transform','none');imp(el,'min-height','0');imp(el,'max-height','none');imp(el,'box-sizing','border-box')}
 imp(left,'grid-column','1');imp(left,'grid-row','1 / 3');imp(left,'width','238px');imp(left,'min-width','238px');imp(left,'max-width','238px');imp(left,'height','100%');
 imp(main,'grid-column','2');imp(main,'grid-row','1');imp(main,'width','auto');imp(main,'min-width','0');imp(main,'height','100%');imp(main,'display','grid');imp(main,'grid-template-rows','74px minmax(0,1fr)');imp(main,'overflow','hidden');
 imp(right,'grid-column','3');imp(right,'grid-row','1');imp(right,'width','250px');imp(right,'min-width','250px');imp(right,'max-width','250px');imp(right,'height','100%');imp(right,'overflow','hidden');
 imp(trade,'grid-column','4');imp(trade,'grid-row','1 / 3');imp(trade,'width','300px');imp(trade,'min-width','300px');imp(trade,'max-width','300px');imp(trade,'height','100%');imp(trade,'overflow','hidden');
 imp(bottom,'grid-column','2 / 4');imp(bottom,'grid-row','2');imp(bottom,'width','auto');imp(bottom,'height','220px');imp(bottom,'min-height','220px');imp(bottom,'max-height','220px');imp(bottom,'overflow','hidden');
 imp(footer,'position','fixed');imp(footer,'left','0');imp(footer,'right','0');imp(footer,'bottom','0');imp(footer,'width','100vw');imp(footer,'height','28px');imp(footer,'min-height','28px');imp(footer,'max-height','28px')
}
function ensureHeader(){
 const nav=$('.topnav');if(nav){nav.dataset.v5='1';nav.innerHTML='<button data-v5-global="markets" data-rwa-target-nav="markets" class="active" aria-current="page">Markets</button>'}
 const top=$('.topbar');if(top&&!$('#rwaV5GlobalSearch')){const box=document.createElement('div');box.id='rwaV5GlobalSearch';box.className='rwa-v5-search';box.innerHTML='<span>⌕</span><input type="search" autocomplete="off" placeholder="Search tokens or markets…" aria-label="Search tokens or markets"><kbd>⌘K</kbd><div class="rwa-v5-search-results" hidden></div>';top.insertBefore(box,$('.top-actions'));const input=box.querySelector('input');input.addEventListener('input',renderSearch);input.addEventListener('focus',renderSearch);input.addEventListener('keydown',e=>{if(e.key==='Escape'){box.querySelector('.rwa-v5-search-results').hidden=true;input.blur()}})}
 const brand=$('.brand');if(brand&&!brand.dataset.v5){brand.dataset.v5='1';brand.addEventListener('click',e=>{e.preventDefault();keepMarket();setBottom('positions');setMobile('chart')})}
}
function ensureTargetHeaderStats(){
 const h=$('.terminal-header'),qs=h?.querySelector('.quickstats');if(!h||!qs)return;
 if(!h.querySelector('.rwa-v5-asset-badges')){const copy=h.querySelector('.instrument-copy');if(copy){const badges=document.createElement('div');badges.className='rwa-v5-asset-badges';badges.innerHTML='<span data-v5-asset-kind>Spot</span><span data-v5-asset-network>Live Market</span>';copy.appendChild(badges)}}
 const acts=h.querySelector('.instrument-actions');if(acts&&!acts.querySelector('[data-v5-mobile-wallet]')){const b=document.createElement('button');b.type='button';b.dataset.v5MobileWallet='1';b.setAttribute('aria-label','Connect wallet');b.textContent='◎';acts.appendChild(b)}
 if(!qs.querySelector('[data-v5-stat="market-cap"]')){const mk=document.createElement('div');mk.className='qstat rwa-v5-extra-stat';mk.dataset.v5Stat='market-cap';mk.innerHTML='<small>Market Cap</small><b>—</b>';qs.appendChild(mk)}
 if(!qs.querySelector('[data-v5-stat="liquidity"]')){const li=document.createElement('div');li.className='qstat rwa-v5-extra-stat';li.dataset.v5Stat='liquidity';li.innerHTML='<small>Liquidity</small><b>—</b>';qs.appendChild(li)}
 if(!qs.querySelector('[data-v5-stat="holders"]')){const ho=document.createElement('div');ho.className='qstat rwa-v5-extra-stat';ho.dataset.v5Stat='holders';ho.innerHTML='<small>Holders</small><b>—</b>';qs.appendChild(ho)}
 const price=$('#statPrice')?.closest('.qstat'),change=$('#statChange')?.closest('.qstat'),vol=$('#statVol')?.closest('.qstat');
 if(price)price.querySelector('small').textContent='Price';
 if(change)change.querySelector('small').textContent='24h Change';
 if(vol)vol.querySelector('small').textContent='24h Volume'
}
function renderTargetHeaderStats(){
 ensureTargetHeaderStats();const p=pair(),fmt=window.RWAMarketRuntime?.format;
 const kind=$('[data-v5-asset-kind]'),net=$('[data-v5-asset-network]');
 if(kind)kind.textContent=p.rwa?'RWA':'Spot';if(net)net.textContent=p.rwa?'Real World Asset':'Live Market';
 const cap=$('[data-v5-stat="market-cap"] b'),liq=$('[data-v5-stat="liquidity"] b'),hold=$('[data-v5-stat="holders"] b');
 if(cap)cap.textContent='—';if(liq)liq.textContent='—';
 if(hold){const h=serverHolders;hold.textContent=h?.available&&Array.isArray(h.holders)?Intl.NumberFormat('en',{notation:'compact',maximumFractionDigits:1}).format(h.holders.length):'—'}
 const icon=$('#selIcon');if(icon)icon.setAttribute('aria-label',p.base+' market');
 const label=$('#selLabel');if(label)label.textContent=(p.rwa?'RWA-linked · ':'')+'Binance Spot';
}
function pruneLegacyUi(){
 for(const sel of ['.productbar','.trustbar','.social-screen','.suite-screen','.mobile-home','.mobile-tabs','#rwaExperienceRail','#rwaContextBrief','#rwaQualityBadge','#rwaQualityPanel','#rwaMobileAssetActions','#rwaSuperWorkspace','#rwaQuickDock','#rwaGlobalTicker'])qa(sel).forEach(x=>x.remove())
}
function renderSearch(){
 const box=$('#rwaV5GlobalSearch'),input=box?.querySelector('input'),out=box?.querySelector('.rwa-v5-search-results');if(!input||!out)return;
 const q=input.value.trim().toUpperCase(),pairs=market()?.pairs||[];if(!q){out.hidden=true;out.innerHTML='';return}
 const rows=pairs.filter(x=>x.symbol.includes(q)||x.base.includes(q)).slice(0,10);
 out.innerHTML=rows.length?rows.map(x=>'<button data-v5-symbol="'+esc(x.symbol)+'"><b>'+esc(x.base)+'/USDT</b><span>'+esc(window.RWAMarketRuntime?.format?.price?.(x.price)||String(x.price||'—'))+'</span><i class="'+(num(x.change)>=0?'pos':'neg')+'">'+pct(x.change)+'</i></button>').join(''):'<div class="rwa-v5-empty">No live market match</div>';out.hidden=false
}
function ensureLeft(){
 const left=$('.left');if(!left)return;
 if(!left.querySelector('.rwa-v5-left-tabs')){const tabs=document.createElement('nav');tabs.className='rwa-v5-left-tabs';tabs.innerHTML='<button class="active" data-v5-left="watchlist">Watchlist</button><button data-v5-left="feed">Feed</button><button data-v5-left="pulse">Pulse</button><button data-v5-left="live">LIVE <i></i></button>';left.prepend(tabs)}
 if(!left.querySelector('[data-v5-left-pane="watchlist"]')){const pane=document.createElement('section');pane.className='rwa-v5-left-pane';pane.dataset.v5LeftPane='watchlist';const nodes=[left.querySelector('.aside-label'),left.querySelector('.market-head'),left.querySelector('.rwa-pair-head'),left.querySelector('.pairlist')].filter(Boolean);nodes.forEach(n=>pane.appendChild(n));left.appendChild(pane)}
 for(const mode of ['feed','pulse','live'])if(!left.querySelector('[data-v5-left-pane="'+mode+'"]')){const pane=document.createElement('section');pane.className='rwa-v5-left-pane rwa-v5-dynamic-pane';pane.dataset.v5LeftPane=mode;pane.hidden=true;left.appendChild(pane)}
 const watch=left.querySelector('[data-v5-left-pane="watchlist"]');if(watch&&!watch.querySelector('[data-v5-watch-target]')){const target=document.createElement('section');target.className='rwa-v5-watch-target';target.dataset.v5WatchTarget='1';watch.prepend(target)}
}
function renderLeft(){
 qa('[data-v5-left-pane]').forEach(p=>p.hidden=p.dataset.v5LeftPane!==leftMode);setActive('.rwa-v5-left-tabs [data-v5-left]',leftMode,'v5Left');
 const s=market(),pairs=s?.pairs||[],fmt=window.RWAMarketRuntime?.format;
 const feed=$('[data-v5-left-pane="feed"]'),pulse=$('[data-v5-left-pane="pulse"]'),live=$('[data-v5-left-pane="live"]'),watch=$('[data-v5-left-pane="watchlist"]'),target=$('[data-v5-watch-target]');
 if(watch&&!watch.hidden&&target){
  const movers=[...pairs].filter(x=>Number.isFinite(num(x.change))).sort((a,b)=>Math.abs(num(b.change))-Math.abs(num(a.change))).slice(0,3);
  const signed=serverFeed.slice(0,4),local=theses().slice(-4).reverse();
  const posts=signed.length?signed.map(p=>({wallet:p.wallet||'Signed wallet',symbol:p.symbol||'',side:p.side||'',text:p.text||'',ts:p.createdAt||p.ts||Date.now(),signed:true})):local.map(p=>({wallet:'Local thesis',symbol:p.symbol||'',side:p.side||'',text:p.text||'',ts:p.ts||Date.now(),signed:false}));
  const fallback=movers.slice(0,3).map(x=>({wallet:'Market signal',symbol:x.symbol,side:num(x.change)>=0?'Bullish':'Bearish',text:(num(x.change)>=0?'Positive':'Negative')+' 24h move '+pct(x.change)+' · verified live market data.',ts:Date.now(),signed:false,market:true}));
  const rows=posts.length?posts:fallback;
  target.innerHTML='<div class="rwa-v5-target-section"><header><b>Top Movers</b><span>24h⌄</span></header><div class="rwa-v5-target-movers">'+movers.map(x=>'<button data-v5-symbol="'+esc(x.symbol)+'"><span><i>'+esc(x.base.slice(0,2))+'</i><b>'+esc(x.base)+'/USDT</b><small>'+(x.rwa?'Real World Asset':'Live market')+'</small></span><strong class="'+(num(x.change)>=0?'pos':'neg')+'">'+pct(x.change)+'</strong></button>').join('')+'</div><button class="rwa-v5-view-watch" data-v5-watch-expand>View all watchlist</button></div><div class="rwa-v5-target-section rwa-v5-discussions"><header><b>Signals & Discussions</b><span>'+(serverReady?'Signed':'Live')+'⌄</span></header><div class="rwa-v5-target-posts">'+rows.map(p=>'<article><header><span><i>'+esc(String(p.wallet||'M').slice(0,2).toUpperCase())+'</i><b>'+esc(shortWallet(p.wallet||'Market signal'))+'</b>'+(p.signed?'<em>✓</em>':'')+'</span><small>'+new Date(p.ts||Date.now()).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})+'</small></header><p>'+esc(p.text||'')+'</p><footer><span>'+esc((p.side||'Signal').toUpperCase())+'</span>'+(p.symbol?'<button data-v5-symbol="'+esc(p.symbol)+'">'+esc(String(p.symbol).replace(/USDT$/,'/USDT'))+'</button>':'')+'</footer></article>').join('')+'</div><button class="rwa-v5-post-idea" data-v5-bottom="thesis">Post an idea</button></div>'
 }
 if(feed&&!feed.hidden){const local=theses().slice(0,5),moves=[...pairs].filter(x=>Number.isFinite(num(x.change))).sort((a,b)=>Math.abs(num(b.change))-Math.abs(num(a.change))).slice(0,5);feed.innerHTML='<div class="rwa-v5-pane-head"><b>Signals & Discussions</b><button data-v5-bottom="thesis">Post an idea</button></div>'+(local.length?local.map(t=>'<article class="rwa-v5-signal"><header><b>Local thesis · '+esc(t.side)+'</b><small>'+new Date(t.ts).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})+'</small></header><p>'+esc(t.text)+'</p><button data-v5-symbol="'+esc(t.symbol)+'">'+esc(t.symbol.replace(/USDT$/,'/USDT'))+'</button></article>').join(''):'<div class="rwa-v5-empty">No local thesis yet. Live market signals appear below.</div>')+'<div class="rwa-v5-signal-list">'+moves.map(x=>'<button data-v5-symbol="'+esc(x.symbol)+'"><span>MOVE</span><b>'+esc(x.base)+'/USDT</b><i class="'+(num(x.change)>=0?'pos':'neg')+'">'+pct(x.change)+'</i></button>').join('')+'</div>'}
 if(pulse&&!pulse.hidden){const rows=[...pairs].filter(x=>Number.isFinite(num(x.change))).sort((a,b)=>Math.abs(num(b.change))-Math.abs(num(a.change))).slice(0,12);pulse.innerHTML='<div class="rwa-v5-pane-head"><b>Top Movers</b><span>24h</span></div><div class="rwa-v5-mover-list">'+rows.map(x=>'<button data-v5-symbol="'+esc(x.symbol)+'"><span><b>'+esc(x.base)+'/USDT</b><small>'+compact(x.vol)+'</small></span><strong class="'+(num(x.change)>=0?'pos':'neg')+'">'+pct(x.change)+'</strong></button>').join('')+'</div>'}
 if(live&&!live.hidden){const rows=(s?.recentTrades||[]).slice(0,18);live.innerHTML='<div class="rwa-v5-pane-head"><b>LIVE</b><span class="rwa-v5-live-state"><i></i> market stream</span></div>'+(rows.length?'<div class="rwa-v5-live-list">'+rows.map(t=>'<div><span class="'+(t.buy?'pos':'neg')+'">'+(t.buy?'BUY':'SELL')+'</span><b>'+esc(base())+'/USDT</b><strong>'+esc(fmt?.price?.(t.p)||String(t.p))+'</strong><small>'+new Date(t.time||Date.now()).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit',second:'2-digit'})+'</small></div>').join('')+'</div>':'<div class="rwa-v5-empty">Waiting for verified live trades…</div>')}
 const fav=favorites();qa('#pairList .pairrow').forEach(r=>r.classList.toggle('rwa-v5-favorite',fav.includes(r.dataset.sym)))
}
function setTradeSide(side){
 side=String(side||'BUY').toUpperCase()==='SELL'?'SELL':'BUY';tradeSide=side;
 const ticket=$('#rwaTargetOrderTicket');if(ticket){ticket.dataset.v5Side=side;ticket.setAttribute('aria-label',side==='SELL'?'Sell / Short order ticket':'Buy / Long order ticket')}
 qa('.rwa-v5-side-switch [data-v5-side]').forEach(b=>{const on=b.dataset.v5Side===side;b.classList.toggle('active',on);b.setAttribute('aria-pressed',String(on))});
 return side
}
function ensureTrade(){
 const rail=$('#liveRail'),ticket=$('#rwaTargetOrderTicket');if(!rail||!ticket)return;
 if(rail.dataset.v5Trade!=='1'){rail.dataset.v5Trade='1';rail.dataset.mode='trade';rail.innerHTML='<nav class="rwa-v5-market-nav" aria-label="Market workspace"><button class="active" data-v5-nav="trade">Trade</button><button data-v5-nav="portfolio">Portfolio</button><button data-v5-nav="orders">Orders</button><button data-v5-nav="analytics">Analytics</button><button data-v5-nav="rewards">Rewards</button><button data-v5-nav="more" aria-haspopup="menu">More⌄</button><div class="rwa-v5-more" data-v5-more-menu hidden><button data-v5-nav="discover">Discover</button><button data-v5-bottom="holders">Holders</button><button data-v5-bottom="feed">Feed</button><button data-v5-bottom="thesis">Thesis</button><button data-v5-bottom="history">History</button><button data-v5-action="network">Network</button></div></nav><header class="rwa-v5-trade-head"><nav><button class="active" data-v5-trade-tab="trade">Trade</button><button data-v5-trade-tab="alerts">Alerts <span data-v5-alert-count>0</span></button></nav><button data-v5-action="trade-more">•••</button></header><div class="rwa-v5-trade-host"></div><section class="rwa-v5-alerts" data-v5-alerts hidden></section>';rail.querySelector('.rwa-v5-trade-host').appendChild(ticket)}
 let sw=ticket.querySelector('.rwa-v5-side-switch');
 if(!sw){sw=document.createElement('div');sw.className='rwa-v5-side-switch';sw.innerHTML='<button type="button" class="active" data-v5-side="BUY" aria-pressed="true">Buy / Long</button><button type="button" data-v5-side="SELL" aria-pressed="false">Sell / Short</button>';const modes=ticket.querySelector('.rwa-target-order-modes');ticket.insertBefore(sw,modes||ticket.firstChild);sw.addEventListener('click',e=>{const b=e.target.closest('[data-v5-side]');if(!b)return;e.preventDefault();e.stopPropagation();setTradeSide(b.dataset.v5Side)})}
 setTradeSide(tradeSide);renderAlertCount()
}
function renderAlertCount(){const n=visibleAlerts().filter(a=>!a.triggered).length;qa('[data-v5-alert-count]').forEach(x=>x.textContent=String(n));const icon=$('[data-live-top-action="alerts"]');if(icon)icon.dataset.count=String(n)}
function openAlerts(){
 ensureTrade();const rail=$('#liveRail');if(!rail)return;
 rail.querySelector('.rwa-v5-trade-host').hidden=true;const pane=rail.querySelector('[data-v5-alerts]');pane.hidden=false;setActive('[data-v5-trade-tab]','alerts','v5TradeTab');renderAlerts();if(serverReady&&window.RWAWalletAuth?.isLoggedIn?.())syncServerAlerts();if(innerWidth<681)setMobile('trade')
}
function openTrade(){
 ensureTrade();const rail=$('#liveRail');if(!rail)return;
 rail.querySelector('.rwa-v5-trade-host').hidden=false;rail.querySelector('[data-v5-alerts]').hidden=true;setActive('[data-v5-trade-tab]','trade','v5TradeTab');if(innerWidth<681)setMobile('trade')
}
function renderAlerts(){
 const pane=$('[data-v5-alerts]');if(!pane)return;const list=visibleAlerts(),p=pair(),serverMode=serverReady&&serverSession;
 pane.innerHTML='<div class="rwa-v5-alert-compose"><small>'+(serverMode?'SERVER ALERT 24/7':'LOCAL BROWSER ALERT')+' · '+esc(p.base)+'/USDT</small><label>Trigger price<input type="number" step="any" data-v5-alert-price placeholder="'+esc(String(p.price||''))+'"></label><div class="rwa-v5-alert-dir"><button class="active" data-v5-alert-dir="above">Above</button><button data-v5-alert-dir="below">Below</button></div><button class="primary" data-v5-create-alert>Create alert</button><p>'+(serverMode?'Stored and evaluated by the signed RWA terminal backend.':'Runs only while this browser session is active. Connect wallet + terminal backend for 24/7 alerts.')+'</p></div><div class="rwa-v5-alert-list">'+(list.length?list.slice().reverse().map(a=>'<div class="'+(a.triggered?'done':'')+'"><span><b>'+esc(a.symbol.replace(/USDT$/,'/USDT'))+'</b><small>'+esc(a.direction||a.dir)+' '+esc(String(a.price))+(a.triggered?' · triggered':'')+'</small></span><button data-v5-delete-alert="'+esc(a.id)+'">×</button></div>').join(''):'<div class="rwa-v5-empty">No alerts configured.</div>')+'</div>'
}
async function createAlert(){
 const pane=$('[data-v5-alerts]'),input=pane?.querySelector('[data-v5-alert-price]'),price=num(input?.value);if(!(price>0)){toast('Enter a valid alert price');return}
 const dir=pane.querySelector('[data-v5-alert-dir].active')?.dataset.v5AlertDir||'above';
 if(await syncService()&&window.RWAWalletAuth?.isLoggedIn?.()){
  try{await window.RWATerminalService.alerts.create({symbol:selected(),price,direction:dir});serverSession=true;await syncServerAlerts({interactive:true});toast('24/7 server alert created');return}catch(e){toast(String(e?.message||e));return}
 }
 const list=alerts();list.push({id:String(Date.now()),symbol:selected(),price,dir,created:Date.now(),triggered:false});store.set(LS.alerts,list);renderAlerts();renderAlertCount();toast('Local browser alert created')
}
async function deleteAlert(id){
 if(serverReady&&serverSession){try{await window.RWATerminalService.alerts.delete(id);await syncServerAlerts({interactive:true});toast('Server alert deleted');return}catch(e){toast(String(e?.message||e));return}}
 store.set(LS.alerts,alerts().filter(a=>a.id!==id));renderAlerts();renderAlertCount()
}
async function monitorAlerts(){
 if(serverReady){if(window.RWAWalletAuth?.isLoggedIn?.())syncServerAlerts();return}
 const p=pair();if(!(num(p.price)>0))return;let changed=false;const list=alerts().map(a=>{if(a.triggered||a.symbol!==p.symbol)return a;const hit=(a.direction||a.dir)==='below'?num(p.price)<=num(a.price):num(p.price)>=num(a.price);if(!hit)return a;changed=true;toast('Alert · '+a.symbol+' '+(a.direction||a.dir)+' '+a.price);try{if(Notification?.permission==='granted')new Notification('RWA market alert',{body:a.symbol+' '+(a.direction||a.dir)+' '+a.price})}catch{}return{...a,triggered:true,triggeredAt:Date.now()}});if(changed){store.set(LS.alerts,list);renderAlertCount();if(!$('[data-v5-alerts]')?.hidden)renderAlerts()}
}
function ensureBottom(){
 const layout=$('.layout');if(!layout)return;
 let root=$('#rwaV5Bottom');if(!root){root=document.createElement('section');root.id='rwaV5Bottom';root.className='rwa-v5-bottom';root.innerHTML='<nav><button class="active" data-v5-bottom="positions">Positions <span data-v5-position-count>0</span></button><button data-v5-bottom="orders">Open Orders <span data-v5-order-count>0</span></button><button data-v5-bottom="holders">Holders</button><button data-v5-bottom="feed">Feed</button><button data-v5-bottom="analytics">Analytics</button><button data-v5-bottom="thesis">Thesis</button><button data-v5-bottom="history">History</button></nav><div class="rwa-v5-bottom-body" data-v5-bottom-body></div>';layout.appendChild(root)}
}
function accountLocked(title){return '<div class="rwa-v5-lock"><b>'+esc(title)+'</b><p>Connect a wallet to load verified Hyperliquid account data. No placeholder balances or positions are shown.</p><button class="signin">Connect Wallet</button></div>'}
function positionRows(rows){if(!rows?.length)return '<div class="rwa-v5-empty">No open Hyperliquid positions.</div>';return '<div class="rwa-v5-table"><div class="head"><span>Market</span><span>Size</span><span>Entry</span><span>Mark</span><span>PnL</span><span>Risk</span></div>'+rows.slice(0,30).map(p=>'<div><b>'+esc(p.coin||'—')+'</b><span>'+esc(String(p.szi??'—'))+'</span><span>'+esc(String(p.entryPx??'—'))+'</span><span>'+esc(String(p.positionValue?((num(p.positionValue)/Math.max(Math.abs(num(p.szi)),1e-12)).toFixed(4)):'—'))+'</span><strong class="'+(num(p.unrealizedPnl)>=0?'pos':'neg')+'">'+money(p.unrealizedPnl)+'</strong><i>'+((num(p.liquidationPx)>0)?'Liq '+esc(String(p.liquidationPx)):'—')+'</i></div>').join('')+'</div>'}
function orderRows(rows,open){if(!rows?.length)return '<div class="rwa-v5-empty">'+(open?'No open orders.':'No venue history loaded.')+'</div>';return '<div class="rwa-v5-table rwa-v5-orders"><div class="head"><span>Market</span><span>Side</span><span>Size</span><span>Price</span><span>Status</span><span>Action</span></div>'+rows.slice(0,40).map(x=>{const o=x.order||x,coin=o.coin||x.coin||'—',oid=o.oid??x.oid??'',side=o.side||o.dir||x.side||'—',px=o.limitPx??o.px??o.price??'—',sz=o.sz??o.origSz??o.size??'—',status=x.status||o.status||(open?'OPEN':'HISTORY');return '<div><b>'+esc(coin)+'</b><span>'+esc(side)+'</span><span>'+esc(String(sz))+'</span><span>'+esc(String(px))+'</span><i>'+esc(String(status))+'</i>'+(open&&oid!==''?'<button data-v5-cancel data-coin="'+esc(coin)+'" data-oid="'+esc(String(oid))+'">Cancel</button>':'<span>—</span>')+'</div>'}).join('')+'</div>'}
function feedHtml(){
 const s=market(),fmt=window.RWAMarketRuntime?.format,local=theses().slice().reverse().slice(0,8),trades=(s?.recentTrades||[]).slice(0,12),remote=serverReady?serverFeed:[];
 const remoteHtml=remote.length?remote.map(p=>'<article class="rwa-v5-server-post"><header><b>'+esc(p.wallet?.slice(0,6)||'wallet')+'…'+esc(p.wallet?.slice(-4)||'')+' · '+esc(p.side||'')+'</b><small>'+new Date(p.createdAt||Date.now()).toLocaleString()+'</small></header><p>'+esc(p.text)+'</p><footer><button data-v5-symbol="'+esc(p.symbol)+'">'+esc(String(p.symbol||'').replace(/USDT$/,'/USDT'))+'</button><button data-v5-react="'+esc(p.id)+'">🔥 '+esc(String(p.reactions?.fire||0))+'</button><button data-v5-comment="'+esc(p.id)+'">💬 '+esc(String(p.comments||0))+'</button><button data-v5-follow="'+esc(p.wallet)+'">Follow</button></footer></article>').join(''):'';
 return '<div class="rwa-v5-feed-grid"><section><header><b>'+(serverReady?'Signed community feed':'Local thesis')+'</b><button data-v5-bottom="thesis">Post an idea</button></header>'+(remoteHtml||(local.length?local.map(t=>'<article><small>'+esc(t.side)+' · '+new Date(t.ts).toLocaleString()+'</small><p>'+esc(t.text)+'</p><button data-v5-symbol="'+esc(t.symbol)+'">'+esc(t.symbol.replace(/USDT$/,'/USDT'))+'</button></article>').join(''):'<div class="rwa-v5-empty">No thesis yet.</div>'))+'</section><section><header><b>Verified live trades</b><span>'+esc(base())+'/USDT</span></header>'+(trades.length?trades.map(t=>'<div class="rwa-v5-feed-trade"><span class="'+(t.buy?'pos':'neg')+'">'+(t.buy?'BUY':'SELL')+'</span><b>'+esc(fmt?.price?.(t.p)||String(t.p))+'</b><i>'+esc(String(t.q??''))+'</i><small>'+new Date(t.time||Date.now()).toLocaleTimeString()+'</small></div>').join(''):'<div class="rwa-v5-empty">Waiting for live trades…</div>')+'</section></div>'
}
function analyticsHtml(){
 const s=market(),pairs=s?.pairs||[],rwa=pairs.filter(x=>x.rwa),g=pairs.filter(x=>num(x.change)>0),l=pairs.filter(x=>num(x.change)<0),vol=pairs.reduce((n,x)=>n+num(x.vol),0),rv=rwa.reduce((n,x)=>n+num(x.vol),0),bp=num(s?.buyVol),sp=num(s?.sellVol),pressure=bp+sp>0?bp/(bp+sp)*100:null;
 return '<div class="rwa-v5-metrics"><div><small>LIVE PAIRS</small><b>'+pairs.length+'</b></div><div><small>RWA-LINKED</small><b>'+rwa.length+'</b></div><div><small>GAINERS</small><b class="pos">'+g.length+'</b></div><div><small>LOSERS</small><b class="neg">'+l.length+'</b></div><div><small>24H VOLUME</small><b>'+compact(vol)+'</b></div><div><small>RWA VOLUME</small><b>'+compact(rv)+'</b></div><div><small>SELECTED</small><b>'+esc(base())+'/USDT</b></div><div><small>BUY PRESSURE</small><b>'+(pressure===null?'—':pressure.toFixed(0)+'%')+'</b></div></div>'
}
function portfolioHtml(s){const a=s?.account||{},ps=s?.positions||[];return '<div class="rwa-v5-metrics"><div><small>ACCOUNT VALUE</small><b>'+money(a.equity)+'</b></div><div><small>AVAILABLE</small><b>'+money(a.available)+'</b></div><div><small>UNREALIZED P&L</small><b class="'+(num(a.unrealizedPnl)>=0?'pos':'neg')+'">'+money(a.unrealizedPnl)+'</b></div><div><small>NOTIONAL</small><b>'+money(a.totalNotional)+'</b></div><div><small>POSITIONS</small><b>'+ps.length+'</b></div><div><small>OPEN ORDERS</small><b>'+(s?.orders?.length||0)+'</b></div><div><small>RECENT FILLS</small><b>'+(s?.fills?.length||0)+'</b></div><div><small>ENV</small><b>'+esc(String(s?.env||'testnet').toUpperCase())+'</b></div></div>'+positionRows(ps)}
function thesisHtml(){const remote=serverReady, list=theses().slice().reverse();return '<div class="rwa-v5-thesis"><section><small>'+(remote?'SIGNED SERVER THESIS':'LOCAL THESIS')+' · '+esc(base())+'/USDT</small><div><button class="active" data-v5-thesis-side="LONG">Long</button><button data-v5-thesis-side="SHORT">Short</button></div><textarea maxlength="280" data-v5-thesis-text placeholder="Write a catalyst, level or market thesis…"></textarea><footer><span data-v5-thesis-count>0 / 280</span><button class="primary" data-v5-thesis-publish>Post thesis</button></footer><p>'+(remote?'Published only after wallet-signed server session.':'Stored only in this browser until the terminal backend is ready.')+'</p></section><section class="rwa-v5-thesis-list">'+(list.length?list.map(t=>'<article><header><b>'+esc(t.symbol.replace(/USDT$/,'/USDT'))+' · '+esc(t.side)+'</b><small>'+new Date(t.ts).toLocaleString()+'</small></header><p>'+esc(t.text)+'</p><button data-v5-delete-thesis="'+esc(t.id)+'">Delete</button></article>').join(''):'<div class="rwa-v5-empty">No local thesis posts.</div>')+'</section></div>'}
function discoverHtml(){const pairs=market()?.pairs||[],moves=[...pairs].sort((a,b)=>Math.abs(num(b.change))-Math.abs(num(a.change))).slice(0,10),vol=[...pairs].sort((a,b)=>num(b.vol)-num(a.vol)).slice(0,10);return '<div class="rwa-v5-discover"><section><header><b>Top movers</b><span>24h</span></header>'+moves.map(x=>'<button data-v5-symbol="'+esc(x.symbol)+'"><b>'+esc(x.base)+'/USDT</b><span>'+compact(x.vol)+'</span><i class="'+(num(x.change)>=0?'pos':'neg')+'">'+pct(x.change)+'</i></button>').join('')+'</section><section><header><b>Top volume</b><span>Live markets</span></header>'+vol.map(x=>'<button data-v5-symbol="'+esc(x.symbol)+'"><b>'+esc(x.base)+'/USDT</b><span>'+compact(x.vol)+'</span><i class="'+(num(x.change)>=0?'pos':'neg')+'">'+pct(x.change)+'</i></button>').join('')+'</section></div>'}
async function refreshAccount(){
 try{if(!window.RWAWalletAuth?.isLoggedIn?.())return null;const core=await window.RWALiveHome?.ensureExecution?.();await core?.refresh?.();return core?.state?.()||exchange()}catch(e){toast(String(e?.message||e));return exchange()}
}
async function setBottom(mode){
 bottomMode=mode;keepMarket();ensureBottom();setActive('#rwaV5Bottom [data-v5-bottom]',mode,'v5Bottom');
 const body=$('[data-v5-bottom-body]');if(body&&mode==='holders')body.innerHTML='<div class="rwa-v5-loading">Loading authoritative holder source…</div>';
 renderBottom(true)
}
async function renderBottom(force=false){
 const body=$('[data-v5-bottom-body]');if(!body)return;const s=exchange();qa('[data-v5-position-count]').forEach(x=>x.textContent=String(s?.positions?.length||0));qa('[data-v5-order-count]').forEach(x=>x.textContent=String(s?.orders?.length||0));
 if(['positions','orders','portfolio','history'].includes(bottomMode)&&window.RWAWalletAuth?.isLoggedIn?.()&&!s?.wallet&&force){body.innerHTML='<div class="rwa-v5-loading">Loading verified Hyperliquid account…</div>';await refreshAccount()}
 const ex=exchange();
 if(bottomMode==='positions'){body.innerHTML=window.RWAWalletAuth?.isLoggedIn?.()?positionRows(ex?.positions||[]):accountLocked('Positions');return}
 if(bottomMode==='orders'){body.innerHTML=window.RWAWalletAuth?.isLoggedIn?.()?orderRows(ex?.orders||[],true):accountLocked('Open Orders');return}
 if(bottomMode==='portfolio'){body.innerHTML=window.RWAWalletAuth?.isLoggedIn?.()?portfolioHtml(ex||{}):accountLocked('Portfolio');return}
 if(bottomMode==='history'){body.innerHTML=window.RWAWalletAuth?.isLoggedIn?.()?'<div class="rwa-v5-history"><section><header><b>Recent fills</b><span>Venue loaded</span></header>'+orderRows(ex?.fills||[],false)+'</section><section><header><b>Order history</b><span>Venue loaded</span></header>'+orderRows(ex?.history||[],false)+'</section></div>':accountLocked('History');return}
 if(bottomMode==='holders'){
  if(await syncService()){try{const r=await window.RWATerminalService.holders.get(selected());serverHolders=r;const rows=Array.isArray(r?.holders)?r.holders:[];body.innerHTML=r?.available&&rows.length?'<div class="rwa-v5-source-gated"><b>SOURCE GATED · VERIFIED</b><span>'+esc(r.issuer||'Authoritative issuer')+' · '+esc(r.network||'network')+'</span></div><div class="rwa-v5-table"><div class="head"><span>Holder</span><span>Balance</span><span>Share</span><span>Source</span><span>Updated</span><span>Status</span></div>'+rows.slice(0,50).map(x=>'<div><b>'+esc(x.address||'—')+'</b><span>'+esc(String(x.balance??'—'))+'</span><span>'+esc(String(x.share??'—'))+'</span><span>'+esc(r.source||'authoritative')+'</span><span>'+new Date(r.updatedAt||Date.now()).toLocaleString()+'</span><i>VERIFIED</i></div>').join('')+'</div>':'<div class="rwa-v5-lock"><b>Holder source not configured</b><p>The terminal backend is online, but no authoritative holder indexer/source is configured for '+esc(base())+'. No holder counts are fabricated.</p><span>NEEDS AUTHORITATIVE SOURCE</span></div>';return}catch(e){serverServiceError=String(e?.message||e)}}
  body.innerHTML='<div class="rwa-v5-lock"><b>Holders data unavailable</b><p>No authoritative holder registry/indexer is connected for the selected live market. This panel stays locked instead of inventing holder counts.</p><span>NEEDS HOLDER BACKEND</span></div>';return
 }
 if(bottomMode==='feed'){if(serverReady)await syncServerFeed();body.innerHTML=feedHtml();return}
 if(bottomMode==='analytics'){body.innerHTML=analyticsHtml();return}
 if(bottomMode==='thesis'){body.innerHTML=thesisHtml();const pub=body.querySelector('[data-v5-thesis-publish]');if(pub)pub.onclick=e=>{e.preventDefault();e.stopPropagation();publishThesis()};body.querySelectorAll('[data-v5-thesis-side]').forEach(b=>b.onclick=e=>{e.preventDefault();e.stopPropagation();body.querySelectorAll('[data-v5-thesis-side]').forEach(x=>x.classList.toggle('active',x===b))});return}
 if(bottomMode==='discover'){body.innerHTML=discoverHtml();return}
 if(bottomMode==='rewards'){
  if(await syncService()&&window.RWAWalletAuth?.isLoggedIn?.()){try{serverRewards=await window.RWATerminalService.rewards.summary();serverSession=true;const active=serverRewards?.program?.active===true;body.innerHTML='<div class="rwa-v5-metrics"><div><small>REWARD STATUS</small><b>'+(active?'ACTIVE':'INACTIVE')+'</b></div><div><small>POINTS</small><b>'+esc(String(serverRewards?.points||0))+'</b></div><div><small>LEDGER ENTRIES</small><b>'+esc(String(serverRewards?.entries?.length||0))+'</b></div><div><small>PROGRAM</small><b>'+esc(serverRewards?.program?.name||'RWA Rewards')+'</b></div></div>'+(active?'<div class="rwa-v5-empty">Reward ledger is server-backed and signed to the connected wallet.</div>':'<div class="rwa-v5-lock"><b>Rewards program inactive</b><p>The authoritative ledger is online but the program is not activated. No APR, points or balances are fabricated.</p><span>INACTIVE</span></div>');return}catch(e){serverServiceError=String(e?.message||e)}}
  body.innerHTML='<div class="rwa-v5-lock"><b>No verified rewards program is active</b><p>Rewards remain inactive until an authoritative rewards ledger/backend is connected. No APR, points or balances are fabricated.</p><span>INACTIVE</span></div>';return
 }
}
function ensureMiniBook(){
 const main=$('.main'),chart=$('.chart-wrap');if(!main||!chart)return;let mini=$('#rwaV5MiniBook');if(!mini){mini=document.createElement('section');mini.id='rwaV5MiniBook';mini.className='rwa-v5-mini-book';mini.innerHTML='<header><span>Bids</span><b data-v5-mini-spread>Spread —</b><span>Asks</span></header><div data-v5-mini-rows></div><button data-v5-mobile-mode="book">View full book</button>';chart.insertAdjacentElement('afterend',mini)}renderMiniBook()
}
function renderMiniBook(){const mini=$('#rwaV5MiniBook');if(!mini)return;const s=market(),b=s?.book?.bids?.slice(0,3)||[],a=s?.book?.asks?.slice(0,3)||[],fmt=window.RWAMarketRuntime?.format;const rows=mini.querySelector('[data-v5-mini-rows]');rows.innerHTML=[0,1,2].map(i=>'<div><span class="pos">'+esc(fmt?.price?.(b[i]?.[0])||String(b[i]?.[0]??'—'))+'</span><i>'+esc(String(b[i]?.[1]??'—'))+'</i><i>'+esc(String(a[i]?.[1]??'—'))+'</i><span class="neg">'+esc(fmt?.price?.(a[i]?.[0])||String(a[i]?.[0]??'—'))+'</span></div>').join('');const bp=num(b[0]?.[0]),ap=num(a[0]?.[0]);mini.querySelector('[data-v5-mini-spread]').textContent=bp&&ap?'Spread '+(((ap-bp)/((ap+bp)/2))*100).toFixed(4)+'%':'Spread —'}
function ensureMobile(){
 const head=$('.terminal-header');if(head&&!head.querySelector('.rwa-v5-mobile-worktabs')){const nav=document.createElement('nav');nav.className='rwa-v5-mobile-worktabs';nav.innerHTML='<button class="active" data-v5-mobile-mode="chart">Chart</button><button data-v5-mobile-mode="book">Book</button><button data-v5-mobile-mode="trade">Trade</button><button data-v5-mobile-mode="feed">Feed</button><button data-v5-action="open-markets">Markets</button>';head.appendChild(nav)}
 let mf=$('#rwaV5MobileFeed');if(!mf){mf=document.createElement('section');mf.id='rwaV5MobileFeed';mf.className='rwa-v5-mobile-feed';mf.hidden=true;$('.main')?.appendChild(mf)}
 const tabs=$('.mobile-tabs');if(tabs){tabs.dataset.v5='1';tabs.innerHTML='<button class="active" data-v5-global="markets" aria-current="page"><span>⌕</span><small>Markets</small></button>';tabs.hidden=true}
 const legacyClose=$('#mobileMarketsClose');if(legacyClose)legacyClose.remove();
 let close=$('#rwaV5MarketsClose');
 if(!close){close=document.createElement('button');close.id='rwaV5MarketsClose';close.className='rwa-v5-mobile-market-close-v2';close.type='button';close.textContent='×';close.setAttribute('aria-label','Close markets');close.dataset.v5Action='close-markets';document.body.appendChild(close)}
 const marketsOpen=innerWidth<681&&document.body.classList.contains('rwa-v5-mobile-markets');
 setMobileMarketsCloseVisible(marketsOpen);
 const marketBtn=tabs?.querySelector('[data-v5-mobile-nav="markets"]');if(marketBtn&&!marketBtn.dataset.v5Direct){marketBtn.dataset.v5Direct='1';marketBtn.onclick=e=>{e.preventDefault();e.stopPropagation();openMarketsMobile()}}
 const openBtn=head?.querySelector('[data-v5-action="open-markets"]');
 if(openBtn&&!openBtn.dataset.v5Direct){openBtn.dataset.v5Direct='1';openBtn.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();openMarketsMobile()},{capture:true});openBtn.onclick=e=>{e.preventDefault();e.stopPropagation();openMarketsMobile()}}
 if(close&&!close.dataset.v5Direct){close.dataset.v5Direct='1';close.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();closeMarketsMobile()},{capture:true});close.onclick=e=>{e.preventDefault();e.stopPropagation();closeMarketsMobile()}}
 ensureMiniBook();applyMobileState()
}
function setMobile(mode){
 mobileMode=mode;document.body.dataset.v5MobileMode=mode;setActive('.rwa-v5-mobile-worktabs [data-v5-mobile-mode]',mode,'v5MobileMode');
 if(innerWidth<681){const bottom=$('#rwaV5Bottom');if(bottom)bottom.style.setProperty('display',mode==='workspace'?'block':'none','important')}
 applyMobileState()
}
function applyMobileState(){
 document.body.dataset.v5MobileMode=mobileMode;
 const feed=$('#rwaV5MobileFeed');if(feed){feed.hidden=mobileMode!=='feed';if(!feed.hidden)feed.innerHTML=feedHtml()}
 if(innerWidth<681&&mobileMode==='workspace')$('#rwaV5Bottom')?.scrollIntoView?.({block:'start'})
}
function setMobileMarketsCloseVisible(on){
 const b=$('#rwaV5MarketsClose');if(!b)return;
 b.dataset.open=on?'1':'0';b.setAttribute('aria-hidden',String(!on));
 for(const p of ['display','visibility','opacity','pointer-events'])b.style.removeProperty(p)
}
function setMobileMarketsDrawerVisible(on){
 const left=$('.layout>.left')||$('.left');if(!left)return;
 if(on){
  left.style.setProperty('display','flex','important');
  left.style.setProperty('position','fixed','important');
  left.style.setProperty('inset','56px 0 56px 0','important');
  left.style.setProperty('width','100%','important');
  left.style.setProperty('min-width','0','important');
  left.style.setProperty('max-width','none','important');
  left.style.setProperty('height','auto','important');
  left.style.setProperty('z-index','2147482000','important');
  left.style.setProperty('visibility','visible','important');
  left.style.setProperty('opacity','1','important')
 }else{
  for(const p of ['position','inset','width','min-width','max-width','height','z-index','visibility','opacity'])left.style.removeProperty(p);
  if(innerWidth<681)left.style.setProperty('display','none','important');else left.style.removeProperty('display')
 }
}
function openMarketsMobile(){
 document.body.classList.add('rwa-v5-mobile-markets','market-drawer-open');leftMode='watchlist';
 setMobileMarketsDrawerVisible(true);setMobileMarketsCloseVisible(true);
 try{renderLeft()}catch(e){console.error('RWA V5 mobile markets render failed',e)}
}
function closeMarketsMobile(){
 document.body.classList.remove('rwa-v5-mobile-markets','market-drawer-open');
 setMobileMarketsCloseVisible(false);setMobileMarketsDrawerVisible(false);setMobile('chart')
}
function renderFavorite(){
 const w=$('.instrument-actions button:first-child');if(!w)return;const on=favorites().includes(selected());w.textContent=on?'★':'☆';w.classList.toggle('active',on);w.title=on?'Remove from watchlist':'Add to watchlist';w.setAttribute('aria-label',w.title)
}
function toggleFavorite(){const sym=selected(),f=favorites(),i=f.indexOf(sym);if(i>=0)f.splice(i,1);else f.unshift(sym);store.set(LS.fav,f.slice(0,100));renderFavorite();renderLeft();toast(i>=0?'Removed from watchlist':'Added to watchlist')}
async function share(){const u=new URL(location.href);u.hash='markets';u.searchParams.set('market',base());try{if(navigator.share){await navigator.share({title:'RWA Markets · '+base()+'/USDT',url:u.toString()});return}await navigator.clipboard.writeText(u.toString());toast('Market link copied')}catch(e){if(e?.name!=='AbortError')toast('Could not share this market')}}
function navigate(k){
 keepMarket();const active=()=>setActive('#liveRail .rwa-v5-market-nav [data-v5-nav]',k);
 if(k==='trade'){active();openTrade();if(innerWidth<681)setMobile('trade');return}
 if(k==='discover'){active();leftMode='pulse';renderLeft();setBottom('discover');if(innerWidth<681)setMobile('workspace');return}
 if(k==='portfolio'){active();setBottom('portfolio');if(innerWidth<681)setMobile('workspace');return}
 if(k==='orders'){active();setBottom('orders');if(innerWidth<681)setMobile('workspace');return}
 if(k==='analytics'){active();setBottom('analytics');if(innerWidth<681)setMobile('workspace');return}
 if(k==='rewards'){active();setBottom('rewards');if(innerWidth<681)setMobile('workspace');return}
 if(k==='more'){const m=$('#liveRail [data-v5-more-menu]');if(m)m.hidden=!m.hidden}
}
async function cancelOrder(b){try{const core=await window.RWALiveHome?.ensureExecution?.();await core.cancel(b.dataset.coin,b.dataset.oid);await core.refresh();renderBottom()}catch(e){toast(String(e?.message||e))}}
async function publishThesis(){
 const box=$('[data-v5-thesis-text]'),text=box?.value.trim();if(!text){toast('Write a thesis first');return}
 const side=$('[data-v5-thesis-side].active')?.dataset.v5ThesisSide||'LONG';
 if(await syncService()&&window.RWAWalletAuth?.isLoggedIn?.()){
  try{await window.RWATerminalService.social.post({symbol:selected(),side,text});serverSession=true;box.value='';await syncServerFeed();renderBottom();renderLeft();toast('Thesis published to signed server feed');return}catch(e){toast(String(e?.message||e));return}
 }
 const list=theses();list.push({id:String(Date.now()),symbol:selected(),side,text,ts:Date.now()});store.set(LS.thesis,list.slice(-100));box.value='';toast('Local thesis saved');setTimeout(()=>{if(bottomMode==='thesis')renderBottom();renderLeft()},0)
}
async function socialAction(kind,target){
 if(!await syncService()||!window.RWAWalletAuth?.isLoggedIn?.()){toast('Connect wallet and enable terminal backend');return}
 try{
  if(kind==='react')await window.RWATerminalService.social.react(target,'fire');
  if(kind==='follow')await window.RWATerminalService.social.follow(target);
  if(kind==='comment'){const text=prompt('Comment');if(!text?.trim())return;await window.RWATerminalService.social.comment(target,text.trim())}
  serverSession=true;await syncServerFeed();if(bottomMode==='feed')renderBottom();toast(kind==='follow'?'Follow updated':'Feed updated')
 }catch(e){toast(String(e?.message||e))}
}
function orderBookClick(e){const row=e.target.closest('.bookrow');if(!row||!$('#depth')?.contains(row))return;const raw=row.querySelector('span')?.textContent||'',price=Number(raw.replace(/[^0-9.\-]/g,''));if(!(price>0))return;openTrade();const ticket=$('#rwaTargetOrderTicket');window.RWALiveHome?.setOrderMode?.('LIMIT');if(ticket){ticket.querySelectorAll('[data-live-mode]').forEach(b=>b.classList.toggle('active',b.dataset.liveMode==='LIMIT'));ticket.querySelectorAll('[data-live-price]').forEach(p=>{p.disabled=false;p.placeholder='Limit price'})}const side=ticket?.querySelector('[data-order-side="'+tradeSide+'"]'),input=side?.querySelector('[data-live-price]');if(input){input.disabled=false;input.value=String(price);input.dispatchEvent(new Event('input',{bubbles:true}));toast('Limit price set from order book')}}
function renderStatus(){
 const p=pair();if(lastPair!==p.symbol){lastPair=p.symbol;renderFavorite();renderMiniBook();if(bottomMode==='analytics'||bottomMode==='feed'||bottomMode==='discover')renderBottom()}
 const ex=exchange(),stamp=num(ex?.lastUpdated);if(stamp&&stamp!==lastExchangeStamp){lastExchangeStamp=stamp;if(['positions','orders','portfolio','history'].includes(bottomMode))renderBottom()}
 renderTargetHeaderStats();renderLeft();renderMiniBook();renderAlertCount();renderFooter()
}
function ensureFooter(){
 if($('#rwaV5Footer'))return;const f=document.createElement('footer');f.id='rwaV5Footer';f.className='rwa-v5-footer';document.body.appendChild(f);renderFooter()
}
function renderFooter(){const f=$('#rwaV5Footer');if(!f)return;const rows=[...(market()?.pairs||[])].sort((a,b)=>num(b.vol)-num(a.vol)).slice(0,4);f.innerHTML='<span><i></i> System Status · Operational</span><div>'+rows.map(x=>'<button data-v5-symbol="'+esc(x.symbol)+'"><b>'+esc(x.base)+'</b> <i class="'+(num(x.change)>=0?'pos':'neg')+'">'+pct(x.change)+'</i></button>').join('')+'</div><small>Real market data · account data only when connected</small>'}
function apply(){
 window.__RWA_FIRST_PAINT_HEADER_LOCK__?.disconnect?.();
 const preserveMobileMarkets=innerWidth<681&&document.body.classList.contains('rwa-v5-mobile-markets');
 document.body.classList.add('rwa-terminal-v5');document.documentElement.dataset.rwaTerminal='v5';unlockLegacyGeometry();keepMarket();ensureHeader();ensureLeft();ensureBottom();ensureTrade();ensureMobile();ensureFooter();ensureTargetHeaderStats();lockV5Geometry();pruneLegacyUi();
 document.documentElement.classList.add('rwa-target-runtime-ready');document.documentElement.classList.remove('rwa-target-prepaint');
 if(preserveMobileMarkets||document.body.classList.contains('rwa-v5-mobile-markets')){setMobileMarketsDrawerVisible(true);setMobileMarketsCloseVisible(true)}
 renderFavorite();renderStatus();renderFooter()
}
function bind(){
 const depth=$('#depth');if(depth&&!depth.dataset.v5BookBound){depth.dataset.v5BookBound='1';depth.addEventListener('pointerdown',e=>orderBookClick(e),true)}
 if(!window.__RWA_V5_CRITICAL_CAPTURE__){
  window.__RWA_V5_CRITICAL_CAPTURE__=true;
  window.addEventListener('click',e=>{
   const t=e.target?.closest?.('[data-v5-trade-tab],[data-v5-mobile-nav],[data-v5-action="open-markets"],[data-v5-action="close-markets"]');if(!t)return;
   if(t.matches('[data-v5-trade-tab]')){e.preventDefault();e.stopImmediatePropagation();t.dataset.v5TradeTab==='alerts'?openAlerts():openTrade();return}
   if(t.matches('[data-v5-action="open-markets"]')){e.preventDefault();e.stopImmediatePropagation();openMarketsMobile();return}
   if(t.matches('[data-v5-action="close-markets"]')){e.preventDefault();e.stopImmediatePropagation();closeMarketsMobile();return}
   if(t.matches('[data-v5-mobile-nav]')){
    e.preventDefault();e.stopImmediatePropagation();const k=t.dataset.v5MobileNav;
    qa('[data-v5-mobile-nav]').forEach(x=>x.classList.toggle('active',x===t));
    if(k==='home')setMobile('feed');
    else if(k==='markets')openMarketsMobile();
    else if(k==='trade')setMobile('trade');
    else if(k==='portfolio'){setBottom('portfolio');setMobile('workspace')}
    else if(k==='profile')$('.signin')?.click();
   }
  },true)
 }
 document.addEventListener('click',e=>{
  const lockSign=e.target.closest('.rwa-v5-lock .signin');if(lockSign){e.preventDefault();$('.top-actions .signin')?.click();return}
  const nav=e.target.closest('[data-v5-nav]');if(nav){e.preventDefault();e.stopPropagation();navigate(nav.dataset.v5Nav);return}
  const left=e.target.closest('[data-v5-left]');if(left){leftMode=left.dataset.v5Left;renderLeft();return}
  const watchExpand=e.target.closest('[data-v5-watch-expand]');if(watchExpand){const pane=$('[data-v5-left-pane="watchlist"]');pane?.classList.toggle('rwa-v5-watch-expanded');watchExpand.textContent=pane?.classList.contains('rwa-v5-watch-expanded')?'Back to signals':'View all watchlist';return}
  const sym=e.target.closest('[data-v5-symbol]');if(sym){window.RWAMarketRuntime?.selectPair?.(sym.dataset.v5Symbol,false);if(innerWidth<681)closeMarketsMobile();return}
  const bottom=e.target.closest('[data-v5-bottom]');if(bottom){setBottom(bottom.dataset.v5Bottom);if(innerWidth<681)setMobile('workspace');return}
  const mode=e.target.closest('[data-v5-mobile-mode]');if(mode){setMobile(mode.dataset.v5MobileMode);return}
  const side=e.target.closest('[data-v5-side]');if(side){e.preventDefault();setTradeSide(side.dataset.v5Side);return}
  const ttab=e.target.closest('[data-v5-trade-tab]');if(ttab){ttab.dataset.v5TradeTab==='alerts'?openAlerts():openTrade();return}
  const mobileWallet=e.target.closest('[data-v5-mobile-wallet]');if(mobileWallet){e.preventDefault();$('.top-actions .signin')?.click();return}
  const act=e.target.closest('[data-v5-action]');if(act){if(act.dataset.v5Action==='alerts')openAlerts();if(act.dataset.v5Action==='network')$('#rwaMultiChainLaunch')?.click();if(act.dataset.v5Action==='open-markets')openMarketsMobile();if(act.dataset.v5Action==='close-markets')closeMarketsMobile();return}
  const mn=e.target.closest('[data-v5-mobile-nav]');if(mn){const k=mn.dataset.v5MobileNav;qa('[data-v5-mobile-nav]').forEach(x=>x.classList.toggle('active',x===mn));if(k==='home')setMobile('feed');if(k==='markets')openMarketsMobile();if(k==='trade')setMobile('trade');if(k==='portfolio'){setBottom('portfolio');setMobile('workspace')}if(k==='profile')$('.signin')?.click();return}
  const dir=e.target.closest('[data-v5-alert-dir]');if(dir){qa('[data-v5-alert-dir]').forEach(x=>x.classList.toggle('active',x===dir));return}
  if(e.target.closest('[data-v5-create-alert]')){createAlert();return}
  const delA=e.target.closest('[data-v5-delete-alert]');if(delA){deleteAlert(delA.dataset.v5DeleteAlert);return}
  const react=e.target.closest('[data-v5-react]');if(react){socialAction('react',react.dataset.v5React);return}
  const comment=e.target.closest('[data-v5-comment]');if(comment){socialAction('comment',comment.dataset.v5Comment);return}
  const follow=e.target.closest('[data-v5-follow]');if(follow){socialAction('follow',follow.dataset.v5Follow);return}
  const tside=e.target.closest('[data-v5-thesis-side]');if(tside){qa('[data-v5-thesis-side]').forEach(x=>x.classList.toggle('active',x===tside));return}
  if(e.target.closest('[data-v5-thesis-publish]')){publishThesis();return}
  const delT=e.target.closest('[data-v5-delete-thesis]');if(delT){store.set(LS.thesis,theses().filter(t=>t.id!==delT.dataset.v5DeleteThesis));renderBottom();renderLeft();return}
  const cancel=e.target.closest('[data-v5-cancel]');if(cancel){cancelOrder(cancel);return}
  orderBookClick(e)
 },true);
 document.addEventListener('input',e=>{if(e.target.matches('[data-v5-thesis-text]')){const c=$('[data-v5-thesis-count]');if(c)c.textContent=e.target.value.length+' / 280'}});
 document.addEventListener('keydown',e=>{if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){e.preventDefault();$('#rwaV5GlobalSearch input')?.focus()}if(e.key==='Escape'){$('[data-v5-more-menu]')?.setAttribute('hidden','');document.body.classList.remove('rwa-v5-mobile-markets')}});
 window.addEventListener('resize',()=>{if(innerWidth>680){document.body.classList.remove('rwa-v5-mobile-markets','market-drawer-open');setMobileMarketsCloseVisible(false);setMobileMarketsDrawerVisible(false)}ensureMobile();applyMobileState()},{passive:true});
 window.addEventListener('rwa:wallet-login',()=>setTimeout(()=>{refreshAccount().then(()=>renderBottom())},50));
 window.addEventListener('rwa:wallet-logout',()=>renderBottom());
 window.addEventListener('rwa:exchange-state',()=>renderStatus())
}
function boot(){apply();bind();renderBottom();syncService().then(ok=>{if(ok)syncServerFeed()});clearInterval(renderTimer);renderTimer=setInterval(renderStatus,1000);clearInterval(alertTimer);alertTimer=setInterval(monitorAlerts,5000);clearInterval(serviceTimer);serviceTimer=setInterval(()=>{syncService();if(serverReady)syncServerFeed()},30000);window.dispatchEvent(new CustomEvent('rwa:terminal-v5-ready',{detail:{version:VERSION}}))}
window.RWATerminalV5={version:VERSION,active:true,apply,navigate,setBottom,setMobile,setTradeSide,openAlerts,openTrade,toggleFavorite,share,syncService,audit:()=>({version:VERSION,route:location.hash||'#markets',leftMode,bottomMode,mobileMode,tradeSide,globalNav:qa('.topnav [data-v5-global]').map(x=>x.dataset.v5Global),marketNav:qa('#liveRail .rwa-v5-market-nav [data-v5-nav]').map(x=>x.dataset.v5Nav),bottomTabs:qa('#rwaV5Bottom [data-v5-bottom]').map(x=>x.dataset.v5Bottom),railTrade:$('#liveRail')?.dataset.v5Trade==='1',orderTicketInside:!!$('#liveRail #rwaTargetOrderTicket'),mobileMarketsOpen:document.body.classList.contains('rwa-v5-mobile-markets'),favorites:favorites().length,alerts:visibleAlerts().length,theses:theses().length,serverReady,serverSession,serverFeed:serverFeed.length,serverServiceError})};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
/* RWA_TERMINAL_V5_BACKEND_INTEGRATION_2026_09_03 */

/* RWA_TERMINAL_V5_BACKEND_CLIENT_ACCEPTANCE_2026_09_03 */
/* RWA_TERMINAL_V5_FULL_ACCEPTANCE_R20_2026_09_03 */

/* RWA_TERMINAL_V5_SYSTEMS_R20_ACCEPTANCE_2026_09_03 */

/* RWA_TERMINAL_V5_MARKET_CONTAINMENT_FINAL_2026_09_03 */

/* RWA_TERMINAL_V5_MARKET_CONTAINMENT_ACCEPTANCE_2026_09_03 */

/* RWA_TERMINAL_V5_NO_LEGACY_FIRST_PAINT_2026_09_03 */

/* RWA_TERMINAL_TARGET_PARITY_R1_2026_09_03 */

/* RWA_TERMINAL_TARGET_PARITY_R2_2026_09_03 */

/* RWA_TERMINAL_PUBLIC_FINAL_ACCEPTANCE_2026_09_03_R3 */

/* RWA_TERMINAL_MOBILE_CLOSE_AND_HOLDER_SOURCE_GATE_R4 */

/* RWA_TERMINAL_PUBLIC_FINAL_ACCEPTANCE_2026_09_03_R4 */

/* RWA_TERMINAL_PUBLIC_FINAL_VALIDATION_2026_09_03 */

/* RWA_TERMINAL_REAL_FIRST_PAINT_ONLY_2026_09_03 */

/* RWA_TERMINAL_REAL_FIRST_PAINT_FINAL_2026_09_03 */
