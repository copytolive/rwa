(()=>{
'use strict';
if(window.RWAProductOS)return;
const $=id=>document.getElementById(id),qa=(s,r=document)=>[...r.querySelectorAll(s)];
const isTrade=/\/trade\/?$/.test(location.pathname),rootUrl=isTrade?'../':'./';
const toastSafe=t=>typeof window.toast==='function'?window.toast(t):console.log(t);
const selectedBase=()=>{try{const t=$('selName')?.textContent||$('marketName')?.textContent||'BTC';return t.split(/[\s\/-]/)[0].toUpperCase()}catch{return'BTC'}};
function openSuite(tab){if(isTrade){location.href=`../#${tab}`;return}if(window.RWASuite?.open)return RWASuite.open(tab);window.RWAQuickActions?.loadSuite?.().then(s=>s?.open?.(tab)).catch(e=>toastSafe(e.message||'Workspace unavailable'))}
function hideModes(){document.body.classList.remove('rwa-home-open','social-open','market-drawer-open','suite-open');const suite=$('suite');if(suite&&innerWidth<=680)suite.style.display='none'}
function openMarkets(){if(isTrade){location.href='../#markets';return}hideModes();document.body.classList.remove('rwa-home-open');$('terminal')?.scrollIntoView({behavior:'auto',block:'start'});setActive('markets')}
function openHome(){if(isTrade){location.href='../#home';return}hideModes();document.body.classList.add('rwa-home-open');renderHome();scrollTo({top:0,behavior:'auto'});setActive('home')}
function openSocial(){if(isTrade){location.href='../#social';return}hideModes();openSuite('feed');setActive('social')}
function openTrade(base=selectedBase()){location.href=`${rootUrl}trade/?coin=${encodeURIComponent(base||'BTC')}`}
function openAsset(base=selectedBase()){location.href=`${rootUrl}asset/?symbol=${encodeURIComponent(base||'BTC')}`}
function openTrader(wallet){location.href=`${rootUrl}trader/?wallet=${encodeURIComponent(wallet||'')}`}
function setActive(name){qa('[data-rwa-route]').forEach(x=>x.classList.toggle('active',x.dataset.rwaRoute===name));qa('[data-mobile-nav]').forEach(x=>x.classList.toggle('active',x.dataset.mobileNav===name))}
function normalizeDesktopNav(){
  if(isTrade){const n=document.querySelector('.product-nav');if(n)n.innerHTML=`<a href="../#home">Home</a><a href="../#markets">Markets</a><a class="active" href="./">Trade</a><a href="../#social">Social</a><a href="../#rwa">RWA Assets</a><a href="../#intel">Intelligence</a><a href="../backtest/">Backtest</a><a href="../renko/">Renko</a>`;return}
  const n=document.querySelector('.topnav');if(!n)return;n.innerHTML=`<button data-rwa-route="home">Home</button><button data-rwa-route="markets">Markets</button><button data-rwa-route="trade">Trade</button><button data-rwa-route="social">Social</button><button data-rwa-route="rwa">RWA Assets</button><button data-rwa-route="intel">Intelligence</button>`;
}
function normalizeMobileNav(){if(isTrade)return;const nav=document.querySelector('.mobile-tabs');if(!nav)return;nav.innerHTML=`<a href="#home" data-mobile-nav="home"><span>⌂</span><small>Home</small></a><a href="#markets" data-mobile-nav="markets"><span>⌕</span><small>Markets</small></a><a href="trade/" data-mobile-nav="trade"><span>↗</span><small>Trade</small></a><a href="#social" data-mobile-nav="social"><span>◎</span><small>Social</small></a><a href="#portfolio" data-mobile-nav="portfolio"><span>▣</span><small>Portfolio</small></a>`}
function installCommandButton(){const host=document.querySelector('.top-actions');if(!host||host.querySelector('.rwa-command-button'))return;const b=document.createElement('button');b.type='button';b.className='rwa-command-button';b.innerHTML='<span>⌕</span><span class="label">Search / Command</span><kbd>⌘K</kbd>';b.onclick=()=>openCommand();host.insertBefore(b,host.querySelector('.signin,.status-pill,.button.primary')||host.lastElementChild)}
function installCommandLayer(){if($('rwaCommandLayer'))return;const layer=document.createElement('div');layer.id='rwaCommandLayer';layer.className='rwa-command-layer';layer.hidden=true;layer.innerHTML=`<section class="rwa-command-card" role="dialog" aria-modal="true" aria-label="RWA command center"><div class="rwa-command-head"><span>⌕</span><input id="rwaCommandInput" autocomplete="off" placeholder="BTC, trader wallet, portfolio, backtest GOLD, trade ETH…"><button class="rwa-command-close" type="button" aria-label="Close">×</button></div><div class="rwa-command-help">Search markets and traders or use natural commands. Execution commands only open the protected trade flow; they never bypass wallet approval, Risk Engine checks or the mainnet gate.</div><div id="rwaCommandResults" class="rwa-command-results"></div></section>`;document.body.appendChild(layer);layer.addEventListener('click',e=>{if(e.target===layer||e.target.closest('.rwa-command-close'))closeCommand()});$('rwaCommandInput').addEventListener('input',renderCommand);$('rwaCommandInput').addEventListener('keydown',e=>{if(e.key==='Enter')$('rwaCommandResults')?.querySelector('.rwa-command-item')?.click();if(e.key==='Escape')closeCommand()})}
function openCommand(seed=''){installCommandLayer();const l=$('rwaCommandLayer');l.hidden=false;const i=$('rwaCommandInput');i.value=seed;renderCommand();setTimeout(()=>i.focus(),20)}function closeCommand(){const l=$('rwaCommandLayer');if(l)l.hidden=true}
function marketCandidates(q){if(isTrade)return[];try{return (S?.pairs||[]).filter(x=>!q||x.symbol.includes(q)||x.base.includes(q)).slice(0,8).map(x=>({title:`${x.base} / USDT`,desc:`${x.rwa?'RWA-linked · ':''}Live market`,tag:'MARKET',run:()=>{closeCommand();selectPair?.(x.symbol,false);openMarkets()}}))}catch{return[]}}
function commandCandidates(raw){const text=String(raw||'').trim(),q=text.toUpperCase(),out=[];const wallet=(text.match(/0x[a-fA-F0-9]{40}/)||[])[0];if(wallet)out.push({title:'Open verified trader profile',desc:wallet,tag:'TRADER',run:()=>openTrader(wallet)});
  const symbol=(q.match(/\b[A-Z0-9]{2,12}\b/g)||[]).find(x=>!['TRADE','BACKTEST','RENKO','ASSET','MARKET','OPEN','SHOW','COPY','PORTFOLIO','SOCIAL','HOME','INTELLIGENCE','RWA','LEADERBOARD','DEFAULT','TERMINAL'].includes(x));
  if(/DEFAULT HOME/.test(q))out.push({title:'Set Home as default',desc:'Open Home on future visits',tag:'SETTING',run:()=>{localStorage.setItem('rwa_default_landing_v3','home');closeCommand();openHome();toastSafe('Default landing set to Home')}});
  if(/DEFAULT TERMINAL|DEFAULT MARKET/.test(q))out.push({title:'Set Markets as default',desc:'Open the live terminal on future visits',tag:'SETTING',run:()=>{localStorage.setItem('rwa_default_landing_v3','markets');closeCommand();openMarkets();toastSafe('Default landing set to Markets')}});
  if(/\bHOME\b/.test(q))out.push({title:'Open Home',desc:'Portfolio, trends and quick actions',tag:'HOME',run:openHome});
  if(/MARKET/.test(q))out.push({title:'Open Markets',desc:'Live market terminal',tag:'MARKETS',run:openMarkets});
  if(/LEADERBOARD|TOP TRADER/.test(q))out.push({title:'Open Trader Leaderboard',desc:'Signed identities + venue performance',tag:'TRADERS',run:()=>openSuite('leaderboard')});
  if(/\bCOPY\b/.test(q)&&!wallet)out.push({title:'Open Copy Trading',desc:'Non-custodial copy controls and max-loss',tag:'COPY',run:()=>openSuite('copy')});
  if(/PORTFOLIO|PNL|POSITION/.test(q))out.push({title:'Open Portfolio',desc:'Verified Hyperliquid account data',tag:'PORTFOLIO',run:()=>openSuite('portfolio')});
  if(/SOCIAL|FEED|THESIS/.test(q))out.push({title:'Open Social',desc:'Trader feed and signed profiles',tag:'SOCIAL',run:openSocial});
  if(/INTEL|INTELLIGENCE/.test(q))out.push({title:'Open Intelligence',desc:'Breadth, momentum and flow',tag:'INTEL',run:()=>openSuite('intel')});
  if(/RWA|ASSET/.test(q))out.push({title:'Open RWA Assets',desc:'Verified assets and onboarding',tag:'RWA',run:()=>openSuite('rwa')});
  if(/BACKTEST/.test(q))out.push({title:`Backtest ${symbol||selectedBase()}`,desc:'Open the backtest workspace',tag:'BACKTEST',run:()=>{location.href=`${rootUrl}backtest/?symbol=${encodeURIComponent(symbol||selectedBase())}`}});
  if(/RENKO/.test(q))out.push({title:`Renko ${symbol||selectedBase()}`,desc:'Open the Renko workspace',tag:'RENKO',run:()=>{location.href=`${rootUrl}renko/?symbol=${encodeURIComponent(symbol||selectedBase())}`}});
  if(/TRADE|BUY|SELL|CLOSE|TP|SL/.test(q))out.push({title:`Trade ${symbol||selectedBase()}`,desc:'Protected order ticket · Risk Engine → preview → approval',tag:'TRADE',run:()=>openTrade(symbol||selectedBase())});
  if(symbol&&!/BACKTEST|RENKO|TRADE|BUY|SELL|CLOSE|TP|SL/.test(q))out.push({title:`Open ${symbol} asset page`,desc:'Chart, market data, social context and tools',tag:'ASSET',run:()=>openAsset(symbol)});
  return out}
function renderCommand(){const box=$('rwaCommandResults');if(!box)return;const text=$('rwaCommandInput')?.value||'',q=text.trim().toUpperCase();let rows=[...commandCandidates(text),...marketCandidates(q)];if(!text.trim())rows=[{title:'Home',desc:'Portfolio, trends and recent activity',tag:'GO',run:openHome},{title:'Markets',desc:'Live market discovery',tag:'GO',run:openMarkets},{title:'Trade',desc:'Protected Hyperliquid execution',tag:'GO',run:()=>openTrade()},{title:'Portfolio',desc:'Verified account data',tag:'GO',run:()=>openSuite('portfolio')},{title:'Trader leaderboard',desc:'Discover public venue-backed performance',tag:'GO',run:()=>openSuite('leaderboard')},{title:'RWA Assets',desc:'Physical-asset registry and verification',tag:'GO',run:()=>openSuite('rwa')},{title:'Backtest',desc:'Historical strategy analysis',tag:'GO',run:()=>location.href=`${rootUrl}backtest/`}];rows=rows.slice(0,10);box.replaceChildren(...rows.map(r=>{const b=document.createElement('button');b.className='rwa-command-item';b.type='button';b.innerHTML=`<div><b>${r.title}</b><small>${r.desc}</small></div><span>${r.tag}</span>`;b.onclick=r.run;return b}))}
function installHome(){if(isTrade||$('rwaHomeDashboard'))return;const h=document.createElement('section');h.id='rwaHomeDashboard';h.className='rwa-home-dashboard';h.innerHTML=`<div class="rwa-home-hero"><div><small>RWA NETWORK</small><h1>Your market operating system</h1><p>Discover markets, trade through protected execution, follow verified traders and inspect real-world assets from one interface.</p></div><div class="rwa-home-actions"><button class="primary" data-home-action="trade">Trade now</button><button data-home-action="command">Ask / Search</button><button data-home-action="portfolio">Portfolio</button></div></div><div class="rwa-home-grid"><article class="rwa-home-card"><small>LIVE MARKETS</small><strong id="homeMarketCount">—</strong><div class="rwa-home-note">Public exchange feeds</div></article><article class="rwa-home-card"><small>GAINERS</small><strong id="homeGainers">—</strong><div class="rwa-home-note">Positive 24h markets</div></article><article class="rwa-home-card"><small>RWA-LINKED</small><strong id="homeRwaCount">—</strong><div class="rwa-home-note">Tracked RWA-linked pairs</div></article><article class="rwa-home-card"><small>EXECUTION</small><strong>Protected</strong><div class="rwa-home-note">Wallet → Risk → RWA API → venue</div></article><article class="rwa-home-card wide"><h3>Trending markets</h3><div id="homeTrending" class="rwa-home-list"><div class="rwa-home-note">Loading live markets…</div></div></article><article class="rwa-home-card wide"><h3>Quick workspaces</h3><div class="rwa-home-list"><button class="rwa-command-item" data-home-action="social"><div><b>Social & traders</b><small>Feed, leaderboard, copy</small></div><span>OPEN</span></button><button class="rwa-command-item" data-home-action="rwa"><div><b>RWA Assets</b><small>Registry, evidence, verification</small></div><span>OPEN</span></button><button class="rwa-command-item" data-home-action="backtest"><div><b>Backtest</b><small>Historical strategy analysis</small></div><span>OPEN</span></button><button class="rwa-command-item" data-home-action="renko"><div><b>Renko</b><small>Traditional fixed-box history</small></div><span>OPEN</span></button></div></article></div>`;const app=document.querySelector('.app');app?.insertBefore(h,document.querySelector('.credibility-strip'));h.addEventListener('click',e=>{const a=e.target.closest('[data-home-action]')?.dataset.homeAction;if(!a)return;if(a==='trade')openTrade();if(a==='command')openCommand();if(a==='portfolio')openSuite('portfolio');if(a==='social')openSocial();if(a==='rwa')openSuite('rwa');if(a==='backtest')location.href='backtest/';if(a==='renko')location.href='renko/'});setInterval(renderHome,2500)}
function renderHome(){if(isTrade)return;try{const pairs=S?.pairs||[];if($('homeMarketCount'))$('homeMarketCount').textContent=pairs.length?pairs.length.toLocaleString():'—';if($('homeGainers'))$('homeGainers').textContent=pairs.filter(x=>(x.change||0)>0).length.toLocaleString();if($('homeRwaCount'))$('homeRwaCount').textContent=pairs.filter(x=>x.rwa).length.toLocaleString();const top=[...pairs].filter(x=>Number.isFinite(x.change)&&Number.isFinite(x.price)).sort((a,b)=>Math.abs(b.change)-Math.abs(a.change)).slice(0,6);const box=$('homeTrending');if(box&&top.length){box.replaceChildren(...top.map(x=>{const b=document.createElement('button');b.className='rwa-command-item rwa-home-row';b.innerHTML=`<div><b>${x.base} / USDT</b><small>${Number(x.price).toLocaleString(undefined,{maximumFractionDigits:x.price>=1?4:7})}</small></div><span class="${x.change>=0?'up':'down'}">${x.change>=0?'+':''}${Number(x.change).toFixed(2)}%</span>`;b.onclick=()=>{selectPair?.(x.symbol,false);openMarkets()};return b}))}}catch{}}
function bindRoutes(){document.addEventListener('click',e=>{const d=e.target.closest('[data-rwa-route]');if(d){e.preventDefault();const r=d.dataset.rwaRoute;if(r==='home')openHome();if(r==='markets')openMarkets();if(r==='trade')openTrade();if(r==='social')openSocial();if(r==='rwa')openSuite('rwa');if(r==='intel')openSuite('intel');return}const m=e.target.closest('[data-mobile-nav]');if(m){const r=m.dataset.mobileNav;if(r==='home'){e.preventDefault();openHome()}else if(r==='markets'){e.preventDefault();openMarkets()}else if(r==='trade'){e.preventDefault();openTrade()}else if(r==='social'){e.preventDefault();openSocial()}else if(r==='portfolio'){e.preventDefault();openSuite('portfolio')}}});addEventListener('keydown',e=>{if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){e.preventDefault();openCommand()}else if(e.key==='Escape')closeCommand()})}
function hasWallet(){try{return /^0x[a-f0-9]{40}$/.test(String(JSON.parse(localStorage.getItem('rwa_wallet_link_v1')||'{}')?.wallet||'').toLowerCase())}catch{return false}}
function deepLink(){if(isTrade)return;const h=location.hash.replace('#','').toLowerCase();if(h==='home')openHome();else if(h==='social')openSocial();else if(h==='portfolio')openSuite('portfolio');else if(h==='copy')openSuite('copy');else if(h==='leaderboard')openSuite('leaderboard');else if(h==='watch')openSuite('watch');else if(h==='rwa')openSuite('rwa');else if(h==='intel')openSuite('intel');else if(h==='markets')openMarkets();else{const d=localStorage.getItem('rwa_default_landing_v3');if(d==='home')openHome();else if(d==='markets')openMarkets();else if(hasWallet())openHome();else openMarkets()}}
function init(){normalizeDesktopNav();normalizeMobileNav();installCommandLayer();installCommandButton();installHome();bindRoutes();deepLink();renderHome();addEventListener('hashchange',deepLink);window.dispatchEvent(new CustomEvent('rwa:product-os-ready'))}
window.RWAProductOS={version:'3.1.1',openHome,openMarkets,openTrade,openSocial,openSuite,openCommand,openTrader,openAsset,setDefaultLanding:v=>localStorage.setItem('rwa_default_landing_v3',v==='markets'?'markets':'home')};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();

/* RWA_SUPERAPP_PATCH_V1 — canonical single-page runtime */
;(()=>{
'use strict';
if(window.__RWA_SUPERAPP_PATCH_V1)return;
window.__RWA_SUPERAPP_PATCH_V1=true;
const $=id=>document.getElementById(id),qa=(s,r=document)=>[...r.querySelectorAll(s)];
const ROOT_PATH='/rwa/';
const legacyOS=window.RWAProductOS?{...window.RWAProductOS}:{};
const ROUTES=new Set(['markets','intelligence','assets','research','social','portfolio','institutional','profile']);
const state={route:'markets',symbol:'BTC',timer:0};
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#039;'}[m]));
const toast=t=>typeof window.toast==='function'?window.toast(t):console.log(t);
const selectedBase=()=>String($('selName')?.textContent||'BTC').split(/[\s\/-]/)[0].replace(/[^A-Za-z0-9]/g,'').toUpperCase()||'BTC';
const pairs=()=>{try{return typeof S!=='undefined'&&Array.isArray(S.pairs)?S.pairs:[]}catch{return[]}};

function routeHash(route){return'#'+String(route||'markets').replace(/^#+/,'')}
function routeNow(){return decodeURIComponent((location.hash||'#markets').slice(1))||'markets'}
function setUrl(route,replace=false){const h=routeHash(route);history[replace?'replaceState':'pushState']({rwa:true,route},'',location.pathname+location.search+h)}
function setActive(name){qa('[data-super-route]').forEach(x=>x.classList.toggle('active',x.dataset.superRoute===name));qa('[data-mobile-super]').forEach(x=>x.classList.toggle('active',x.dataset.mobileSuper===name))}
function hideInternal(){
  document.body.classList.remove('rwa-super-suite','rwa-super-custom','rwa-super-trade','rwa-super-asset');
  for(const id of ['rwaSuperResearch','rwaSuperInstitutional','rwaSuperLegacy']){const e=$(id);if(e)e.hidden=true}
  const suite=$('suite');if(suite){suite.style.display='none';document.body.classList.remove('suite-open')}
}
function showMarketShell(){
  hideInternal();
  document.body.classList.remove('rwa-home-open','social-open','market-drawer-open');
  const layout=document.querySelector('.layout');if(layout)layout.style.removeProperty('display');
  try{legacyOS.openMarkets?.()}catch{}
}
async function loadSuite(tab){
  hideInternal();
  document.body.classList.add('rwa-super-suite');
  try{
    const s=window.RWASuite?.open?window.RWASuite:await window.RWAQuickActions?.loadSuite?.();
    s?.open?.(tab);
    const el=$('suite');if(el)el.style.display='block';
  }catch(e){toast(e?.message||'Workspace unavailable')}
}
function chooseSymbol(sym){
  sym=String(sym||selectedBase()).replace(/[^A-Za-z0-9]/g,'').toUpperCase()||'BTC';state.symbol=sym;
  const row=pairs().find(x=>String(x.base||'').toUpperCase()===sym||String(x.symbol||'').toUpperCase()===sym||String(x.symbol||'').toUpperCase()===sym+'USDT');
  if(row&&typeof selectPair==='function')try{selectPair(row.symbol,false)}catch{}
  return sym;
}
function trade(sym){
  sym=chooseSymbol(sym);showMarketShell();document.body.classList.add('rwa-super-trade');
  setTimeout(()=>{const c=$('exCoin');if(c)c.value=sym;const ex=$('rwaExchange');if(ex)ex.scrollIntoView({behavior:'smooth',block:'start'})},80)
}
function asset(sym){
  sym=chooseSymbol(sym);showMarketShell();document.body.classList.add('rwa-super-asset');
  setTimeout(()=>window.RWAFundamentals?.openAsset?.(sym),100)
}
function researchData(){
  const p=pairs().filter(x=>Number.isFinite(Number(x.change)));const rwa=p.filter(x=>x.rwa);const src=rwa.length?rwa:p;
  const avg=src.length?src.reduce((s,x)=>s+Number(x.change||0),0)/src.length:0;
  const gain=p.filter(x=>Number(x.change)>0).length,loss=p.filter(x=>Number(x.change)<0).length;
  return{p,rwa,avg,gain,loss,top:[...src].sort((a,b)=>Math.abs(Number(b.change||0))-Math.abs(Number(a.change||0))).slice(0,12)}
}
function ensureResearch(){
  if($('rwaSuperResearch'))return;
  const s=document.createElement('section');s.id='rwaSuperResearch';s.className='rwa-super-workspace';s.hidden=true;
  s.innerHTML=`<header class="rwa-super-head"><div><small>RWA RESEARCH</small><h1>Market Research Center</h1><p>Screener, comparison, thesis and live market signals without leaving the terminal.</p></div><div class="rwa-super-head-actions"><button data-super-action="search">⌘K Search</button><button data-super-action="markets">Live Markets</button></div></header><div class="rwa-super-kpis" id="rwaResearchKpis"></div><div class="rwa-super-grid"><article class="rwa-super-card span-8"><div class="rwa-super-card-head"><div><small>SCREENER</small><h2>RWA & market momentum</h2></div><button id="rwaResearchRefresh">Refresh</button></div><div id="rwaResearchRows" class="rwa-super-table"></div></article><article class="rwa-super-card span-4"><small>COMPARE</small><h2>Asset comparison</h2><p class="muted">Select up to three symbols from the screener.</p><div id="rwaCompareChips" class="rwa-chipbox"></div><div id="rwaCompareBody"></div></article><article class="rwa-super-card span-6"><small>THESIS</small><h2>Research notebook</h2><textarea id="rwaResearchNote" maxlength="1000" placeholder="Catalyst, thesis, invalidation, risk…"></textarea><div class="rwa-super-actions"><small id="rwaResearchSaved">Saved locally on this device</small><button id="rwaSaveResearch">Save note</button></div></article><article class="rwa-super-card span-6"><small>SIGNALS</small><h2>Live signal board</h2><div id="rwaSignalBoard"></div></article></div>`;
  const marker=document.querySelector('.credibility-strip')||document.querySelector('.mobile-tabs');(marker?.parentNode||document.body).insertBefore(s,marker||null);
  s.addEventListener('click',e=>{const r=e.target.closest('[data-research-symbol]');if(r){const sym=r.dataset.researchSymbol;const selected=JSON.parse(localStorage.getItem('rwa_super_compare_v1')||'[]').filter(Boolean);const next=selected.includes(sym)?selected.filter(x=>x!==sym):[...selected,sym].slice(-3);localStorage.setItem('rwa_super_compare_v1',JSON.stringify(next));renderResearch()}if(e.target.closest('#rwaResearchRefresh'))renderResearch();if(e.target.closest('#rwaSaveResearch')){localStorage.setItem('rwa_super_research_note_v1',$('rwaResearchNote')?.value||'');toast('Research note saved')}});
}
function renderResearch(){
  ensureResearch();const d=researchData(),cmp=JSON.parse(localStorage.getItem('rwa_super_compare_v1')||'[]');
  $('rwaResearchKpis').innerHTML=`<div><small>RWA INDEX</small><b class="${d.avg>=0?'up':'down'}">${d.avg>=0?'+':''}${d.avg.toFixed(2)}%</b><span>Average live RWA-linked move</span></div><div><small>MARKET BREADTH</small><b>${d.gain} / ${d.loss}</b><span>Gainers / losers</span></div><div><small>RWA UNIVERSE</small><b>${d.rwa.length||'—'}</b><span>Tracked RWA-linked pairs</span></div><div><small>LIVE MARKETS</small><b>${d.p.length||'—'}</b><span>Public exchange feed</span></div>`;
  $('rwaResearchRows').innerHTML=d.top.length?d.top.map(x=>`<button class="rwa-super-row ${cmp.includes(x.base)?'selected':''}" data-research-symbol="${esc(x.base)}"><b>${esc(x.base)} / USDT</b><span>${Number(x.price||0).toLocaleString(undefined,{maximumFractionDigits:Number(x.price)>=1?4:7})}</span><span class="${Number(x.change)>=0?'up':'down'}">${Number(x.change)>=0?'+':''}${Number(x.change).toFixed(2)}%</span><small>${x.rwa?'RWA':'MARKET'}</small></button>`).join(''):'<div class="rwa-super-empty">Waiting for live markets…</div>';
  $('rwaCompareChips').innerHTML=cmp.length?cmp.map(x=>`<button data-research-symbol="${esc(x)}">${esc(x)} ×</button>`).join(''):'<span class="muted">Select assets from screener</span>';
  const rows=cmp.map(sym=>d.p.find(x=>x.base===sym)).filter(Boolean);$('rwaCompareBody').innerHTML=rows.map(x=>`<div class="rwa-compare-row"><b>${esc(x.base)}</b><span>${Number(x.price||0).toLocaleString(undefined,{maximumFractionDigits:6})}</span><strong class="${Number(x.change)>=0?'up':'down'}">${Number(x.change)>=0?'+':''}${Number(x.change).toFixed(2)}%</strong></div>`).join('');
  if($('rwaResearchNote')&&document.activeElement!==$('rwaResearchNote'))$('rwaResearchNote').value=localStorage.getItem('rwa_super_research_note_v1')||'';
  $('rwaSignalBoard').innerHTML=d.top.slice(0,6).map(x=>`<button class="rwa-signal" data-super-asset="${esc(x.base)}"><span>${Number(x.change)>=0?'▲':'▼'}</span><div><b>${esc(x.base)}</b><small>${Math.abs(Number(x.change)).toFixed(2)}% 24h move · ${x.rwa?'RWA-linked':'live market'}</small></div></button>`).join('')||'<div class="rwa-super-empty">Signals load from live market data.</div>';
}
function ensureInstitutional(){
  if($('rwaSuperInstitutional'))return;
  const s=document.createElement('section');s.id='rwaSuperInstitutional';s.className='rwa-super-workspace';s.hidden=true;
  s.innerHTML=`<header class="rwa-super-head institutional-hero"><div><small>RWA INSTITUTIONAL</small><h1>Issue, verify and operate real-world assets</h1><p>One workspace for issuer onboarding, tokenization, liquidity, custody, compliance and API access.</p></div><div class="rwa-super-head-actions"><button data-super-action="assets">Asset Registry</button><button data-super-action="portfolio">Portfolio</button></div></header><div class="rwa-institution-grid"><article><span>01</span><small>ISSUER</small><h2>Onboarding & KYB</h2><p>Entity, SPV, ownership evidence, reviewer workflow and disclosures.</p></article><article><span>02</span><small>TOKENIZATION</small><h2>Asset structuring</h2><p>Supply, ownership rights, income rights, NAV and distribution schedule.</p></article><article><span>03</span><small>LIQUIDITY</small><h2>Market operations</h2><p>Discovery, order flow, venue connectivity and market-quality monitoring.</p></article><article><span>04</span><small>CUSTODY</small><h2>Non-custodial control</h2><p>Wallet identity, protected execution and explicit user approvals.</p></article><article><span>05</span><small>COMPLIANCE</small><h2>Evidence & audit</h2><p>Legal records, appraisal, KYB, disclosure and reviewer-backed status.</p></article><article><span>06</span><small>API</small><h2>Institutional integration</h2><p>Connect internal systems to market data, execution and asset registry.</p></article></div><article class="rwa-super-card institutional-request"><div><small>REQUEST ACCESS</small><h2>Institutional workspace request</h2><p class="muted">Saved locally for this public beta; no request is transmitted without a configured backend.</p></div><div class="rwa-institution-form"><input id="rwaInstOrg" placeholder="Organization"><input id="rwaInstEmail" type="email" placeholder="Work email"><input id="rwaInstAsset" placeholder="Asset / use case"><button id="rwaInstSave">Save request</button></div><small id="rwaInstStatus"></small></article>`;
  const marker=document.querySelector('.credibility-strip')||document.querySelector('.mobile-tabs');(marker?.parentNode||document.body).insertBefore(s,marker||null);
  s.addEventListener('click',e=>{if(e.target.closest('#rwaInstSave')){const row={org:$('rwaInstOrg')?.value.trim(),email:$('rwaInstEmail')?.value.trim(),asset:$('rwaInstAsset')?.value.trim(),ts:Date.now()};localStorage.setItem('rwa_institutional_request_v1',JSON.stringify(row));$('rwaInstStatus').textContent='Saved locally · backend submission remains disabled in public beta';toast('Institutional request saved locally')}})
}
function ensureLegacy(){
  if($('rwaSuperLegacy'))return;const s=document.createElement('section');s.id='rwaSuperLegacy';s.className='rwa-super-workspace legacy';s.hidden=true;s.innerHTML=`<header class="rwa-super-head"><div><small>INTERNAL WORKSPACE</small><h1 id="rwaLegacyTitle">Workspace</h1><p>Embedded inside the RWA Super App. The browser remains on /rwa/.</p></div><button data-super-action="markets">× Close</button></header><iframe id="rwaLegacyFrame" title="RWA internal workspace" loading="eager"></iframe>`;const marker=document.querySelector('.credibility-strip')||document.querySelector('.mobile-tabs');(marker?.parentNode||document.body).insertBefore(s,marker||null)
}
function legacy(kind,query=''){
  ensureLegacy();hideInternal();document.body.classList.add('rwa-super-custom');const s=$('rwaSuperLegacy');s.hidden=false;const safe=kind==='renko'?'renko/':'backtest/';$('rwaLegacyTitle').textContent=kind==='renko'?'Renko Research':'Backtest Research';$('rwaLegacyFrame').src=safe+(query||'')
}
function ensurePreview(){
  if($('rwaExternalPreview'))return;const d=document.createElement('div');d.id='rwaExternalPreview';d.className='rwa-external-preview';d.hidden=true;d.innerHTML=`<div class="rwa-preview-card"><header><div><small>EXTERNAL EVIDENCE · IN-APP VIEW</small><b id="rwaPreviewTitle">Document preview</b></div><button id="rwaPreviewClose">×</button></header><div class="rwa-preview-url"><span id="rwaPreviewUrl"></span><button id="rwaPreviewCopy">Copy link</button></div><iframe id="rwaPreviewFrame" title="External evidence preview"></iframe><p>Some providers block iframe previews. The RWA app will still keep this URL available for copying without navigating away.</p></div>`;document.body.appendChild(d);d.addEventListener('click',e=>{if(e.target===d||e.target.closest('#rwaPreviewClose'))d.hidden=true;if(e.target.closest('#rwaPreviewCopy'))navigator.clipboard?.writeText($('rwaPreviewUrl')?.textContent||'').then(()=>toast('Link copied')).catch(()=>{})})
}
function preview(url,title='External evidence'){
  try{const u=new URL(url,location.href);ensurePreview();$('rwaPreviewTitle').textContent=title;$('rwaPreviewUrl').textContent=u.href;$('rwaPreviewFrame').src=u.href;$('rwaExternalPreview').hidden=false}catch{toast('Invalid link')}
}
function ensureTicker(){
  if($('rwaGlobalTicker'))return;const f=document.createElement('footer');f.id='rwaGlobalTicker';f.className='rwa-global-ticker';f.innerHTML='<b>RWA LIVE</b><div id="rwaTickerRows">Market network connecting…</div><span id="rwaTickerStatus">● LIVE</span>';document.body.appendChild(f);setInterval(renderTicker,4000);renderTicker()
}
function renderTicker(){const p=pairs().filter(x=>Number.isFinite(Number(x.change))).slice(0,8);const b=$('rwaTickerRows');if(b)b.innerHTML=p.length?p.map(x=>`<span><b>${esc(x.base)}</b> <i class="${Number(x.change)>=0?'up':'down'}">${Number(x.change)>=0?'+':''}${Number(x.change).toFixed(2)}%</i></span>`).join(''):'Market network connecting…'}
function ensureContextInsight(){
  const right=$('depth');if(!right||$('rwaContextInsight'))return;const s=document.createElement('section');s.id='rwaContextInsight';s.className='right-section rwa-context-insight';s.innerHTML=`<div class="right-title"><span>AI INSIGHT</span><small>Live heuristic</small></div><div id="rwaInsightBody" class="rwa-insight-body">Waiting for market context…</div>`;right.prepend(s);setInterval(renderInsight,3500);renderInsight()
}
function renderInsight(){const x=pairs().find(p=>p.base===selectedBase());const e=$('rwaInsightBody');if(!e||!x)return;const ch=Number(x.change||0),bias=ch>2?'Momentum positive':ch<-2?'Momentum negative':'Momentum balanced';const risk=Math.abs(ch)>8?'High volatility':Math.abs(ch)>4?'Elevated volatility':'Normal volatility';e.innerHTML=`<b class="${ch>=0?'up':'down'}">${esc(bias)}</b><p>${esc(x.base)} is ${ch>=0?'up':'down'} ${Math.abs(ch).toFixed(2)}% over 24h. ${risk}. This is a transparent market heuristic, not a prediction.</p><button data-super-action="research">Open Research</button>`}
function normalizeNav(){
  const top=document.querySelector('.topnav');if(top)top.innerHTML=`<a href="#markets" data-super-route="markets">Markets</a><a href="#intelligence" data-super-route="intelligence">Intelligence</a><a href="#assets" data-super-route="assets">Assets</a><a href="#research" data-super-route="research">Research</a><a href="#portfolio" data-super-route="portfolio">Portfolio</a><a href="#social" data-super-route="social">Social</a><a href="#institutional" data-super-route="institutional">Institutional</a>`;
  const p=document.querySelector('.product-nav');if(p)p.innerHTML=`<a href="#markets" data-super-route="markets">Live Markets</a><a href="#assets" data-super-route="assets">Asset Marketplace</a><a href="#research" data-super-route="research">Research</a><a href="#trade/${selectedBase()}" data-super-trade="current">Trade</a><a href="#portfolio" data-super-action="watch">Watchlist</a>`;
  const m=document.querySelector('.mobile-tabs');if(m)m.innerHTML=`<a href="#markets" data-mobile-super="markets"><span>⌕</span><small>Markets</small></a><a href="#search" data-mobile-super="search"><span>⌕</span><small>Search</small></a><a href="#trade/${selectedBase()}" data-mobile-super="trade"><span>↗</span><small>Trade</small></a><a href="#social" data-mobile-super="social"><span>◎</span><small>Social</small></a><a href="#portfolio" data-mobile-super="portfolio"><span>▣</span><small>Portfolio</small></a>`;
  const inst=document.querySelector('.top-actions .institutional');if(inst){inst.classList.remove('institutional');inst.dataset.superRoute='institutional';inst.textContent='Institutional'}
  const actions=document.querySelector('.top-actions');if(actions&&!actions.querySelector('[data-super-profile]')){const n=document.createElement('button');n.type='button';n.dataset.superNotifications='1';n.className='rwa-super-icon';n.textContent='◌';n.title='Notifications';const pbtn=document.createElement('button');pbtn.type='button';pbtn.dataset.superProfile='1';pbtn.className='rwa-super-icon';pbtn.textContent='◎';pbtn.title='Profile';actions.append(n,pbtn)}
}
async function apply(route,replace=false){
  route=String(route||'markets').replace(/^#+/,'');const [head,...rest]=route.split('/');state.route=head;normalizeNav();ensureResearch();ensureInstitutional();ensureLegacy();ensurePreview();ensureTicker();ensureContextInsight();
  if(head==='search'){window.RWAProductOS?.openCommand?.();setActive('search');return}
  if(head==='markets'||head==='home'){showMarketShell();setActive('markets')}
  else if(head==='intelligence'||head==='intel'){await loadSuite('intel');setActive('intelligence')}
  else if(head==='assets'||head==='rwa'){await loadSuite('rwa');setActive('assets')}
  else if(head==='asset'){asset(rest[0]||selectedBase());setActive('assets')}
  else if(head==='research'){hideInternal();document.body.classList.add('rwa-super-custom');$('rwaSuperResearch').hidden=false;renderResearch();setActive('research')}
  else if(head==='social'){await loadSuite('feed');setActive('social')}
  else if(head==='portfolio'){await loadSuite('portfolio');setActive('portfolio')}
  else if(head==='institutional'||head==='company'){hideInternal();document.body.classList.add('rwa-super-custom');$('rwaSuperInstitutional').hidden=false;setActive('institutional')}
  else if(head==='profile'){await loadSuite('profile');setActive('profile')}
  else if(head==='trade'){trade(rest[0]||selectedBase());setActive('trade')}
  else if(head==='backtest'){legacy('backtest',location.search);setActive('research')}
  else if(head==='renko'){legacy('renko',location.search);setActive('research')}
  else if(head==='trader'){await loadSuite('leaderboard');setActive('social');const wallet=rest.join('/');setTimeout(()=>{const i=$('leaderWalletSearch');if(i&&wallet){i.value=wallet;$('inspectTrader')?.click()}},200)}
  else{if(!replace)setUrl('markets',true);showMarketShell();setActive('markets')}
  renderTicker();renderInsight()
}
function navigate(route,replace=false){setUrl(route,replace);return apply(route,replace)}
function mapHref(href){
  try{const u=new URL(href,location.href);if(u.origin!==location.origin)return{external:u.href};if(!u.pathname.startsWith(ROOT_PATH))return{external:u.href};const rel=u.pathname.slice(ROOT_PATH.length);const q=u.searchParams;if(!rel)return{route:(u.hash||'#markets').slice(1)||'markets'};if(rel.startsWith('trade'))return{route:'trade/'+(q.get('coin')||selectedBase())};if(rel.startsWith('asset'))return{route:'asset/'+(q.get('symbol')||selectedBase())};if(rel.startsWith('trader'))return{route:'trader/'+(q.get('wallet')||'')};if(rel.startsWith('backtest'))return{route:'backtest'};if(rel.startsWith('renko'))return{route:'renko'};return{route:(u.hash||'#markets').slice(1)||'markets'}
  }catch{return null}
}
function commandRoute(el){const tag=el?.lastElementChild?.textContent?.trim?.().toUpperCase()||'',q=String($('rwaCommandInput')?.value||'').toUpperCase();const skip=new Set(['TRADE','BACKTEST','RENKO','ASSET','MARKET','OPEN','SHOW','COPY','PORTFOLIO','SOCIAL','HOME','INTELLIGENCE','RWA','LEADERBOARD','DEFAULT','TERMINAL','RESEARCH']);const sym=(q.match(/\b[A-Z0-9]{2,12}\b/g)||[]).find(x=>!skip.has(x))||selectedBase();if(tag==='TRADE')return'trade/'+sym;if(tag==='ASSET')return'asset/'+sym;if(tag==='BACKTEST')return'backtest';if(tag==='RENKO')return'renko';if(tag==='PORTFOLIO')return'portfolio';if(tag==='SOCIAL')return'social';if(tag==='INTEL')return'intelligence';if(tag==='RWA')return'assets';return''}
function clickGuard(e){
  const ev=e.target.closest?.('[data-rwa-evidence]');if(ev?.dataset?.rwaEvidence){e.preventDefault();e.stopImmediatePropagation();preview(ev.dataset.rwaEvidence,'RWA evidence');return}
  const ext=e.target.closest?.('[data-rwa-external]');if(ext?.dataset?.rwaExternal){e.preventDefault();e.stopImmediatePropagation();preview(ext.dataset.rwaExternal);return}
  const sr=e.target.closest?.('[data-super-route]');if(sr){e.preventDefault();e.stopImmediatePropagation();navigate(sr.dataset.superRoute);return}
  const ma=e.target.closest?.('[data-mobile-super]');if(ma){e.preventDefault();e.stopImmediatePropagation();const r=ma.dataset.mobileSuper;if(r==='trade')navigate('trade/'+selectedBase());else if(r==='search')navigate('search');else navigate(r);return}
  const act=e.target.closest?.('[data-super-action]');if(act){e.preventDefault();e.stopImmediatePropagation();const a=act.dataset.superAction;if(a==='search')navigate('search');else if(a==='watch'){loadSuite('watch');setUrl('portfolio')}else navigate(a);return}
  if(e.target.closest?.('[data-super-trade]')){e.preventDefault();e.stopImmediatePropagation();navigate('trade/'+selectedBase());return}
  if(e.target.closest?.('[data-super-profile]')){e.preventDefault();e.stopImmediatePropagation();navigate('profile');return}
  if(e.target.closest?.('[data-super-notifications]')){e.preventDefault();e.stopImmediatePropagation();loadSuite('watch');setUrl('portfolio');return}
  if(e.target.closest?.('[data-rwa-trade-now]')){e.preventDefault();e.stopImmediatePropagation();navigate('trade/'+selectedBase());return}
  if(e.target.closest?.('.institutional,.institutional-card button')){e.preventDefault();e.stopImmediatePropagation();navigate('institutional');return}
  const ha=e.target.closest?.('[data-home-action]');if(ha){const a=ha.dataset.homeAction;if(['trade','portfolio','social','rwa','backtest','renko'].includes(a)){e.preventDefault();e.stopImmediatePropagation();navigate(a==='rwa'?'assets':a==='trade'?'trade/'+selectedBase():a);return}}
  const ci=e.target.closest?.('.rwa-command-item');if(ci){const r=commandRoute(ci);if(r){e.preventDefault();e.stopImmediatePropagation();const layer=$('rwaCommandLayer');if(layer)layer.hidden=true;navigate(r);return}}
  const a=e.target.closest?.('a[href]');if(a){const href=a.getAttribute('href');if(!href||href.startsWith('javascript:'))return;if(href.startsWith('#')){const r=href.slice(1);if(r){e.preventDefault();e.stopImmediatePropagation();navigate(r==='terminal'?'markets':r==='suite'?'portfolio':r);return}}const m=mapHref(href);if(m?.route){e.preventDefault();e.stopImmediatePropagation();navigate(m.route);return}if(m?.external){e.preventDefault();e.stopImmediatePropagation();preview(m.external,a.textContent?.trim()||'External link');return}}
}
function marketClick(e){const row=e.target.closest?.('.pairrow[data-sym]');if(!row)return;const sym=String(row.dataset.sym||'').replace(/USDT$/,'');setTimeout(()=>{if(state.route==='markets'||state.route==='asset')navigate('asset/'+sym,true)},120)}
function patchAPI(){
  if(!window.RWAProductOS)return;window.RWAProductOS.openMarkets=()=>navigate('markets');window.RWAProductOS.openTrade=s=>navigate('trade/'+(s||selectedBase()));window.RWAProductOS.openAsset=s=>navigate('asset/'+(s||selectedBase()));window.RWAProductOS.openSocial=()=>navigate('social');window.RWAProductOS.openTrader=w=>navigate('trader/'+(w||''));window.RWAProductOS.navigate=navigate;
  if(window.RWAQuickActions){window.RWAQuickActions.trade=()=>navigate('trade/'+selectedBase());window.RWAQuickActions.institutional=()=>navigate('institutional');window.RWAQuickActions.social=()=>navigate('social')}
}
function boot(){normalizeNav();ensureResearch();ensureInstitutional();ensureLegacy();ensurePreview();ensureTicker();ensureContextInsight();patchAPI();apply(routeNow(),true);setTimeout(patchAPI,800);setTimeout(()=>apply(routeNow(),true),1200);document.addEventListener('click',clickGuard,true);document.addEventListener('click',marketClick,false);addEventListener('popstate',()=>apply(routeNow(),true));addEventListener('keydown',e=>{const tag=(e.target?.tagName||'').toLowerCase();if(e.key==='/'&&!e.metaKey&&!e.ctrlKey&&!['input','textarea','select'].includes(tag)){e.preventDefault();navigate('search')}if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){e.preventDefault();navigate('search')}});window.addEventListener('rwa:product-os-ready',()=>{patchAPI();normalizeNav()});window.addEventListener('rwa:suite-extensions-ready',patchAPI);state.timer=setInterval(()=>{renderTicker();if(state.route==='research')renderResearch()},5000)}
window.RWASuperApp={version:'1.0.0',canonical:'https://copytolive.github.io/rwa/',navigate,apply,preview,state:()=>({...state})};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();

/* RWA_SUPERAPP_GUARD_V2 — no-exit compatibility guard */
;(()=>{
'use strict';
if(window.__RWA_SUPERAPP_GUARD_V2)return;
window.__RWA_SUPERAPP_GUARD_V2=true;
const ROOT='/rwa/';
const nativeOpen=window.open?.bind(window);
function app(){return window.RWASuperApp}
function safe(u){try{return new URL(String(u||''),location.href)}catch{return null}}
function routeOf(u){
  if(!u||u.origin!==location.origin||!u.pathname.startsWith(ROOT))return'';
  const rel=u.pathname.slice(ROOT.length),q=u.searchParams;
  if(!rel)return (u.hash||'#markets').slice(1)||'markets';
  if(rel.startsWith('trade'))return 'trade/'+(q.get('coin')||'BTC');
  if(rel.startsWith('asset'))return 'asset/'+(q.get('symbol')||'BTC');
  if(rel.startsWith('trader'))return 'trader/'+(q.get('wallet')||'');
  if(rel.startsWith('backtest'))return 'backtest';
  if(rel.startsWith('renko'))return 'renko';
  return (u.hash||'#markets').slice(1)||'markets';
}
function keep(url,title='External resource'){
  const u=safe(url);if(!u)return null;
  const route=routeOf(u);
  if(route){app()?.navigate?.(route);return null}
  app()?.preview?.(u.href,title);return null;
}
window.open=function(url,target,features){
  const u=safe(url);
  if(u && /^https?:$/.test(u.protocol))return keep(u.href,'External resource');
  return nativeOpen?nativeOpen(url,target,features):null;
};
function guardFrame(frame){
  if(!frame||frame.dataset.rwaNoExitGuard==='1')return;
  frame.dataset.rwaNoExitGuard='1';
  frame.addEventListener('load',()=>{
    try{
      const w=frame.contentWindow,d=frame.contentDocument;if(!w||!d)return;
      w.open=(url)=>{keep(url,'Workspace resource');return null};
      d.addEventListener('click',e=>{
        const a=e.target.closest?.('a[href]');if(!a)return;
        const u=safe(a.href);if(!u)return;
        if(u.origin!==location.origin){e.preventDefault();e.stopImmediatePropagation();keep(u.href,a.textContent?.trim()||'Workspace resource')}
      },true);
    }catch{}
  });
}
function scan(){document.querySelectorAll('#rwaLegacyFrame').forEach(guardFrame)}
scan();
new MutationObserver(scan).observe(document.documentElement,{subtree:true,childList:true});
addEventListener('rwa:product-os-ready',scan);
})();
