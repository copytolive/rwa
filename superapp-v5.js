(()=>{
'use strict';
if(window.RWASuperApp?.version==='5.0.0')return;

const ROOT_PATH='/rwa/';
const $=id=>document.getElementById(id);
const qa=(s,r=document)=>[...r.querySelectorAll(s)];
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
const money=v=>{const n=Number(v);if(!Number.isFinite(n))return'—';const d=Math.abs(n)>=1000?2:Math.abs(n)>=1?4:7;return'$'+n.toLocaleString(undefined,{maximumFractionDigits:d})};
const compact=v=>{const n=Number(v);return Number.isFinite(n)?'$'+Intl.NumberFormat('en',{notation:'compact',maximumFractionDigits:2}).format(n):'—'};
const pct=v=>{const n=Number(v);return Number.isFinite(n)?`${n>=0?'+':''}${n.toFixed(2)}%`:'—'};
const numText=id=>{const t=$(id)?.textContent||'';const n=Number(String(t).replace(/[^0-9,.-]/g,'').replace(/,/g,''));return Number.isFinite(n)?n:null};
const toastSafe=t=>typeof window.toast==='function'?window.toast(t):console.log(t);
const state={route:'markets',symbol:'BTC',assets:[],assetsLoaded:false,catalog:[],catalogLoaded:false,workspace:null,researchNotes:[],compare:[],researchTab:'screener',assetTab:'overview',timer:null,lastDataAt:Date.now(),health:{online:navigator.onLine,market:'connecting',wallet:'idle'},lazy:new Map()};

function selectedBase(){
  const t=$('selName')?.textContent||'BTC / USDT';
  return String(t).split(/[\/\s-]/)[0].replace(/[^A-Za-z0-9]/g,'').toUpperCase()||'BTC';
}
function pairs(){
  try{return typeof S!=='undefined'&&Array.isArray(S.pairs)?S.pairs:[]}catch{return[]}
}
function selectedPair(){
  try{return typeof S!=='undefined'&&S.map?S.map.get(S.selected):null}catch{return null}
}
function currentSnapshot(){
  const x=selectedPair();
  return{
    base:x?.base||selectedBase(),
    symbol:x?.symbol||`${selectedBase()}USDT`,
    price:Number.isFinite(Number(x?.price))?Number(x.price):numText('statPrice'),
    change:Number.isFinite(Number(x?.change))?Number(x.change):numText('statChange'),
    high:Number.isFinite(Number(x?.high))?Number(x.high):numText('statHigh'),
    low:Number.isFinite(Number(x?.low))?Number(x.low):numText('statLow'),
    vol:Number.isFinite(Number(x?.vol))?Number(x.vol):numText('statVol'),
    buy:numText('buyPct'),
    bid:numText('bestBid'),
    ask:numText('bestAsk')
  };
}
function safeHash(route){return'#'+String(route||'markets').replace(/^#+/,'')}
function updateHash(route,{replace=false}={}){
  const h=safeHash(route);
  if(location.hash===h)return;
  try{history[replace?'replaceState':'pushState']({rwaRoute:route},'',`${location.pathname}${location.search}${h}`)}
  catch{location.hash=h}
}
function cleanRoute(raw){
  let r=String(raw||'').replace(/^#/,'').replace(/^\/+/,'').trim();
  if(!r||r==='terminal'||r==='chart'||r==='home')return'markets';
  const aliases={intel:'intelligence',rwa:'assets',feed:'social',company:'institutional',hub:'portfolio'};
  const first=r.split('/')[0].toLowerCase();
  if(aliases[first])r=aliases[first]+r.slice(first.length);
  return r;
}
function routeParts(raw){
  const r=cleanRoute(raw),p=r.split('/').filter(Boolean);
  return{raw:r,name:(p[0]||'markets').toLowerCase(),arg:(p[1]||'').toUpperCase(),extra:p.slice(2)};
}
function setActive(name){
  qa('[data-v5-route]').forEach(x=>x.classList.toggle('active',x.dataset.v5Route===name));
  qa('[data-v5-mobile]').forEach(x=>x.classList.toggle('active',x.dataset.v5Mobile===name||(name==='trade'&&x.dataset.v5Mobile==='trade')));
}
function hideSuite(){
  document.body.classList.remove('suite-open','rwa-super-suite-open');
  const s=$('suite');if(s)s.style.display='none';
}
function hideWorkspace(){
  const w=$('rwaSuperWorkspace');if(w)w.hidden=true;
  document.body.classList.remove('rwa-super-asset-workspace');
  state.workspace=null;
  document.body.classList.remove('rwa-super-workspace-open');
}
function closeFundamentals(){try{window.RWAFundamentals?.close?.()}catch{}}
function showMarketShell({keepFundamentals=false}={}){
  hideWorkspace();hideSuite();
  document.body.classList.remove('rwa-home-open','social-open','market-drawer-open');
  document.body.classList.remove('rwa-super-suite-open');
  document.body.classList.add('rwa-super-market-open');
  if(!keepFundamentals)closeFundamentals();
}
async function ensureSuite(){
  if(window.RWASuite?.version==='2.0.0'&&typeof window.RWASuite.open==='function')return window.RWASuite;
  await loadStyleOnce('suite.css?v=1','suite-style');
  await loadScriptOnce('suite-ui.js?v=1','suite-ui');
  await loadScriptOnce('suite.js?v=1','suite-loader');
  await loadScriptOnce('suite-nav.js?v=1','suite-nav');
  for(let i=0;i<100;i++){if(window.RWASuite?.version==='2.0.0'&&typeof window.RWASuite.open==='function')return window.RWASuite;await new Promise(r=>setTimeout(r,35))}
  throw Error('RWA Suite is not ready');
}
async function openSuite(tab,routeName){
  hideWorkspace();closeFundamentals();
  document.body.classList.remove('rwa-super-market-open');
  document.body.classList.add('rwa-super-suite-open');
  try{
    const s=await ensureSuite();s.open(tab);
    const el=$('suite');if(el)el.style.display='block';
    setTimeout(()=>decorateSuite(tab),80);
    setActive(routeName||tab);
  }catch(e){toastSafe(e.message||'Workspace unavailable')}
}

function decorateSuite(tab){
  const head=document.querySelector('#suite .suite-head-actions');if(!head)return;
  let trade=head.querySelector('[data-v5-suite-trade]');
  if(!trade){trade=document.createElement('button');trade.type='button';trade.dataset.v5SuiteTrade='1';trade.dataset.v5Action='trade';trade.textContent='Trade selected';head.appendChild(trade)}
  trade.hidden=!['portfolio','feed','leaderboard','copy'].includes(tab);
  let back=head.querySelector('[data-v5-suite-markets]');
  if(!back){back=document.createElement('button');back.type='button';back.dataset.v5SuiteMarkets='1';back.dataset.v5Action='markets';back.textContent='Markets';head.appendChild(back)}
}
function selectSymbol(base){
  const b=String(base||selectedBase()).toUpperCase().replace(/[^A-Z0-9]/g,'')||'BTC';
  state.symbol=b;
  const ps=pairs(),match=ps.find(x=>String(x.base).toUpperCase()===b)||ps.find(x=>String(x.symbol).toUpperCase()===`${b}USDT`);
  if(match&&typeof window.selectPair==='function'){
    try{window.selectPair(match.symbol,false)}catch{}
  }else if(match&&typeof selectPair==='function'){
    try{selectPair(match.symbol,false)}catch{}
  }
  return b;
}

function navigate(route,{replace=false}={}){
  const r=cleanRoute(route);
  updateHash(r,{replace});
  applyRoute(r);
}
function applyRoute(raw){
  const {name,arg,extra}=routeParts(raw);
  state.route=cleanRoute(raw);
  document.documentElement.dataset.rwaRoute=state.route;document.documentElement.dataset.rwaPath=location.pathname;
  setActive(name);
  if(name==='markets'){showMarketShell();scrollToTerminal();return}
  if(name==='trade'){openTrade(arg||selectedBase(),false);return}
  if(name==='asset'){openAsset(arg||selectedBase(),false);return}
  if(name==='assets'){showWorkspace('assets');return}
  if(name==='intelligence'){showWorkspace('intelligence');return}
  if(name==='research'){showWorkspace('research',{tool:(arg||'').toLowerCase(),symbol:extra[0]||selectedBase()});return}
  if(name==='portfolio'){openSuite('portfolio','portfolio');return}
  if(name==='social'){openSuite('feed','social').then(()=>ensureSocialLegacy().then(()=>window.RWASocialTradingPro?.load?.({notify:false}))).catch(()=>{});return}
  if(name==='institutional'){showWorkspace('institutional');return}
  if(name==='trader'){openTrader(arg,false);return}
  navigate('markets',{replace:true});
}
function scrollToTerminal(){
  const t=$('terminal');if(t)setTimeout(()=>t.scrollIntoView({behavior:'auto',block:'start'}),0);
}
function openMarkets(push=true){
  if(push)updateHash('markets');
  showMarketShell();setActive('markets');scrollToTerminal();
}
function openTrade(base=selectedBase(),push=true,side=''){
  const b=selectSymbol(base);
  if(push)updateHash(`trade/${b}`);
  showMarketShell();setActive('trade');
  const sync=()=>{
    const coin=$('exCoin');if(coin)coin.value=b;
    if(side==='BUY')$('exLong')?.click();
    if(side==='SELL')$('exShort')?.click();
    /* RWA_ACTION_VIEWPORT_STABILITY_V7: trade routing must not move the root viewport. */
    const ex=$('rwaExchange')||$('terminal');
    if(ex)ex.dataset.rwaTradeReady='1';
  };
  const terminal=$('terminal');
  if(!$('rwaExchange')&&terminal&&!$('rwaTradeLazyStatus')){const n=document.createElement('div');n.id='rwaTradeLazyStatus';n.className='rwa-lazy-status';n.textContent='Loading protected execution…';terminal.appendChild(n)}
  ensureTrade().then(()=>{const n=$('rwaTradeLazyStatus');if(n)n.remove();sync();setTimeout(sync,220)}).catch(e=>{const n=$('rwaTradeLazyStatus');if(n)n.textContent='Execution unavailable · '+(e.message||e);toastSafe(e.message||'Execution unavailable')});
}
function openAsset(base=selectedBase(),push=true){
  const b=selectSymbol(base);
  if(push)updateHash(`asset/${b}`);
  state.assetTab='overview';
  showWorkspace('asset',{symbol:b});setActive('assets');
}
async function openTrader(wallet='',push=true){
  if(push)updateHash(`trader/${String(wallet||'').replace(/[^a-zA-Z0-9]/g,'')}`);
  await openSuite('leaderboard','social');
  if(wallet){
    setTimeout(()=>{
      const input=$('leaderWalletSearch');if(input)input.value=wallet;
      $('inspectTrader')?.click();
    },220);
  }
}
function openSocial(){navigate('social')}
function openPortfolio(){navigate('portfolio')}
function openIntelligence(){navigate('intelligence')}
function openAssets(){navigate('assets')}
function openResearch(tool=''){navigate(tool?`research/${tool}/${selectedBase()}`:'research')}
function openInstitutional(){navigate('institutional')}

function installShell(){
  if(document.body?.classList.contains('rwa-target-dashboard-v2')){installWorkspace();installQuickDock();installTicker();return}
  const top=document.querySelector('.topnav');
  if(top)top.innerHTML=[
    ['markets','Markets'],['intelligence','Intelligence'],['assets','Assets'],
    ['research','Research'],['portfolio','Portfolio'],['institutional','Institutional']
  ].map(([r,l])=>`<span role="button" tabindex="0" data-v5-route="${r}">${l}</span>`).join('');

  const pn=document.querySelector('.product-nav');
  if(pn)pn.innerHTML=[
    ['markets','Live Markets'],['assets','Asset Marketplace'],['research','Research'],['social','Social']
  ].map(([r,l])=>`<span role="button" tabindex="0" data-v5-route="${r}">${l}</span>`).join('');

  const left=document.querySelector('.product-left');
  if(left)left.innerHTML='<strong id="rwaWorkspaceLabel">Markets</strong><span>RWA Super App</span><span class="beta">LIVE</span>';

  const mobile=document.querySelector('.mobile-tabs');
  if(mobile)mobile.innerHTML=`
    <span role="button" tabindex="0" data-v5-mobile="markets" data-v5-route="markets"><span>⌂</span><small>Markets</small></span>
    <span role="button" tabindex="0" data-v5-mobile="search" data-v5-action="search"><span>⌕</span><small>Search</small></span>
    <span role="button" tabindex="0" data-v5-mobile="trade" data-v5-action="trade"><span>↗</span><small>Trade</small></span>
    <span role="button" tabindex="0" data-v5-mobile="social" data-v5-route="social"><span>◎</span><small>Social</small></span>
    <span role="button" tabindex="0" data-v5-mobile="portfolio" data-v5-route="portfolio"><span>▣</span><small>Portfolio</small></span>`;

  const ia=document.querySelector('.instrument-actions');if(ia){[...ia.querySelectorAll('button')].forEach(b=>{const t=(b.textContent||'').toLowerCase();b.removeAttribute('onclick');if(t.includes('watch'))b.dataset.v5Action='watch';else if(t.includes('alert'))b.dataset.v5Action='alert';else if(t.includes('share'))b.dataset.v5Action='share'})}
  installCommandButton();
  installWorkspace();
  installQuickDock();
  installTicker();
}
function installCommandButton(){
  const host=document.querySelector('.top-actions');if(!host)return;
  let b=host.querySelector('.rwa-command-button');
  if(!b){
    b=document.createElement('button');b.type='button';b.className='rwa-command-button';
    b.dataset.v5Action='search';
    b.innerHTML='<span>⌕</span><span class="label">Search / Command</span><kbd>⌘K</kbd>';
    host.insertBefore(b,host.querySelector('.signin,.institutional')||host.lastElementChild);
  }else{b.dataset.v5Action='search';b.removeAttribute('data-super-action');b.onclick=null}
  const inst=host.querySelector('.institutional');if(inst){inst.textContent='Institutional';inst.removeAttribute('onclick');inst.classList.remove('institutional');inst.classList.add('rwa-institutional-link');inst.dataset.v5Route='institutional'}
  const sign=host.querySelector('.signin');if(sign){sign.removeAttribute('onclick');sign.dataset.v5Action='wallet'}
  if(!host.querySelector('[data-v5-action="notifications"]')){const n=document.createElement('button');n.type='button';n.className='rwa-top-icon';n.dataset.v5Action='notifications';n.title='Notifications & alerts';n.setAttribute('aria-label','Notifications and alerts');n.textContent='◌';host.insertBefore(n,sign||inst||null)}
  if(!host.querySelector('[data-v5-action="profile"]')){const p=document.createElement('button');p.type='button';p.className='rwa-top-icon';p.dataset.v5Action='profile';p.title='Profile';p.setAttribute('aria-label','Profile');p.textContent='◎';host.insertBefore(p,sign||inst||null)}
}
function installWorkspace(){
  if($('rwaSuperWorkspace'))return;
  const w=document.createElement('section');w.id='rwaSuperWorkspace';w.className='rwa-super-workspace';w.hidden=true;
  w.innerHTML=`<header class="rwa-super-workspace-head"><div><small id="rwaSuperKicker">RWA SUPER APP</small><h1 id="rwaSuperTitle">Workspace</h1><p id="rwaSuperSub"></p></div><div class="rwa-super-head-actions"><button type="button" data-v5-action="search">⌕ Search</button><button type="button" data-v5-action="markets">Live Markets</button></div></header><div id="rwaSuperBody" class="rwa-super-body"></div>`;
  const marker=document.querySelector('.layout')||document.querySelector('.credibility-strip');
  marker?.parentNode?.insertBefore(w,marker);
}
function installQuickDock(){
  if($('rwaQuickDock'))return;
  const d=document.createElement('aside');d.id='rwaQuickDock';d.className='rwa-quick-dock';d.setAttribute('aria-label','Quick actions');
  d.innerHTML=`
    <button type="button" data-v5-action="buy"><b>BUY</b><span>Long</span></button>
    <button type="button" data-v5-action="sell"><b>SELL</b><span>Short</span></button>
    <button type="button" data-v5-action="watch"><b>☆</b><span>Watch</span></button>
    <button type="button" data-v5-action="alert"><b>◌</b><span>Alert</span></button>
    <button type="button" data-v5-action="compare"><b>⇄</b><span>Compare</span></button>
    <button type="button" data-v5-action="research"><b>R</b><span>Research</span></button>
    <button type="button" data-v5-action="share"><b>↗</b><span>Share</span></button>`;
  document.body.appendChild(d);
}
function installTicker(){
  if($('rwaGlobalTicker'))return;
  const t=document.createElement('footer');t.id='rwaGlobalTicker';t.className='rwa-global-ticker';
  t.innerHTML='<div class="rwa-ticker-brand"><i></i><b>RWA LIVE</b></div><div id="rwaTickerTape" class="rwa-ticker-tape"><span>Connecting live markets…</span></div><div class="rwa-ticker-status"><span id="rwaTickerStatus">NETWORK</span></div>';
  document.body.appendChild(t);
}

function commandLayer(){
  let layer=$('rwaSuperCommand');
  if(layer)return layer;
  layer=document.createElement('div');layer.id='rwaSuperCommand';layer.className='rwa-super-command';layer.hidden=true;
  layer.innerHTML=`<section class="rwa-super-command-card" role="dialog" aria-modal="true" aria-label="RWA universal search"><div class="rwa-super-command-head"><span>⌕</span><input id="rwaSuperCommandInput" autocomplete="off" placeholder="ONDO, BlackRock, Treasury, Research, Portfolio, Trade BTC…"><kbd>ESC</kbd></div><div class="rwa-super-command-meta"><span>Universal Search</span><span>Everything opens inside /rwa/</span></div><div id="rwaSuperCommandResults" class="rwa-super-command-results"></div></section>`;
  document.body.appendChild(layer);
  layer.addEventListener('click',e=>{if(e.target===layer)closeCommand()});
  const inp=$('rwaSuperCommandInput');inp?.addEventListener('input',renderCommand);
  inp?.addEventListener('keydown',e=>{if(e.key==='Escape')closeCommand();if(e.key==='Enter')$('rwaSuperCommandResults')?.querySelector('button')?.click()});
  return layer;
}
function openCommand(seed=''){
  const l=commandLayer();l.hidden=false;
  const i=$('rwaSuperCommandInput');i.value=seed;renderCommand();setTimeout(()=>i.focus(),20);
}
function closeCommand(){const l=$('rwaSuperCommand');if(l)l.hidden=true}
function commandRows(qraw){
  const q=String(qraw||'').trim().toUpperCase(),out=[];
  const staticRows=[
    ['Markets','Live prices, chart, depth and execution','MARKETS',()=>navigate('markets')],
    ['Intelligence','RWA index, breadth, heatmap and institutional-flow proxies','INTEL',()=>navigate('intelligence')],
    ['Assets','RWA marketplace, discovery and reviewer-backed evidence','ASSETS',()=>navigate('assets')],
    ['Research','Screener, comparison, signals and thesis workspace','RESEARCH',()=>navigate('research')],
    ['Portfolio','Wallet, positions, P&L, orders and history','PORTFOLIO',()=>navigate('portfolio')],
    ['Social','Trading feed, theses, leaderboard and copy network','SOCIAL',()=>navigate('social')],
    ['Institutional','Issuer onboarding, tokenization, liquidity and compliance','INSTITUTIONAL',()=>navigate('institutional')],
    ['Trade '+selectedBase(),'Protected execution inside the terminal','TRADE',()=>openTrade(selectedBase())]
  ];
  if(!q)return staticRows;
  for(const r of staticRows)if((r[0]+' '+r[1]+' '+r[2]).toUpperCase().includes(q))out.push(r);
  const p=pairs().filter(x=>`${x.base} ${x.symbol}`.includes(q)).slice(0,8);
  p.forEach(x=>out.push([`${x.base} / USDT`,`${x.rwa?'RWA-linked · ':''}${money(x.price)} · ${pct(x.change)}`,'MARKET',()=>{selectSymbol(x.base);navigate('markets')}]));
  if(/\b(BUY|SELL|TRADE)\b/.test(q)){
    const sym=(q.match(/\b[A-Z0-9]{2,12}\b/g)||[]).find(x=>!['BUY','SELL','TRADE'].includes(x))||selectedBase();
    out.unshift([`${q.includes('SELL')?'Sell':'Trade'} ${sym}`,'Open the protected order ticket without leaving this page','ACTION',()=>openTrade(sym,true,q.includes('SELL')?'SELL':q.includes('BUY')?'BUY':'')]);
  }
  const assetRows=discoveryRows().filter(a=>{const hay=[a.symbol,a.name,a.category,a.description,a.verified?.name,a.verified?.issuer,...(a.tags||[])].join(' ').toUpperCase();return q&&hay.includes(q)}).slice(0,6);
  assetRows.forEach(a=>out.push([`${a.symbol} · ${a.name||a.category||'RWA asset'}`,`${a.status||'DISCOVERY'} · ${a.category||'RWA'}`,'ASSET',()=>openAsset(a.symbol)]));
  if(/\b(BLACKROCK|TREASURY|GOLD|PROPERTY|CREDIT|BOND|YIELD|INCOME)\b/.test(q))out.push(['RWA Asset Discovery',`Search RWA discovery and verified-registry records related to ${q}`,'ASSETS',()=>{navigate('assets');setTimeout(()=>{const a=$('rwaAssetSearch');if(a){a.value=q.toLowerCase();renderAssets()}},100)}]);
  return out.slice(0,12);
}
function renderCommand(){
  const box=$('rwaSuperCommandResults');if(!box)return;
  const rows=commandRows($('rwaSuperCommandInput')?.value||'');
  box.innerHTML=rows.length?rows.map((r,i)=>`<button type="button" data-command-index="${i}"><div><b>${esc(r[0])}</b><small>${esc(r[1])}</small></div><span>${esc(r[2])}</span></button>`).join(''):'<div class="rwa-super-empty">No result. Try a market symbol, workspace name or command such as “Trade BTC”.</div>';
  qa('[data-command-index]',box).forEach((b,i)=>b.onclick=()=>{closeCommand();rows[i][3]()});
}

function showWorkspace(kind,opts={}){
  hideSuite();closeFundamentals();
  document.body.classList.toggle('rwa-super-asset-workspace',kind==='asset');
  document.body.classList.remove('rwa-super-market-open');
  document.body.classList.add('rwa-super-workspace-open');
  const w=$('rwaSuperWorkspace');if(w)w.hidden=false;
  state.workspace=kind;setActive(kind);
  const title=$('rwaSuperTitle'),sub=$('rwaSuperSub'),kick=$('rwaSuperKicker'),label=$('rwaWorkspaceLabel');
  if(label)label.textContent=kind[0].toUpperCase()+kind.slice(1);
  const meta={
    intelligence:['RWA INTELLIGENCE','Market intelligence','RWA index, breadth, sector heatmap, institutional-flow proxies and live movers.'],
    assets:['RWA ASSETS','RWA asset marketplace','Discover RWA-linked markets and discovery records; reviewer-backed assets are explicitly separated and never inferred.'],
    research:['RESEARCH DESK','Research workspace','Screen markets, compare assets, save theses and turn live signals into a repeatable research workflow.'],
    institutional:['INSTITUTIONAL','Institutional hub','Issuer onboarding, tokenization, liquidity, custody, compliance and API access in one workflow.'],
    asset:['ASSET TERMINAL','Asset detail','Price, fundamentals, tokenization, underlying asset, holders, markets, research, social, documents, risk and trade.']
  }[kind]||['RWA SUPER APP','Workspace',''];
  if(kick)kick.textContent=meta[0];if(title)title.textContent=meta[1];if(sub)sub.textContent=meta[2];
  if(kind==='intelligence'){renderIntelligence();loadAssets().then(renderIntelligence).catch(()=>{})}
  if(kind==='assets')loadAssets().then(renderAssets);
  if(kind==='research')renderResearch(opts);
  if(kind==='institutional')renderInstitutional();
  if(kind==='asset')loadAssets().then(()=>loadCatalog()).then(()=>renderAsset(opts.symbol||selectedBase()));
  window.scrollTo({top:0,behavior:'auto'});
}
function metric(label,value,sub='',cls=''){return`<article class="rwa-super-metric ${cls}"><small>${esc(label)}</small><strong>${esc(value)}</strong><span>${esc(sub)}</span></article>`}
function topPairs(mode='abs',limit=8){
  const p=pairs().filter(x=>Number.isFinite(Number(x.price))&&Number.isFinite(Number(x.change)));
  if(mode==='gainers')return[...p].sort((a,b)=>b.change-a.change).slice(0,limit);
  if(mode==='losers')return[...p].sort((a,b)=>a.change-b.change).slice(0,limit);
  return[...p].sort((a,b)=>Math.abs(b.change)-Math.abs(a.change)).slice(0,limit);
}
function sectorOf(base){
  const b=String(base||'').toUpperCase();
  if(['ONDO','MPL','CFG','CPOOL','TRU'].includes(b))return'Credit / Treasuries';
  if(['PAXG','XAUT','GOLD'].includes(b))return'Commodities';
  if(['OM','POLYX','PROPC','LAND'].includes(b))return'Real Estate / Infra';
  if(['MKR','SKY','AAVE'].includes(b))return'On-chain Finance';
  return'Liquid Markets';
}
function renderIntelligence(){
  const p=pairs(),up=p.filter(x=>(x.change||0)>0).length,down=p.filter(x=>(x.change||0)<0).length,rwa=p.filter(x=>x.rwa);
  const breadth=p.length?up/p.length*100:null;
  const movers=topPairs('abs',10),gainers=topPairs('gainers',5),losers=topPairs('losers',5);
  const sectors=new Map();
  (rwa.length?rwa:p.slice(0,40)).forEach(x=>{const s=sectorOf(x.base),a=sectors.get(s)||[];a.push(x);sectors.set(s,a)});
  const sectorCards=[...sectors].map(([name,rows])=>{
    const ch=rows.reduce((s,x)=>s+Number(x.change||0),0)/Math.max(1,rows.length);
    return`<button type="button" class="rwa-heat ${ch>=0?'up':'down'}" data-v5-action="research"><small>${esc(name)}</small><b>${pct(ch)}</b><span>${rows.length} markets</span></button>`;
  }).join('');
  const list=rows=>rows.map(x=>`<button type="button" class="rwa-super-row" data-open-market="${esc(x.base)}"><div><b>${esc(x.base)} / USDT</b><small>${x.rwa?'RWA-linked · ':''}Vol ${compact(x.vol)}</small></div><strong>${money(x.price)}</strong><span class="${x.change>=0?'up':'down'}">${pct(x.change)}</span></button>`).join('');
  const snap=currentSnapshot(),absMove=Math.abs(Number(snap.change||0)),flow=snap.buy,moveTone=Number(snap.change||0)>=0?'positive':'negative';
  const why=[`${snap.base||selectedBase()} has ${moveTone} 24h momentum of ${absMove.toFixed(2)}%.`,snap.vol!=null?`Quoted volume is ${compact(snap.vol)}.`:'Volume is still loading.',flow!=null?`Buy-pressure proxy is ${flow.toFixed(0)}%.`:'Order-flow proxy is still loading.',absMove>=8?'Move magnitude is extreme relative to the live screen.':absMove>=4?'Move magnitude is elevated relative to the live screen.':'Move magnitude is inside the normal watch range.'].join(' ');
  const registryCount=state.assets.length,yieldRows=state.assets.filter(a=>Number.isFinite(Number(a?.fundamentals?.income?.current_yield??a?.yield))),yieldAvg=yieldRows.length?yieldRows.reduce((z,a)=>z+Number(a?.fundamentals?.income?.current_yield??a?.yield),0)/yieldRows.length:null;
  const body=$('rwaSuperBody');if(!body)return;
  body.innerHTML=`
    <div class="rwa-super-metrics">
      ${metric('RWA INDEX',breadth==null?'—':Math.round(breadth),'Breadth score / 100',breadth>=50?'up':'down')}
      ${metric('GAINERS',String(up),'Positive 24h markets','up')}
      ${metric('LOSERS',String(down),'Negative 24h markets','down')}
      ${metric('RWA PAIRS',String(rwa.length),'Tracked RWA-linked markets')}
      ${metric('FLOW PROXY',$('buyPct')?.textContent||'—','Selected-market buy pressure')}
      ${metric('NETWORK',$('liveText')?.textContent||'LIVE','Public market feeds')}
    </div>
    <div class="rwa-super-grid two">
      <section class="rwa-super-card span-2"><div class="rwa-super-card-head"><div><small>SECTOR HEATMAP</small><h2>RWA market map</h2></div><span>Live 24h mean</span></div><div class="rwa-heatmap">${sectorCards||'<div class="rwa-super-empty">Waiting for RWA market classification…</div>'}</div></section>
      <section class="rwa-super-card"><div class="rwa-super-card-head"><div><small>MOMENTUM</small><h2>Top gainers</h2></div><span>24h</span></div><div class="rwa-super-list">${list(gainers)}</div></section>
      <section class="rwa-super-card"><div class="rwa-super-card-head"><div><small>RISK</small><h2>Top losers</h2></div><span>24h</span></div><div class="rwa-super-list">${list(losers)}</div></section>
      <section class="rwa-super-card"><div class="rwa-super-card-head"><div><small>WHY IS THIS MOVING?</small><h2>${esc(snap.base||selectedBase())} live drivers</h2></div><span>Rule-based</span></div><p class="rwa-report">${esc(why)}</p><p class="rwa-super-note">This explanation uses public price/volume/order-flow metrics. It does not invent news, issuer events or identities.</p></section>
      <section class="rwa-super-card"><div class="rwa-super-card-head"><div><small>REGISTRY + YIELD</small><h2>Issuance intelligence</h2></div><span>Evidence-aware</span></div><div class="rwa-super-metrics compact">${metric('VERIFIED',String(registryCount),'Reviewer-backed records')}${metric('YIELD RECORDS',String(yieldRows.length),'Published by registry')}${metric('AVG YIELD',yieldAvg==null?'—':pct(yieldAvg),'Only published records')}</div><button type="button" data-v5-route="assets">Open asset marketplace</button></section>
      <section class="rwa-super-card span-2"><div class="rwa-super-card-head"><div><small>INSTITUTIONAL FLOW PROXY</small><h2>Activity radar</h2></div><button type="button" data-v5-action="advanced-intel">Advanced intelligence</button></div>
        <div class="rwa-radar">${movers.map(x=>`<button type="button" data-open-asset="${esc(x.base)}"><span>${esc(x.base)}</span><i style="--rwa-power:${Math.min(100,Math.max(8,Math.abs(Number(x.change||0))*8))}%"></i><b class="${x.change>=0?'up':'down'}">${pct(x.change)}</b></button>`).join('')}</div>
        <p class="rwa-super-note">Flow, whale and smart-money labels are transparent market-activity proxies, not identity claims or guaranteed predictions.</p>
      </section>
    </div>`;
  bindWorkspaceRows();
}
async function loadAssets(){
  if(state.assetsLoaded)return state.assets;
  try{
    const r=await fetch(`rwa-assets.json?t=${Date.now()}`,{cache:'no-store'}),j=await r.json();
    state.assets=Array.isArray(j.verified)?j.verified:[];
  }catch{state.assets=[]}
  state.assetsLoaded=true;return state.assets;
}
async function loadCatalog(){
  if(state.catalogLoaded)return state.catalog;
  try{const r=await fetch(`rwa-discovery-catalog.json?t=${Date.now()}`,{cache:'no-store'}),j=await r.json();state.catalog=Array.isArray(j.items)?j.items:[]}catch{state.catalog=[]}
  state.catalogLoaded=true;return state.catalog;
}
function catalogFor(sym){sym=String(sym||'').toUpperCase();return state.catalog.find(x=>String(x.symbol||'').toUpperCase()===sym)||null}
function verifiedFor(sym){sym=String(sym||'').toUpperCase();return state.assets.find(a=>assetSymbol(a)===sym)||null}
function discoveryRows(){
  const live=pairs(),map=new Map();
  live.filter(x=>x.rwa).forEach(x=>map.set(String(x.base).toUpperCase(),{symbol:String(x.base).toUpperCase(),category:sectorOf(x.base),status:'MARKET DATA',tags:['live','rwa-linked'],live:x}));
  state.catalog.forEach(c=>{const sym=String(c.symbol||'').toUpperCase();if(!sym)return;const old=map.get(sym)||{};const liveRow=live.find(x=>String(x.base).toUpperCase()===sym);map.set(sym,{...c,...old,symbol:sym,live:liveRow||old.live||null,status:verifiedFor(sym)?'VERIFIED REGISTRY':(c.status||old.status||'DISCOVERY')})});
  state.assets.forEach(a=>{const sym=assetSymbol(a);if(sym){const old=map.get(sym)||{};map.set(sym,{...old,symbol:sym,status:'VERIFIED REGISTRY',verified:a,live:live.find(x=>String(x.base).toUpperCase()===sym)||old.live||null})}});
  return [...map.values()];
}
function assetSymbol(a){return String(a?.fundamentals?.token?.symbol||a?.token_symbol||a?.symbol||a?.ticker||'').toUpperCase()}
function renderAssets(){
  const body=$('rwaSuperBody');if(!body)return;
  const prev=$('rwaAssetSearch')?.value||'';
  const q=String(prev).toLowerCase().trim(),rows=discoveryRows().filter(a=>!q||JSON.stringify(a).toLowerCase().includes(q));
  const verifiedCount=state.assets.length,liveCount=rows.filter(x=>x.live).length;
  body.innerHTML=`
    <section class="rwa-super-card rwa-asset-toolbar-card"><div class="rwa-asset-toolbar">
      <div><small>VERIFIED REGISTRY</small><b>${verifiedCount}</b></div>
      <div><small>DISCOVERY / LIVE</small><b>${liveCount}</b></div>
      <label><span>⌕</span><input id="rwaAssetSearch" autocomplete="off" value="${esc(prev)}" placeholder="Search Treasury, Gold, ONDO, issuer, category…"></label>
      <button type="button" data-v5-action="institutional">+ Tokenize an asset</button>
    </div><p class="rwa-super-note"><b>Status policy:</b> VERIFIED is shown only for reviewer-backed records from rwa-assets.json. Market discovery cards are explicitly labelled DISCOVERY or MARKET DATA and are not legal/ownership verification.</p></section>
    <div class="rwa-assets-grid">${rows.length?rows.map(a=>{const x=a.live,sym=a.symbol||'RWA',v=a.verified,cat=a.category||sectorOf(sym),status=a.status||'DISCOVERY';return`<article class="rwa-asset-card"><div class="rwa-asset-card-top"><div class="rwa-asset-token">${esc(sym.slice(0,4))}</div><span class="${status==='VERIFIED REGISTRY'?'verified':'discovery'}">${status==='VERIFIED REGISTRY'?'✓ VERIFIED':esc(status)}</span></div><small>${esc(cat||'RWA DISCOVERY')}</small><h2>${esc(v?.name||a.name||sym)}</h2><p>${esc(v?.issuer||a.description||'Live RWA-linked market / discovery metadata')}</p><div class="rwa-asset-stats"><div><small>PRICE</small><b>${money(x?.price)}</b></div><div><small>24H</small><b class="${Number(x?.change||0)>=0?'up':'down'}">${pct(x?.change)}</b></div><div><small>VOLUME</small><b>${compact(x?.vol)}</b></div></div><div class="rwa-asset-actions"><button type="button" data-open-asset="${esc(sym)}">Open asset</button><button type="button" data-v5-action="research" data-research-symbol="${esc(sym)}">Research</button></div></article>`}).join(''):'<div class="rwa-super-empty wide">No asset matches this search. Discovery data will appear when live RWA-linked markets or registry records are available.</div>'}</div>`;
  const input=$('rwaAssetSearch');input?.addEventListener('input',()=>{const v=input.value;renderAssets();const x=$('rwaAssetSearch');if(x){x.value=v;x.focus();x.setSelectionRange(v.length,v.length)}});
  bindWorkspaceRows();
}
function assetTabs(){return['overview','fundamentals','tokenization','underlying','holders','markets','research','social','documents','risk','trade']}
function renderAsset(symbol=selectedBase()){
  const body=$('rwaSuperBody');if(!body)return;const sym=String(symbol||selectedBase()).toUpperCase(),live=pairs().find(x=>String(x.base).toUpperCase()===sym)||null,v=verifiedFor(sym),d=catalogFor(sym)||{},status=v?'VERIFIED REGISTRY':(d.status||'MARKET DATA');
  const tab=state.assetTab||'overview',snap={price:live?.price,change:live?.change,vol:live?.vol,high:live?.high,low:live?.low};
  const verifiedBanner=v?`<div class="rwa-super-banner ok"><b>✓ Reviewer-backed registry record</b><span>Verified status comes only from the signed RWA registry/evidence pipeline.</span></div>`:`<div class="rwa-super-banner warn"><b>${esc(status)}</b><span>This is market/discovery context, not a legal ownership, income-right or issuer verification claim.</span></div>`;
  const tabs=assetTabs().map(t=>`<button type="button" data-asset-tab="${t}" class="${tab===t?'active':''}">${t[0].toUpperCase()+t.slice(1)}</button>`).join('');
  let panel='';
  if(tab==='overview')panel=`<div class="rwa-super-metrics">${metric('PRICE',money(snap.price),'Live public feed')}${metric('24H',pct(snap.change),'Market change',Number(snap.change||0)>=0?'up':'down')}${metric('VOLUME',compact(snap.vol),'24h quoted volume')}${metric('HIGH',money(snap.high),'24h')}${metric('LOW',money(snap.low),'24h')}${metric('STATUS',status,'Evidence policy')}</div><div class="rwa-super-grid two"><section class="rwa-super-card"><div class="rwa-super-card-head"><div><small>DISCOVERY</small><h2>${esc(d.name||v?.name||sym)}</h2></div><span>${esc(d.category||sectorOf(sym))}</span></div><p class="rwa-prose">${esc(d.description||'Selected market context with explicit separation between live market data and reviewer-backed RWA claims.')}</p><div class="rwa-tag-row">${(d.tags||[]).map(x=>`<span>${esc(x)}</span>`).join('')}</div></section><section class="rwa-super-card"><div class="rwa-super-card-head"><div><small>QUICK ACTIONS</small><h2>Analyze or act</h2></div></div><div class="rwa-asset-action-grid"><button data-v5-action="buy" data-coin="${esc(sym)}">Buy / Long</button><button data-v5-action="sell" data-coin="${esc(sym)}">Sell / Short</button><button data-v5-action="research" data-research-symbol="${esc(sym)}">Research</button><button data-v5-action="watch">Watch</button><button data-v5-action="alert">Alert</button><button data-v5-route="social">Social</button></div></section></div>`;
  else if(tab==='fundamentals')panel=`<section class="rwa-super-card"><div class="rwa-super-card-head"><div><small>FUNDAMENTALS</small><h2>Income, NAV, financials and valuation</h2></div><span>${v?'Registry-backed':'Market only'}</span></div><p class="rwa-prose">${v?'Open the detailed evidence-aware fundamentals panel. Claims remain tied to registry evidence and reviewer status.':'No reviewer-backed RWA fundamentals record is published for this symbol. Market data remains available without inventing NAV, yield or ownership claims.'}</p><button type="button" data-v5-action="legacy-fundamentals" data-coin="${esc(sym)}">${v?'Open verified fundamentals':'Open market fundamentals'}</button></section>`;
  else if(tab==='tokenization')panel=`<div class="rwa-super-grid two"><section class="rwa-super-card"><small>TOKENIZATION</small><h2>Token structure</h2>${v?`<p class="rwa-prose">Token symbol: ${esc(assetSymbol(v)||sym)}. Supply, rights and transfer structure are shown only when present in registry fundamentals.</p>`:`<p class="rwa-prose">No verified tokenization structure is published in the reviewer-backed registry for ${esc(sym)}.</p>`}</section><section class="rwa-super-card"><small>POLICY</small><h2>What “verified” means</h2><p class="rwa-prose">Market listing alone never proves ownership of a real-world asset. Verification requires issuer/evidence/reviewer pipeline status.</p></section></div>`;
  else if(tab==='underlying')panel=`<section class="rwa-super-card"><small>UNDERLYING ASSET</small><h2>${esc(v?.type||d.category||'RWA discovery')}</h2><p class="rwa-prose">${esc(v?.location||d.description||'Underlying details are not asserted unless a reviewer-backed registry record supplies them.')}</p></section>`;
  else if(tab==='holders')panel=`<section class="rwa-super-card"><small>HOLDERS</small><h2>Ownership distribution</h2><p class="rwa-prose">${v?.fundamentals?.token?.holders!=null?`${esc(v.fundamentals.token.holders)} holders reported by the registry record.`:'Holder counts/distribution are unavailable unless published by the verified registry or a supported public source.'}</p></section>`;
  else if(tab==='markets')panel=`<div class="rwa-super-grid two"><section class="rwa-super-card"><small>MARKET</small><h2>${esc(sym)} / USDT</h2><div class="rwa-super-metrics compact">${metric('PRICE',money(snap.price),'')}${metric('24H',pct(snap.change),'',Number(snap.change||0)>=0?'up':'down')}${metric('VOLUME',compact(snap.vol),'')}</div><button data-v5-action="markets">Open live terminal</button></section><section class="rwa-super-card"><small>LIQUIDITY</small><h2>Execution context</h2><p class="rwa-prose">Order book, spread and live execution metrics remain in the Markets workspace. Trade is risk-gated by the existing execution engine.</p><button data-v5-action="trade" data-coin="${esc(sym)}">Trade ${esc(sym)}</button></section></div>`;
  else if(tab==='research')panel=`<section class="rwa-super-card"><small>RESEARCH</small><h2>Research ${esc(sym)}</h2><p class="rwa-prose">Open screener, compare, signals, report and saved-thesis tools with ${esc(sym)} preselected.</p><button data-v5-action="research" data-research-symbol="${esc(sym)}">Open Research Desk</button></section>`;
  else if(tab==='social')panel=`<section class="rwa-super-card"><small>SOCIAL</small><h2>Market conversation</h2><p class="rwa-prose">Open signed trader feed, verified-wallet leaderboard, follow and copy-network context without leaving the app.</p><button data-v5-route="social">Open Social</button></section>`;
  else if(tab==='documents')panel=`<section class="rwa-super-card"><small>DOCUMENTS</small><h2>Evidence & disclosures</h2>${v?`<p class="rwa-prose">Use the detailed fundamentals/evidence panel for ownership, appraisal, legal/KYB, disclosures and audit items. External documents open in the in-app preview layer.</p><button data-v5-action="legacy-fundamentals" data-coin="${esc(sym)}">Open evidence panel</button>`:`<p class="rwa-prose">No verified evidence pack is published for this market/discovery record.</p>`}</section>`;
  else if(tab==='risk')panel=`<div class="rwa-super-grid two"><section class="rwa-super-card"><small>MARKET RISK</small><h2>Live risk context</h2><div class="rwa-super-metrics compact">${metric('24H',pct(snap.change),'Volatility proxy')}${metric('VOLUME',compact(snap.vol),'Liquidity proxy')}${metric('STATUS',status,'Verification status')}</div></section><section class="rwa-super-card"><small>DISCLOSURE</small><h2>Risk separation</h2><p class="rwa-prose">Market price, liquidity, legal ownership, income rights, NAV and issuer verification are separate facts. Missing evidence is shown as missing rather than inferred.</p></section></div>`;
  else if(tab==='trade')panel=`<section class="rwa-super-card"><small>TRADE</small><h2>Protected execution for ${esc(sym)}</h2><p class="rwa-prose">Orders stay inside /rwa/ and continue through wallet approval, Risk Engine checks, preview and the configured venue gate.</p><div class="rwa-inst-actions"><button data-v5-action="buy" data-coin="${esc(sym)}">Buy / Long</button><button data-v5-action="sell" data-coin="${esc(sym)}">Sell / Short</button></div></section>`;
  body.innerHTML=`${verifiedBanner}<section class="rwa-asset-hero"><div><small>${esc(status)}</small><h2>${esc(sym)} <span>/ USDT</span></h2><strong>${money(snap.price)}</strong><b class="${Number(snap.change||0)>=0?'up':'down'}">${pct(snap.change)}</b></div><button data-v5-action="markets">Live chart</button></section><nav class="rwa-asset-detail-tabs">${tabs}</nav><div class="rwa-asset-panel">${panel}</div>`;
  qa('[data-asset-tab]',body).forEach(b=>b.onclick=()=>{state.assetTab=b.dataset.assetTab;renderAsset(sym)});bindWorkspaceRows();
}
function loadResearchNotes(){
  try{const v=JSON.parse(localStorage.getItem('rwa_super_research_notes_v1')||'[]');state.researchNotes=Array.isArray(v)?v:[]}catch{state.researchNotes=[]}
}
function saveResearchNotes(){try{localStorage.setItem('rwa_super_research_notes_v1',JSON.stringify(state.researchNotes.slice(0,40)))}catch{}}
function renderResearch(opts={}){
  loadResearchNotes();
  const snap=currentSnapshot(),tool=String(opts.tool||'').toLowerCase(),sym=String(opts.symbol||snap.base||selectedBase()).toUpperCase();
  if(sym&&!state.compare.includes(sym))state.compare=[sym,...state.compare.filter(x=>x!==sym)].slice(0,4);
  if(['screener','compare','signals','report','saved','backtest','renko'].includes(tool))state.researchTab=tool;
  const tab=state.researchTab||'screener',list=topPairs('abs',20),compareRows=state.compare.map(s=>pairs().find(x=>String(x.base).toUpperCase()===s)).filter(Boolean);
  const tabs=['screener','compare','signals','report','saved','backtest','renko'].map(t=>`<button data-research-tab="${t}" class="${tab===t?'active':''}">${t[0].toUpperCase()+t.slice(1)}</button>`).join('');
  const signalRows=topPairs('abs',10).map(x=>{const mag=Math.abs(Number(x.change||0)),kind=mag>=8?'EXTREME':mag>=4?'HIGH':'WATCH';return`<button class="rwa-super-row" data-open-market="${esc(x.base)}"><div><b>${esc(x.base)} ${kind}</b><small>${x.change>=0?'Positive':'Negative'} momentum · Vol ${compact(x.vol)}</small></div><strong>${money(x.price)}</strong><span class="${x.change>=0?'up':'down'}">${pct(x.change)}</span></button>`}).join('');
  const report=`${snap.base} is ${Number(snap.change||0)>=0?'up':'down'} ${Math.abs(Number(snap.change||0)).toFixed(2)}% over 24h with quoted volume ${compact(snap.vol)}. ${snap.buy!=null?`Selected-market buy-pressure proxy is ${snap.buy.toFixed(0)}%. `:''}This is a rule-based market brief from public feed metrics, not investment advice or a news claim.`;
  let panel='';
  if(tab==='screener')panel=`<section class="rwa-super-card span-2"><div class="rwa-super-card-head"><div><small>SCREENER</small><h2>Live opportunity set</h2></div><span>Magnitude ranked</span></div><div class="rwa-super-list">${list.map(x=>`<button type="button" class="rwa-super-row" data-research-add="${esc(x.base)}"><div><b>${esc(x.base)} / USDT</b><small>${x.rwa?'RWA-linked · ':''}Vol ${compact(x.vol)}</small></div><strong>${money(x.price)}</strong><span class="${x.change>=0?'up':'down'}">${pct(x.change)}</span></button>`).join('')}</div></section>`;
  if(tab==='compare')panel=`<section class="rwa-super-card span-2"><div class="rwa-super-card-head"><div><small>COMPARE</small><h2>Asset / market comparison</h2></div><button data-v5-action="clear-compare">Clear</button></div><div class="rwa-compare wide">${compareRows.length?compareRows.map(x=>`<div><b>${esc(x.base)}</b><span>${money(x.price)}</span><strong class="${x.change>=0?'up':'down'}">${pct(x.change)}</strong><small>Vol ${compact(x.vol)}</small><button data-open-asset="${esc(x.base)}">Asset detail</button></div>`).join(''):'<div class="rwa-super-empty">Select markets from the Screener.</div>'}</div></section>`;
  if(tab==='signals')panel=`<section class="rwa-super-card span-2"><div class="rwa-super-card-head"><div><small>SIGNALS</small><h2>Transparent market signals</h2></div><span>Rule-based</span></div><p class="rwa-super-note">Signals are deterministic momentum/volume proxies from live public market data; they are not predictions.</p><div class="rwa-super-list">${signalRows}</div></section>`;
  if(tab==='report')panel=`<section class="rwa-super-card span-2"><div class="rwa-super-card-head"><div><small>REPORT</small><h2>${esc(snap.base)} market brief</h2></div><span>Generated from live metrics</span></div><p class="rwa-report">${esc(report)}</p><div class="rwa-super-metrics">${metric('PRICE',money(snap.price),'')}${metric('24H',pct(snap.change),'',Number(snap.change||0)>=0?'up':'down')}${metric('VOLUME',compact(snap.vol),'')}${metric('BUY PRESSURE',snap.buy==null?'—':snap.buy.toFixed(0)+'%','Proxy')}${metric('SPREAD',snap.bid!=null&&snap.ask!=null?money(snap.ask-snap.bid):'—','')}${metric('DATA',$('liveText')?.textContent||'LIVE','Network')}</div></section>`;
  if(tab==='saved')panel=`<div class="rwa-super-grid two"><section class="rwa-super-card"><small>NEW THESIS</small><h2>Research notebook</h2><textarea id="rwaResearchText" maxlength="1200" placeholder="Catalyst, invalidation, level, risk, evidence…"></textarea><div class="rwa-thesis-actions"><select id="rwaResearchBias"><option>NEUTRAL</option><option>LONG</option><option>SHORT</option><option>WATCH</option></select><button data-v5-action="save-thesis">Save thesis</button></div></section><section class="rwa-super-card"><small>SAVED</small><h2>Recent theses</h2><div class="rwa-notes">${state.researchNotes.length?state.researchNotes.slice(0,20).map(n=>`<article><header><b>${esc(n.symbol)}</b><span>${esc(n.bias)}</span></header><p>${esc(n.text)}</p><small>${new Date(n.ts).toLocaleString()}</small></article>`).join(''):'<div class="rwa-super-empty">No saved research yet.</div>'}</div></section></div>`;
  if(tab==='backtest'||tab==='renko'){const toolUrl=`${tab}/?embed=1&symbol=${encodeURIComponent(sym)}&v=${tab==='renko'?'142':'1'}`;panel=`<section class="rwa-super-card span-2 rwa-tool-lab-card"><div class="rwa-super-card-head"><div><small>${tab.toUpperCase()} RESEARCH</small><h2>${tab==='backtest'?'Historical strategy laboratory':'Renko structure laboratory'}</h2></div><span>Embedded · no top-level navigation</span></div><div class="rwa-tool-lab"><div><p class="rwa-prose">The complete repository research engine is embedded inside the canonical /rwa/ shell. Browser pathname remains /rwa/ while the tool keeps its historical controls and evidence.</p><div class="rwa-super-metrics compact">${metric('SYMBOL',sym,'')}${metric('24H',pct(snap.change),'Live context',Number(snap.change||0)>=0?'up':'down')}${metric('VOLUME',compact(snap.vol),'')}</div><button data-open-market="${esc(sym)}">Open live chart</button></div><iframe class="rwa-research-legacy-frame" title="${tab} research" loading="lazy" src="${toolUrl}"></iframe></div></section>`}
  const body=$('rwaSuperBody');if(!body)return;
  body.innerHTML=`<nav class="rwa-research-tabs">${tabs}</nav><div class="rwa-research-panel">${panel}</div>`;
  qa('[data-research-tab]',body).forEach(b=>b.onclick=()=>{state.researchTab=b.dataset.researchTab;renderResearch({symbol:sym})});bindWorkspaceRows();
}
function renderInstitutional(){
  const body=$('rwaSuperBody');if(!body)return;
  const steps=[
    ['01','Issuer / SPV','KYB, legal entity, control and authorized signers'],
    ['02','Asset evidence','Title, ownership, appraisal, legal rights and disclosures'],
    ['03','Tokenization','Supply, rights, distributions, transfer rules and registry mapping'],
    ['04','Compliance','Eligibility, jurisdiction, review, risk disclosures and audit trail'],
    ['05','Liquidity','Primary issuance, secondary market, market making and execution policy'],
    ['06','Operations','Custody, servicing, distributions, reporting, API and monitoring']
  ];
  body.innerHTML=`
    <section class="rwa-institutional-hero"><div><small>RWA INSTITUTIONAL</small><h2>From physical asset to a verifiable market.</h2><p>One operating surface for issuer onboarding, tokenization, evidence, liquidity, custody, compliance, APIs and ongoing market operations.</p><div class="rwa-inst-actions"><button type="button" data-v5-action="issuer">Start issuer workspace</button><button type="button" data-v5-action="assets">View RWA assets</button></div></div><div class="rwa-inst-orbit"><span>ASSET</span><span>LEGAL</span><span>TOKEN</span><span>MARKET</span><b>RWA</b></div></section>
    <div class="rwa-super-grid two">
      <section class="rwa-super-card span-2"><div class="rwa-super-card-head"><div><small>PIPELINE</small><h2>Institutional lifecycle</h2></div><span>Single-page workflow</span></div><div class="rwa-inst-steps">${steps.map(s=>`<article><b>${s[0]}</b><div><h3>${s[1]}</h3><p>${s[2]}</p></div></article>`).join('')}</div></section>
      <section class="rwa-super-card"><div class="rwa-super-card-head"><div><small>ISSUANCE</small><h2>Tokenization desk</h2></div><span>Controlled</span></div><ul class="rwa-check-list"><li>Issuer + SPV onboarding</li><li>Asset/legal evidence pack</li><li>NAV and appraisal evidence</li><li>Income-right configuration</li><li>Reviewer-backed verification</li></ul><button type="button" data-v5-action="issuer">Open issuer & RWA registry</button></section>
      <section class="rwa-super-card"><div class="rwa-super-card-head"><div><small>MARKET INFRASTRUCTURE</small><h2>Liquidity & execution</h2></div><span>Non-custodial</span></div><ul class="rwa-check-list"><li>Market discovery</li><li>Risk-gated execution</li><li>Portfolio and P&L</li><li>Market monitoring</li><li>API-ready workflows</li></ul><button type="button" data-v5-action="trade">Open execution workspace</button></section>
      <section class="rwa-super-card span-2"><div class="rwa-super-card-head"><div><small>API + OPERATIONS</small><h2>Institutional operating layer</h2></div><span>Inside RWA Super App</span></div><div class="rwa-inst-capabilities"><span>Issuer onboarding</span><span>Tokenization</span><span>KYB / evidence</span><span>Custody model</span><span>Liquidity</span><span>Compliance</span><span>Execution API</span><span>Portfolio</span><span>Audit trail</span><span>Monitoring</span></div></section>
    </div>`;
  bindWorkspaceRows();
}
function bindWorkspaceRows(){
  qa('[data-open-market]').forEach(b=>b.onclick=()=>{selectSymbol(b.dataset.openMarket);navigate('markets')});
  qa('[data-open-asset]').forEach(b=>b.onclick=()=>openAsset(b.dataset.openAsset));
  qa('[data-research-add]').forEach(b=>b.onclick=()=>{const s=b.dataset.researchAdd;if(!state.compare.includes(s))state.compare=[s,...state.compare].slice(0,4);renderResearch()});
  qa('[data-research-symbol]').forEach(b=>b.onclick=()=>navigate(`research/compare/${b.dataset.researchSymbol}`));
}

function ensurePreview(){
  let p=$('rwaInAppPreview');if(p)return p;
  p=document.createElement('div');p.id='rwaInAppPreview';p.className='rwa-inapp-preview';p.hidden=true;p.innerHTML=`<section><header><div><small>IN-APP SOURCE PREVIEW</small><h2 id="rwaPreviewTitle">Source</h2><p id="rwaPreviewUrl"></p></div><button type="button" data-preview-close>×</button></header><div class="rwa-preview-notice">The app never navigates away from /rwa/. Some providers block iframe embedding; when that happens the source URL remains available for copy/verification.</div><iframe id="rwaPreviewFrame" sandbox="allow-scripts allow-same-origin allow-forms" referrerpolicy="no-referrer"></iframe><footer><button type="button" data-preview-copy>Copy source URL</button><span id="rwaPreviewStatus">Loading inside RWA…</span></footer></section>`;document.body.appendChild(p);
  p.addEventListener('click',async e=>{if(e.target===p||e.target.closest('[data-preview-close]')){p.hidden=true;$('rwaPreviewFrame')?.removeAttribute('src');return}if(e.target.closest('[data-preview-copy]')){try{await navigator.clipboard.writeText(p.dataset.url||'');toastSafe('Source URL copied')}catch{toastSafe('Copy unavailable')}}});return p;
}
function previewUrl(url,title='Source'){
  let u;try{u=new URL(String(url||''),location.href)}catch{return}
  if(!/^https?:$/.test(u.protocol))return;const p=ensurePreview();p.hidden=false;p.dataset.url=u.href;$('rwaPreviewTitle').textContent=title;$('rwaPreviewUrl').textContent=u.href;$('rwaPreviewStatus').textContent='Embedding when permitted by source policy';const f=$('rwaPreviewFrame');f.src=u.href;
  clearTimeout(state.previewTimer);state.previewTimer=setTimeout(()=>{if(!p.hidden)$('rwaPreviewStatus').textContent='If the preview is blank, the source blocks embedding. The verified URL remains available to copy.'},3500);
}
function loadScriptOnce(src,key=src){if(state.lazy.has(key))return state.lazy.get(key);const pr=new Promise((resolve,reject)=>{const old=[...document.scripts].find(x=>(x.getAttribute('src')||'').split('?')[0]===src.split('?')[0]);if(old)return resolve(old);const s=document.createElement('script');s.src=src;s.async=false;s.onload=()=>resolve(s);s.onerror=()=>reject(Error('Could not load '+src));document.body.appendChild(s)});state.lazy.set(key,pr);return pr}
function loadStyleOnce(href,key=href){const k='css:'+key;if(state.lazy.has(k))return state.lazy.get(k);const pr=new Promise((resolve,reject)=>{const base=href.split('?')[0],old=[...document.styleSheets].map(x=>x.href||'').find(x=>x&&new URL(x,location.href).pathname.endsWith(base));if(old)return resolve(old);const l=document.createElement('link');l.rel='stylesheet';l.href=href;l.onload=()=>resolve(l);l.onerror=()=>reject(Error('Could not load '+href));document.head.appendChild(l)});state.lazy.set(k,pr);return pr}
async function ensureTrade(){if(window.RWAExchangeCore&&$('rwaExchange'))return window.RWAExchangeCore;for(const [src,key] of [['walletconnect.js?v=4','walletconnect'],['wallet-core.js?v=3','wallet-core'],['execution-api.js?v=2','execution-api'],['execution-ops-bridge.js?v=3','execution-bridge'],['exchange-core.js?v=1','exchange-core'],['exchange-ui.js?v=1','exchange-ui'],['testnet-e2e.js?v=1','testnet-e2e'],['execution-ui.js?v=3','execution-ui'],['suite-execution-patch.js?v=6','suite-execution']])await loadScriptOnce(src,key);for(let i=0;i<80;i++){if(window.RWAExchangeCore&&$('rwaExchange'))return window.RWAExchangeCore;await new Promise(r=>setTimeout(r,30))}throw Error('Execution workspace did not become ready')}
async function ensureQuickActions(){if(window.RWAQuickActions)return window.RWAQuickActions;await loadScriptOnce('quick-actions.js?v=1','quick-actions');return window.RWAQuickActions}
async function ensureFundamentals(){if(window.RWAFundamentals)return window.RWAFundamentals;await loadStyleOnce('rwa-fundamentals.css?v=1','fundamentals-style');await loadScriptOnce('rwa-fundamentals.js?v=1','fundamentals');return window.RWAFundamentals}
async function ensureSocialLegacy(){if(window.__RWA_SOCIAL_PRO_LOADED)return window.RWASocialTradingPro;try{await loadScriptOnce('social-notification-defaults.js?v=1','social-defaults');await loadScriptOnce('social-trading-pro.js?v=1','social-pro');window.__RWA_SOCIAL_PRO_LOADED=true;return window.RWASocialTradingPro}catch(e){console.warn('Social enhancement lazy-load failed',e);return null}}
async function ensureGlobalAssetTerminal(){if(window.RWAGlobalAssetTerminal)return window.RWAGlobalAssetTerminal;try{await loadStyleOnce('global-asset-terminal.css?v=1','global-assets-style');await loadScriptOnce('global-fundamental-shard-bridge.js?v=1','global-fund-bridge');await loadScriptOnce('global-asset-terminal.js?v=1','global-assets');return window.RWAGlobalAssetTerminal}catch(e){console.warn('Global asset terminal lazy-load failed',e);return null}}
function installHealth(){
  if($('rwaHealth'))return;const h=document.createElement('div');h.id='rwaHealth';h.className='rwa-health';h.innerHTML='<span id="rwaHealthDot"></span><b id="rwaHealthText">Connecting live data…</b><small id="rwaHealthAge"></small><button type="button" data-health-retry>Retry</button>';document.body.appendChild(h);h.querySelector('[data-health-retry]').onclick=()=>{state.lastDataAt=Date.now();try{window.location.hash=window.location.hash||'#markets';window.dispatchEvent(new Event('online'))}catch{};toastSafe('Retry requested')};
  addEventListener('online',()=>{state.health.online=true;renderHealth()});addEventListener('offline',()=>{state.health.online=false;renderHealth()});
  const ids=['statPrice','pairCount','lastTick'];ids.forEach(id=>{const e=$(id);if(e)new MutationObserver(()=>{state.lastDataAt=Date.now();state.health.market='live';renderHealth()}).observe(e,{childList:true,subtree:true,characterData:true})});renderHealth();
}
function renderHealth(){const h=$('rwaHealth');if(!h)return;const age=Math.max(0,Math.floor((Date.now()-state.lastDataAt)/1000)),online=navigator.onLine&&state.health.online;h.classList.toggle('bad',!online||age>25);$('rwaHealthText').textContent=!online?'Offline · cached UI active':age>25?'Market feed delayed':'Market network live';$('rwaHealthAge').textContent=`${age}s since update`;}
function registerSW(){if('serviceWorker'in navigator)navigator.serviceWorker.register('rwa-sw-v5.js?v=13',{scope:'./'}).catch(()=>{})}
async function shareCurrent(){const snap=currentSnapshot(),u=new URL(location.href);u.hash=`asset/${snap.base||selectedBase()}`;const title=`RWA · ${snap.base||selectedBase()} market`;try{if(navigator.share){await navigator.share({title,text:title,url:u.href});return}await navigator.clipboard.writeText(u.href);toastSafe('RWA link copied')}catch(e){if(e?.name!=='AbortError')toastSafe('Share unavailable')}}
function handleAction(action,el){
  if(!action)return false;
  if(action==='search'){openCommand();return true}
  if(action==='markets'){navigate('markets');return true}
  if(action==='trade'){openTrade(el?.dataset?.coin||selectedBase());return true}
  if(action==='buy'){openTrade(el?.dataset?.coin||selectedBase(),true,'BUY');return true}
  if(action==='sell'){openTrade(el?.dataset?.coin||selectedBase(),true,'SELL');return true}
  if(action==='watch'){ensureQuickActions().then(q=>q?.watch?.()).catch(e=>toastSafe(e.message));return true}
  if(action==='alert'){ensureQuickActions().then(q=>q?.alert?.()).catch(e=>toastSafe(e.message));return true}
  if(action==='share'){shareCurrent();return true}
  if(action==='compare'){navigate('research');return true}
  if(action==='research'){navigate(`research/compare/${el?.dataset?.researchSymbol||selectedBase()}`);return true}
  if(action==='clear-compare'){state.compare=[];renderResearch();return true}
  if(action==='save-thesis'){
    const text=$('rwaResearchText')?.value.trim();if(!text){toastSafe('Write a research thesis first');return true}
    state.researchNotes.unshift({symbol:selectedBase(),bias:$('rwaResearchBias')?.value||'NEUTRAL',text,ts:Date.now()});saveResearchNotes();renderResearch();toastSafe('Research thesis saved');return true
  }
  if(action==='advanced-intel'){openSuite('intel','intelligence');return true}
  if(action==='institutional'){navigate('institutional');return true}
  if(action==='issuer'){openSuite('rwa','institutional');return true}
  if(action==='assets'){navigate('assets');return true}
  if(action==='wallet'){openSuite('portfolio','portfolio');setTimeout(()=>$('portfolioConnect')?.click(),160);return true}
  if(action==='notifications'){openSuite('watch','portfolio');return true}
  if(action==='profile'){openSuite('profile','portfolio');return true}
  if(action==='legacy-fundamentals'){const coin=el?.dataset?.coin||selectedBase();ensureFundamentals().then(f=>f?.openAsset?.(coin)||f?.open?.()).catch(e=>toastSafe(e.message));return true}
  return false;
}
function mapInternalUrl(u){
  const path=u.pathname.replace(/\/+$/,'/');
  if(!path.startsWith(ROOT_PATH))return null;
  if(path===ROOT_PATH)return cleanRoute(u.hash||'markets');
  const sub=path.slice(ROOT_PATH.length).replace(/^\/+|\/+$/g,'');
  if(sub==='trade'){return`trade/${(u.searchParams.get('coin')||selectedBase()).toUpperCase()}`}
  if(sub==='asset'){return`asset/${(u.searchParams.get('symbol')||selectedBase()).toUpperCase()}`}
  if(sub==='trader'){return`trader/${u.searchParams.get('wallet')||''}`}
  if(sub==='backtest'){return`research/backtest/${(u.searchParams.get('symbol')||selectedBase()).toUpperCase()}`}
  if(sub==='renko'){return`research/renko/${(u.searchParams.get('symbol')||selectedBase()).toUpperCase()}`}
  return'research';
}
function interceptClick(e){
  const pairRow=e.target.closest?.('.pairrow[data-sym]');if(pairRow){e.preventDefault();e.stopImmediatePropagation();const sym=String(pairRow.dataset.sym||'').replace(/USDT$/i,'');selectSymbol(sym);openAsset(sym,true);return}
  const actionEl=e.target.closest?.('[data-v5-action]');
  if(actionEl){e.preventDefault();e.stopImmediatePropagation();handleAction(actionEl.dataset.v5Action,actionEl);return}
  const routeEl=e.target.closest?.('[data-v5-route]');
  if(routeEl){e.preventDefault();e.stopImmediatePropagation();navigate(routeEl.dataset.v5Route);return}
  const tradeNow=e.target.closest?.('[data-rwa-trade-now]');
  if(tradeNow){e.preventDefault();e.stopImmediatePropagation();openTrade();return}
  const shell=e.target.closest?.('.topnav button,.product-nav button');
  if(shell){
    const t=(shell.textContent||'').trim().toLowerCase();
    const map={markets:'markets','live markets':'markets',intelligence:'intelligence','rwa index':'intelligence',assets:'assets','asset marketplace':'assets',research:'research',company:'institutional',institutional:'institutional',portfolio:'portfolio',social:'social',trade:'trade'};
    if(map[t]){e.preventDefault();e.stopImmediatePropagation();navigate(map[t]);return}
  }
  const a=e.target.closest?.('a[href]');
  if(a){
    let u;try{u=new URL(a.getAttribute('href'),location.href)}catch{return}
    if(u.protocol==='http:'||u.protocol==='https:'){
      if(u.origin===location.origin){
        const r=mapInternalUrl(u);
        if(r){e.preventDefault();e.stopImmediatePropagation();navigate(r);return}
      }else{
        e.preventDefault();e.stopImmediatePropagation();previewUrl(u.href,a.textContent?.trim()||'External source');return
      }
    }
  }
}
function handleKey(e){
  const tag=document.activeElement?.tagName?.toLowerCase(),typing=tag==='input'||tag==='textarea'||tag==='select'||document.activeElement?.isContentEditable;
  if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){e.preventDefault();openCommand();return}
  if(e.key==='/'&&!typing){e.preventDefault();openCommand();return}
  if((e.key==='Enter'||e.key===' ')&&!typing){const v=e.target?.closest?.('[data-v5-route],[data-v5-action]');if(v){e.preventDefault();const r=v.dataset.v5Route,a=v.dataset.v5Action;if(r)navigate(r);else if(a)handleAction(a,v);return}}
  if(e.key==='Escape'){closeCommand()}
}
function patchLegacyAPIs(){
  if(window.RWASuperAppLegacyPatched!==true)window.RWASuperAppLegacyPatched=true;
  if(window.RWAQuickActions){
    window.RWAQuickActions.trade=()=>openTrade();
    window.RWAQuickActions.shellRoute=label=>{
      const t=String(label||'').toLowerCase();
      if(t.includes('market'))navigate('markets');
      else if(t.includes('intel')||t.includes('index'))navigate('intelligence');
      else if(t.includes('asset'))navigate('assets');
      else if(t.includes('research'))navigate('research');
      else if(t.includes('company')||t.includes('institution'))navigate('institutional');
      return Promise.resolve(true);
    };
  }
}
function updateTicker(){
  const top=topPairs('abs',6),box=$('rwaTickerTape');
  if(box&&top.length)box.innerHTML=top.map(x=>`<button type="button" data-open-market="${esc(x.base)}"><b>${esc(x.base)}</b><span>${money(x.price)}</span><i class="${x.change>=0?'up':'down'}">${pct(x.change)}</i></button>`).join('');
  const st=$('rwaTickerStatus');if(st)st.textContent=$('liveText')?.textContent||'LIVE';
  bindWorkspaceRows();
}
function syncLabel(){
  const label=$('rwaWorkspaceLabel');if(!label)return;
  const n=routeParts(state.route).name;
  label.textContent=({markets:'Markets',trade:'Trade',asset:'Asset',assets:'Assets',intelligence:'Intelligence',research:'Research',portfolio:'Portfolio',social:'Social',institutional:'Institutional',trader:'Trader'})[n]||'RWA';
}
function routeFromHash(){applyRoute(location.hash||'#markets');syncLabel()}
function bootTimers(){
  if(state.timer)clearInterval(state.timer);
  state.timer=setInterval(()=>{
    patchLegacyAPIs();updateTicker();syncLabel();renderHealth();
    if(state.workspace==='intelligence'&&!$('rwaSuperCommand')?.matches(':not([hidden])'))renderIntelligence();
  },3000);
}
function init(){
  document.documentElement.dataset.rwaSuperApp='5.0.0';
  installShell();
  const legacyInst=document.querySelector('.institutional-card');if(legacyInst){legacyInst.classList.remove('institutional-card');legacyInst.classList.add('rwa-legacy-institutional-card');const lb=legacyInst.querySelector('button');if(lb){lb.removeAttribute('onclick');lb.dataset.v5Route='institutional'}}
  commandLayer();ensurePreview();installHealth();registerSW();
  document.addEventListener('click',interceptClick,true);
  document.addEventListener('keydown',handleKey,true);
  addEventListener('hashchange',routeFromHash);
  addEventListener('popstate',routeFromHash);
  patchLegacyAPIs();bootTimers();updateTicker();
  loadCatalog().catch(()=>{});loadAssets().catch(()=>{});
  state.symbol=selectedBase();
  window.RWAProductOS={
    version:'5.0.0',
    runtime:'single-page-super-app',
    openHome:openMarkets,
    openMarkets,
    openTrade,
    openSocial,
    openSuite,
    openCommand,
    openTrader,
    openAsset,
    openIntelligence,
    openAssets,
    openResearch,
    openPortfolio,
    openInstitutional,
    navigate,
    setDefaultLanding:()=>{try{localStorage.setItem('rwa_default_landing_v3','markets')}catch{}}
  };
  try{localStorage.setItem('rwa_default_landing_v3','markets')}catch{}
  window.RWASuperApp={version:'5.0.0',canonical:'https://copytolive.github.io/rwa/',navigate,route:()=>state.route,openCommand,openTrade,openAsset,openResearch,preview:previewUrl,health:()=>({...state.health,lastDataAt:state.lastDataAt})};
  window.dispatchEvent(new CustomEvent('rwa:product-os-ready',{detail:{version:'5.0.0',singlePage:true}}));
  setTimeout(routeFromHash,0);
}
init();
})();

/* RWA_SUPERAPP_P16_P20_V1 */
(()=>{
'use strict';
if(window.RWAExperience?.version==='20.0.0')return;
const ROOT='/rwa/';
const $=id=>document.getElementById(id);
const qa=(s,r=document)=>[...r.querySelectorAll(s)];
const now=()=>performance.now();
const started=now();
const quality={firstHistoryAt:0,firstMarketAt:0,readyAt:0,lastAudit:null,routeChanges:0};
const route=()=>String(location.hash||'#markets').replace(/^#/,'')||'markets';
const rootRoute=()=>route().split('/')[0];
const text=(id,fallback='—')=>($(id)?.textContent||fallback).trim();
const numberFrom=id=>{const n=Number(text(id,'').replace(/[^0-9+.,-]/g,'').replace(/,/g,''));return Number.isFinite(n)?n:null};
const selected=()=>String(text('selName','BTC / USDT')).split(/[\/\s-]/)[0].replace(/[^A-Za-z0-9]/g,'').toUpperCase()||'BTC';
const delay=ms=>new Promise(r=>setTimeout(r,ms));

function modeFor(r=rootRoute()){
  if(['markets','intelligence','assets'].includes(r))return'discovery';
  if(['asset','research','social','trader'].includes(r))return'analysis';
  return'action';
}
/* RWA_EXPERIENCE_RAIL_LIFECYCLE_V15 */
function installExperienceRail(){
  let rail=$('rwaExperienceRail');
  if(!rail){
    rail=document.createElement('div');rail.id='rwaExperienceRail';rail.className='rwa-experience-rail';rail.setAttribute('aria-label','RWA workflow level');
    rail.innerHTML=`<button type="button" data-rwa-level="discovery"><b>01</b><span>Discovery<small>Markets · Intelligence · Assets</small></span></button><button type="button" data-rwa-level="analysis"><b>02</b><span>Analysis<small>Chart · Research · Social</small></span></button><button type="button" data-rwa-level="action"><b>03</b><span>Action<small>Trade · Portfolio · Institutional</small></span></button>`;
  }
  if(!rail.dataset.rwaBound){
    rail.dataset.rwaBound='1';
    rail.addEventListener('click',e=>{const b=e.target.closest('[data-rwa-level]');if(!b)return;const m=b.dataset.rwaLevel;const target=m==='discovery'?'markets':m==='analysis'?`asset/${selected()}`:'trade/'+selected();window.RWASuperApp?.navigate?.(target)});
  }
  if(!rail.isConnected){
    const anchor=document.querySelector('.trustbar')||document.querySelector('.productbar');
    const host=document.querySelector('.app')||document.body;
    if(anchor?.parentNode)anchor.parentNode.insertBefore(rail,anchor.nextSibling);
    else{
      const mountMarker=host.querySelector?.('.mobile-home,.layout,#rwaSuperWorkspace,.credibility-strip');
      if(mountMarker)host.insertBefore(rail,mountMarker);else host.appendChild(rail);
    }
  }
  updateExperienceRail();
  return rail;
}
function updateExperienceRail(){
  const m=modeFor();qa('#rwaExperienceRail [data-rwa-level]').forEach(b=>b.classList.toggle('active',b.dataset.rwaLevel===m));
  document.documentElement.dataset.rwaLevel=m;
}
function installFirstLoadStatus(){
  const wrap=document.querySelector('.chart-wrap');if(!wrap||$('rwaFirstLoadStatus'))return;
  const el=document.createElement('div');el.id='rwaFirstLoadStatus';el.className='rwa-firstload';el.innerHTML=`<div class="rwa-firstload-grid"><i></i><i></i><i></i><i></i><i></i></div><div><b id="rwaFirstLoadTitle">Preparing market history</b><small id="rwaFirstLoadSub">Historical bars first · realtime follows</small></div><button type="button" data-p20-action="retry">Retry</button>`;wrap.appendChild(el);
}
function historyReady(){
  if(document.documentElement.dataset.rwaHistory==='ready')return true;
  const c=$('fallbackChart');if(c?.dataset?.rwaHistoryReady==='1')return true;
  const tv=$('tvHost');if(tv&&tv.children.length>0&&tv.getBoundingClientRect().height>120)return true;
  return false;
}
function marketsReady(){
  const rows=qa('#pairList .pairrow');
  const p=text('statPrice','—');
  return rows.length>2&&p!=='—'&&p!=='';
}
function updateFirstLoad(){
  const hist=historyReady(),mkt=marketsReady(),el=$('rwaFirstLoadStatus');
  if(hist&&!quality.firstHistoryAt)quality.firstHistoryAt=now();
  if(mkt&&!quality.firstMarketAt)quality.firstMarketAt=now();
  if(hist&&mkt){
    if(!quality.readyAt){quality.readyAt=now();performance.mark('rwa:p20-ready');document.documentElement.dataset.rwaFirstPaint='ready';window.dispatchEvent(new CustomEvent('rwa:first-ready',{detail:{ms:Math.round(quality.readyAt-started)}}))}
    if(el){$('rwaFirstLoadTitle').textContent='Market ready';$('rwaFirstLoadSub').textContent='Historical bars + live market connected';el.classList.add('ready');setTimeout(()=>{if(el)el.hidden=true},420)}
    return;
  }
  if(!el)return;
  el.hidden=false;const elapsed=now()-started;
  if(hist){$('rwaFirstLoadTitle').textContent='Historical bars ready';$('rwaFirstLoadSub').textContent='Connecting realtime market…'}
  else if(document.documentElement.dataset.rwaHistory==='delayed'){$('rwaFirstLoadTitle').textContent='Historical feed delayed';$('rwaFirstLoadSub').textContent='Terminal remains usable · retry without leaving this page';el.classList.add('warn')}
  else{$('rwaFirstLoadTitle').textContent='Preparing market history';$('rwaFirstLoadSub').textContent='Loading real historical bars before realtime'}
  if(elapsed>9000&&!hist){el.classList.add('warn');$('rwaFirstLoadTitle').textContent='Market history is taking longer than expected';$('rwaFirstLoadSub').textContent='Cached UI remains available · retry safely'}
}
function installContextBrief(){
  const right=$('depth')||document.querySelector('.right');if(!right||$('rwaContextBrief'))return;
  const s=document.createElement('section');s.id='rwaContextBrief';s.className='right-section rwa-context-brief';s.innerHTML=`<div class="right-title"><span>CONTEXT / AI INSIGHT</span><small id="rwaContextFreshness">LIVE</small></div><div class="rwa-context-symbol"><div><small id="rwaContextSource">PUBLIC MARKET DATA</small><b id="rwaContextSymbol">BTC / USDT</b></div><strong id="rwaContextPrice">—</strong></div><p id="rwaContextInsight">Waiting for live market context…</p><div class="rwa-context-proof"><span><i></i><b>History</b><small id="rwaContextHistory">loading</small></span><span><i></i><b>Realtime</b><small id="rwaContextRealtime">connecting</small></span><span><i></i><b>Evidence</b><small id="rwaContextEvidence">market data</small></span></div><div class="rwa-context-actions"><button type="button" data-p20-action="research">Research</button><button type="button" data-p20-action="trade">Trade</button></div>`;
  right.insertBefore(s,right.firstChild);
}
function updateContextBrief(){
  if(!$('rwaContextBrief'))return;
  const sym=selected(),price=text('statPrice'),chg=numberFrom('statChange'),buy=numberFrom('buyPct'),label=text('selLabel','Public market feed');
  $('rwaContextSymbol').textContent=`${sym} / USDT`;$('rwaContextPrice').textContent=price;$('rwaContextSource').textContent=label.toUpperCase();
  const h=historyReady(),m=marketsReady(),evidence=rootRoute()==='asset'?'asset context':rootRoute()==='assets'?'registry + discovery':'market data';
  $('rwaContextHistory').textContent=h?'ready':'loading';$('rwaContextRealtime').textContent=m?'live':navigator.onLine?'connecting':'offline';$('rwaContextEvidence').textContent=evidence;
  $('rwaContextFreshness').textContent=!navigator.onLine?'OFFLINE':m?'LIVE':'CONNECTING';
  let insight='Waiting for enough live data to form a market insight.';
  if(chg!==null){
    const direction=chg>1?'positive':chg<-1?'negative':'neutral';const pressure=buy===null?'order-flow still loading':buy>=56?'buy pressure is elevated':buy<=44?'sell pressure is elevated':'order flow is balanced';
    insight=`${sym} momentum is ${direction} at ${chg>=0?'+':''}${chg.toFixed(2)}% over 24h; ${pressure}. This is market context, not investment advice.`;
  }
  $('rwaContextInsight').textContent=insight;
}
function installMobileAssetActions(){
  if($('rwaMobileAssetActions'))return;
  const bar=document.createElement('div');bar.id='rwaMobileAssetActions';bar.className='rwa-mobile-asset-actions';bar.innerHTML=`<button type="button" data-p20-action="research">Research</button><button type="button" class="buy" data-p20-action="buy">Buy</button><button type="button" class="sell" data-p20-action="sell">Sell</button>`;document.body.appendChild(bar);updateMobileActions();
}
function updateMobileActions(){const el=$('rwaMobileAssetActions');if(el)el.classList.toggle('show',rootRoute()==='asset')}
function installQualityBadge(){
  if($('rwaQualityBadge'))return;
  const b=document.createElement('button');b.id='rwaQualityBadge';b.type='button';b.className='rwa-quality-badge';b.textContent='UX';b.title='Product quality status';b.addEventListener('click',()=>toggleQualityPanel());document.body.appendChild(b);
  const p=document.createElement('aside');p.id='rwaQualityPanel';p.className='rwa-quality-panel';p.hidden=true;p.innerHTML=`<header><div><small>RWA PRODUCT QUALITY</small><b>P16–P20 live audit</b></div><button type="button" data-quality-close>×</button></header><div id="rwaQualityBody"></div>`;document.body.appendChild(p);p.querySelector('[data-quality-close]').onclick=()=>p.hidden=true;
  if(new URLSearchParams(location.search).get('qa')==='1')toggleQualityPanel(true);
}
function audit(){
  const issues=[];const add=(sev,code,msg)=>issues.push({sev,code,msg});
  if(location.pathname!==ROOT)add('BLOCKER','PATH_ESCAPE',`pathname=${location.pathname}`);
  const r=rootRoute();if(!['markets','intelligence','assets','asset','research','portfolio','social','institutional','trade','trader'].includes(r))add('MAJOR','ROUTE_UNKNOWN',r);
  if(document.documentElement.scrollWidth>innerWidth+4)add('MAJOR','H_OVERFLOW',`${document.documentElement.scrollWidth}/${innerWidth}`);
  if(now()-started>8000&&!historyReady())add('MAJOR','HISTORY_DELAYED','Historical chart not ready after 8s');
  if(now()-started>8000&&!marketsReady())add('MAJOR','MARKET_DELAYED','Live market list/price not ready after 8s');
  if(!navigator.onLine)add('INFO','OFFLINE','Browser is offline; cached shell active');
  const externalInternal=qa('a[href]').filter(a=>{try{const u=new URL(a.getAttribute('href'),location.href);return u.origin===location.origin&&u.pathname.startsWith(ROOT)&&u.pathname!==ROOT&&!u.searchParams.has('embed')}catch{return false}});if(externalInternal.length)add('MEDIUM','LEGACY_LINKS',`${externalInternal.length} internal legacy href(s) remain but are guarded`);
  const scripts=qa('script[src]').filter(s=>!s.dataset.rwaLazy).length;if(document.readyState==='complete'&&rootRoute()==='markets'&&scripts>8)add('MEDIUM','EAGER_SCRIPT_BUDGET',String(scripts));
  const blocking=issues.filter(x=>x.sev==='BLOCKER'||x.sev==='MAJOR');const result={ok:blocking.length===0,route:route(),pathname:location.pathname,history:historyReady(),markets:marketsReady(),online:navigator.onLine,overflow:document.documentElement.scrollWidth-innerWidth,externalScripts:scripts,firstHistoryMs:quality.firstHistoryAt?Math.round(quality.firstHistoryAt-started):null,firstMarketMs:quality.firstMarketAt?Math.round(quality.firstMarketAt-started):null,readyMs:quality.readyAt?Math.round(quality.readyAt-started):null,issues,blocking};quality.lastAudit=result;return result;
}
function renderQuality(){const box=$('rwaQualityBody');if(!box)return;const a=audit();const rows=[['PATH',a.pathname===ROOT?'PASS':'FAIL',a.pathname],['HISTORY',a.history?'PASS':'WAIT',a.firstHistoryMs==null?'—':`${a.firstHistoryMs} ms`],['MARKET',a.markets?'PASS':'WAIT',a.firstMarketMs==null?'—':`${a.firstMarketMs} ms`],['READY',a.ok?'PASS':'CHECK',a.readyMs==null?'—':`${a.readyMs} ms`],['OVERFLOW',a.overflow<=4?'PASS':'FAIL',String(a.overflow)],['NETWORK',a.online?'LIVE':'OFFLINE',a.online?'public feeds':'cached shell']];box.innerHTML=`<div class="rwa-quality-grid">${rows.map(r=>`<div><small>${r[0]}</small><b class="${r[1]==='PASS'||r[1]==='LIVE'?'ok':''}">${r[1]}</b><span>${r[2]}</span></div>`).join('')}</div><section><small>FINDINGS</small>${a.issues.length?a.issues.map(x=>`<p><b>${x.sev}</b> ${x.code} · ${x.msg}</p>`).join(''):'<p><b>PASS</b> No blocking product-quality finding.</p>'}</section>`}
function toggleQuality(force){const p=$('rwaQualityPanel');if(!p)return;p.hidden=force===true?false:!p.hidden;if(!p.hidden)renderQuality()}
async function softRetry(){
  const s=selected();$('rwaFirstLoadStatus')?.classList.remove('warn');if($('rwaFirstLoadStatus'))$('rwaFirstLoadStatus').hidden=false;
  try{await window.RWAHistoryFirstPaint?.refresh?.(`${s}USDT`)}catch{}
  try{window.RWASuperApp?.navigate?.(route())}catch{}
  window.dispatchEvent(new CustomEvent('rwa:retry-data',{detail:{symbol:s}}));updateFirstLoad();updateContextBrief();
}
function handleAction(e){
  const b=e.target.closest?.('[data-p20-action]');if(!b)return;const a=b.dataset.p20Action;e.preventDefault();e.stopPropagation();const sym=selected();
  if(a==='retry')softRetry();if(a==='research')window.RWASuperApp?.navigate?.(`research/compare/${sym}`);if(a==='trade')window.RWASuperApp?.navigate?.(`trade/${sym}`);if(a==='buy')window.RWAProductOS?.openTrade?.(sym,true,'BUY');if(a==='sell')window.RWAProductOS?.openTrade?.(sym,true,'SELL');
}
function removeEscapeTargets(){qa('a[target="_blank"]').forEach(a=>{a.removeAttribute('target');a.removeAttribute('rel')})}
function onRoute(){quality.routeChanges++;installExperienceRail();updateExperienceRail();updateMobileActions();updateContextBrief();setTimeout(()=>{installExperienceRail();removeEscapeTargets();updateFirstLoad();renderQuality()},80)}
function boot(){
  document.documentElement.dataset.rwaP16P20='ready';performance.mark('rwa:p16-p20-boot');installExperienceRail();installFirstLoadStatus();installContextBrief();installMobileAssetActions();installQualityBadge();removeEscapeTargets();
  document.addEventListener('click',handleAction,true);addEventListener('hashchange',onRoute);addEventListener('popstate',onRoute);addEventListener('online',()=>setTimeout(onRoute,50));addEventListener('offline',()=>setTimeout(onRoute,50));addEventListener('rwa:history-first-paint',()=>{updateFirstLoad();updateContextBrief()});
  const railHost=document.querySelector('.app')||document.body;const railObserver=new MutationObserver(()=>{if(!$('rwaExperienceRail'))installExperienceRail()});railObserver.observe(railHost,{childList:true});
  const timer=setInterval(()=>{installExperienceRail();updateFirstLoad();updateContextBrief();updateExperienceRail();updateMobileActions();removeEscapeTargets();if(!$('rwaQualityPanel')?.hidden)renderQuality()},400);
  window.addEventListener('beforeunload',()=>{clearInterval(timer);railObserver.disconnect()},{once:true});
  window.RWAExperience={version:'20.0.0',canonical:'https://copytolive.github.io/rwa/',audit,softRetry,mode:modeFor,metrics:()=>({...quality}),refresh:()=>{installExperienceRail();onRoute();return audit()}};
  window.RWAProductQuality=window.RWAExperience;
  updateFirstLoad();updateContextBrief();setTimeout(onRoute,250);setTimeout(onRoute,1800);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
