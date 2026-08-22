(()=>{
  const $=id=>document.getElementById(id);
  const STORAGE_KEY='rwa_social_theses_v1';
  const CHART_CACHE='rwa_chart_cache_v2';
  let thesisSide='LONG',suiteLoadPromise=null;
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#039;'}[m]));
  const compactNumber=v=>{const n=Number(v);if(!Number.isFinite(n))return'—';return'$'+Intl.NumberFormat('en',{notation:'compact',maximumFractionDigits:1}).format(n)};
  const fmtPrice=v=>{const n=Number(v);if(!Number.isFinite(n))return'—';const d=n>=1000?2:n>=1?4:n>=.01?5:7;return'$'+n.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:d})};
  const fmtPct=v=>{const n=Number(v);if(!Number.isFinite(n))return'—';return(n>=0?'+':'')+n.toFixed(2)+'%'};
  function selected(){return typeof S!=='undefined'&&S.map?S.map.get(S.selected):null}
  function warmConnections(){
    for(const href of ['https://data-api.binance.vision','https://data-stream.binance.vision','https://stream.binance.com']){
      if(document.querySelector(`link[data-rwa-preconnect=\"${href}\"]`))continue;const l=document.createElement('link');l.rel='preconnect';l.href=href;l.crossOrigin='anonymous';l.dataset.rwaPreconnect=href;document.head.appendChild(l)
    }
  }
  function chartCacheKey(){return `${CHART_CACHE}:${typeof S!=='undefined'?S.selected:'BTCUSDT'}:${typeof S!=='undefined'?S.interval:'15'}`}
  function restoreCachedChart(){try{if(typeof S==='undefined'||!Array.isArray(S.klines)||S.klines.length)return;const v=JSON.parse(localStorage.getItem(chartCacheKey())||'null');if(v&&Array.isArray(v.data)&&v.data.length&&Date.now()-Number(v.ts||0)<6*60*60*1000){S.klines=v.data;if(typeof drawFallback==='function')drawFallback()}}catch(_){}}
  function drawInstantGrid(){const c=$('fallbackChart');if(!c||typeof c.getContext!=='function')return;const ctx=c.getContext('2d'),rect=c.getBoundingClientRect(),dpr=devicePixelRatio||1,w=Math.max(1,rect.width),h=Math.max(1,rect.height);c.width=Math.max(1,w*dpr);c.height=Math.max(1,h*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);ctx.fillStyle='#09090d';ctx.fillRect(0,0,w,h);ctx.strokeStyle='#18181f';ctx.lineWidth=1;for(let i=1;i<6;i++){const y=h*i/6;ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke()}for(let i=1;i<8;i++){const x=w*i/8;ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,h);ctx.stroke()}ctx.fillStyle='#5f6875';ctx.font='11px system-ui';ctx.textAlign='left';ctx.fillText('BTC / USDT',14,22)}
  function instantChartBoot(){
    if(typeof S==='undefined')return;
    restoreCachedChart();if(!S.klines?.length)drawInstantGrid();
    if(typeof loadKlines==='function'){
      const originalKlines=loadKlines;let pendingKey='',pending=null,lastDone=0;
      loadKlines=function(){const key=`${S.selected}:${S.interval}`;if(pending&&pendingKey===key)return pending;if(pendingKey===key&&Date.now()-lastDone<2500)return Promise.resolve(S.klines);pendingKey=key;pending=Promise.resolve(originalKlines()).then(()=>{try{if(Array.isArray(S.klines)&&S.klines.length)localStorage.setItem(chartCacheKey(),JSON.stringify({ts:Date.now(),data:S.klines.slice(-180)}))}catch(_){};lastDone=Date.now();return S.klines}).finally(()=>{pending=null});return pending}
    }
    if(typeof loadTradingView==='function'){
      const originalTV=loadTradingView;let lastKey=$('tvHost')?.children.length?`${S.selected}:${S.interval}`:'';
      loadTradingView=function(force=false){const key=`${S.selected}:${S.interval}`,host=$('tvHost');if(!force&&lastKey===key&&host&&host.children.length)return;lastKey=key;return originalTV()}
    }
    if(typeof connectDetail==='function'){
      const originalDetail=connectDetail;
      connectDetail=function(force=false){const ws=S.detailWS;if(!force&&ws&&ws.__rwaSymbol===S.selected&&ws.readyState<=1)return;const out=originalDetail();if(S.detailWS)S.detailWS.__rwaSymbol=S.selected;return out}
    }
    try{loadTradingView();loadKlines();connectDetail()}catch(e){console.warn('Instant chart bootstrap fallback',e)}
  }
  function syncStatus(){const pc=$('pairCount'),mpc=$('mobilePairCount');if(mpc){if(typeof S!=='undefined'&&Array.isArray(S.pairs)&&S.pairs.length)mpc.textContent=`${S.pairs.length} live pairs`;else if(pc){const m=(pc.textContent||'').match(/\d+/);mpc.textContent=m?`${m[0]} live pairs`:'Loading markets…'}}}
  function syncBreadth(){if(typeof S==='undefined'||!Array.isArray(S.pairs)||!S.pairs.length)return;let gain=0,loss=0,rwa=0;for(const x of S.pairs){if((x.change||0)>0)gain++;else if((x.change||0)<0)loss++;if(x.rwa)rwa++;}if($('mobileGainers'))$('mobileGainers').textContent=gain.toLocaleString();if($('mobileLosers'))$('mobileLosers').textContent=loss.toLocaleString();if($('mobileRwaCount'))$('mobileRwaCount').textContent=rwa.toLocaleString()}
  function syncSelectedStats(){for(const [from,to] of [['statHigh','mobileHigh'],['statLow','mobileLow'],['statVol','mobileVolume']]){const a=$(from),b=$(to);if(a&&b)b.textContent=a.textContent}}
  function annotateRows(){if(innerWidth>680||typeof S==='undefined'||!S.map)return;document.querySelectorAll('.pairrow[data-sym]').forEach(row=>{const x=S.map.get(row.dataset.sym),box=row.querySelector('.pairprice');if(!x||!box)return;let vol=box.querySelector('.mobile-row-vol');if(!vol){vol=document.createElement('span');vol.className='mobile-row-vol';box.appendChild(vol)}vol.textContent=`Vol ${compactNumber(x.vol)}`})}
  function syncSocialStats(){const x=selected();if(!x)return;const pair=`${x.base} / ${x.quote||'USDT'}`;if($('socialPair'))$('socialPair').textContent=pair;if($('thesisPair'))$('thesisPair').textContent=pair;const buyEl=$('buyPct');if($('socialBuyPct'))$('socialBuyPct').textContent=buyEl?buyEl.textContent:'50%';if($('socialTrades'))$('socialTrades').textContent=(typeof S!=='undefined'?S.trades||0:0).toLocaleString();if($('socialChange')){$('socialChange').textContent=fmtPct(x.change);$('socialChange').className=(x.change||0)>=0?'up':'down'}}
  function renderTrending(){const box=$('socialTrending');if(!box||typeof S==='undefined'||!Array.isArray(S.pairs)||!S.pairs.length)return;const items=[...S.pairs].filter(x=>Number.isFinite(x.price)&&Number.isFinite(x.change)).sort((a,b)=>Math.abs(b.change)-Math.abs(a.change)).slice(0,8);box.innerHTML=items.map(x=>`<button class="social-trend" data-social-sym="${esc(x.symbol)}"><b>${esc(x.base)} / USDT</b><strong>${esc(fmtPrice(x.price))}</strong><span class="${x.change>=0?'up':'down'}">${esc(fmtPct(x.change))}</span><small>Vol ${esc(compactNumber(x.vol))}</small></button>`).join('')}
  function loadPosts(){try{const v=JSON.parse(localStorage.getItem(STORAGE_KEY)||'[]');return Array.isArray(v)?v:[]}catch(_){return[]}}
  function savePosts(v){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(v.slice(0,20)))}catch(_){}}
  function relativeTime(ts){const s=Math.max(0,Math.floor((Date.now()-Number(ts||Date.now()))/1000));if(s<60)return`${s}s`;if(s<3600)return`${Math.floor(s/60)}m`;if(s<86400)return`${Math.floor(s/3600)}h`;return`${Math.floor(s/86400)}d`}
  function liveSignals(){if(typeof S==='undefined'||!Array.isArray(S.pairs))return[];return[...S.pairs].filter(x=>Number.isFinite(x.change)&&Number.isFinite(x.price)).sort((a,b)=>Math.abs(b.change)-Math.abs(a.change)).slice(0,3).map(x=>({pair:`${x.base} / USDT`,side:'SIGNAL',text:`${x.base} is ${x.change>=0?'up':'down'} ${Math.abs(x.change).toFixed(2)}% over 24h with ${compactNumber(x.vol)} quoted volume.`,price:x.price,ts:Date.now(),symbol:x.symbol,signal:true}))}
  function renderFeed(){const box=$('socialFeed');if(!box)return;const posts=loadPosts(),signals=liveSignals(),all=[...posts.map(p=>({...p,signal:false})),...signals];if(!all.length){box.innerHTML='<div class="social-empty">No thesis yet. Live market signals will appear here.</div>';return}box.innerHTML=all.map(p=>{const side=(p.side||'SIGNAL').toUpperCase(),badge=side==='LONG'?'long':side==='SHORT'?'short':'signal',who=p.signal?'Live market signal':'You',initial=p.signal?'M':'Y';return`<article class="social-post"><div class="social-post-head"><div class="social-post-user"><div class="social-avatar">${initial}</div><div><b>${who}</b><small>${esc(p.pair||'Market')} · ${p.signal?'live':relativeTime(p.ts)}</small></div></div><span class="social-side-badge ${badge}">${esc(side)}</span></div><p>${esc(p.text)}</p><div class="social-post-meta"><span>${p.price!=null?esc(fmtPrice(p.price)):'Market thesis'}</span><span>${p.signal?'Market data':'Saved on this device'}</span></div></article>`}).join('')}
  function syncMobile(){syncStatus();syncBreadth();syncSelectedStats();annotateRows();syncSocialStats()}
  function watch(id,fn=syncMobile){const el=$(id);if(el)new MutationObserver(fn).observe(el,{subtree:true,childList:true,characterData:true,attributes:true})}
  function setNav(name){document.querySelectorAll('[data-mobile-nav]').forEach(a=>a.classList.toggle('active',a.dataset.mobileNav===name))}
  function closeSuite(){document.body.classList.remove('suite-open');if(innerWidth<=680){const s=$('suite');if(s)s.style.display='none'}}
  function closeMarkets(){if(innerWidth>680)return;document.body.classList.remove('market-drawer-open')}
  function closeSocial(){if(innerWidth>680)return;document.body.classList.remove('social-open')}
  function openMarkets(focusSearch=false){if(innerWidth>680)return;closeSocial();closeSuite();document.body.classList.add('market-drawer-open');setNav('markets');syncMobile();if(focusSearch)setTimeout(()=>$('search')?.focus(),120)}
  function openSocial(){if(innerWidth>680)return;closeMarkets();closeSuite();document.body.classList.add('social-open');setNav('social');syncMobile();renderTrending();renderFeed();const sc=$('social');if(sc)sc.scrollTop=0}
  function setDetailView(view,scroll=false){if(innerWidth>680)return;closeMarkets();closeSocial();closeSuite();document.body.classList.remove('mview-overview','mview-trades','mview-depth');document.body.classList.add(`mview-${view}`);document.querySelectorAll('[data-mobile-view]').forEach(b=>b.classList.toggle('active',b.dataset.mobileView===view));setNav(view==='depth'?'depth':'chart');if(scroll)(view==='depth'?$('depth'):$('terminal'))?.scrollIntoView({behavior:'smooth',block:'start'})}
  function publishThesis(){const input=$('thesisText'),x=selected();if(!input||!x)return;const text=input.value.trim();if(!text){if(typeof toast==='function')toast('Write a thesis first');return}const posts=loadPosts();posts.unshift({id:Date.now(),pair:`${x.base} / ${x.quote||'USDT'}`,symbol:x.symbol,side:thesisSide,text,price:x.price,change:x.change,ts:Date.now()});savePosts(posts);input.value='';if($('thesisCount'))$('thesisCount').textContent='0 / 180';renderFeed();if(typeof toast==='function')toast('Thesis saved to your device')}
  document.addEventListener('click',e=>{
    const row=e.target.closest('.pairrow');if(row&&innerWidth<=680){setTimeout(()=>{syncMobile();closeMarkets();setDetailView('overview',true)},120);return}
    if(e.target.closest('#mobileMarketsClose')){e.preventDefault();closeMarkets();setNav('chart');return}
    const headerSocial=e.target.closest('[data-mobile-header="social"]');if(headerSocial&&innerWidth<=680){e.preventDefault();openSocial();return}
    const trend=e.target.closest('[data-social-sym]');if(trend&&innerWidth<=680){e.preventDefault();const sym=trend.dataset.socialSym;if(typeof selectPair==='function')selectPair(sym,false);setTimeout(()=>setDetailView('overview',true),120);return}
    const side=e.target.closest('[data-thesis-side]');if(side&&innerWidth<=680){e.preventDefault();thesisSide=side.dataset.thesisSide;document.querySelectorAll('[data-thesis-side]').forEach(b=>b.classList.toggle('active',b.dataset.thesisSide===thesisSide));return}
    if(e.target.closest('#publishThesis')){e.preventDefault();publishThesis();return}
    const view=e.target.closest('[data-mobile-view]');if(view&&innerWidth<=680){e.preventDefault();setDetailView(view.dataset.mobileView,true);return}
    const nav=e.target.closest('[data-mobile-nav]');if(nav&&innerWidth<=680){e.preventDefault();const target=nav.dataset.mobileNav;if(target==='hub'||target==='portfolio'){loadSuite().then(()=>window.RWASuite?.open(target==='portfolio'?'portfolio':'profile'));return;}if(target==='markets')openMarkets(false);else if(target==='social')openSocial();else if(target==='depth')setDetailView('depth',true);else setDetailView('overview',true)}
  });
  const thesis=$('thesisText');if(thesis)thesis.addEventListener('input',()=>{if($('thesisCount'))$('thesisCount').textContent=`${thesis.value.length} / 180`});
  ['pairCount','liveDot','statHigh','statLow','statVol','statChange','buyPct','tradeCount'].forEach(id=>watch(id));watch('pairList',()=>setTimeout(()=>{syncMobile();renderTrending()},0));
  addEventListener('resize',()=>{syncMobile();if(innerWidth>680){document.body.classList.remove('market-drawer-open','social-open','suite-open')}else if(!document.body.classList.contains('mview-overview')&&!document.body.classList.contains('mview-trades')&&!document.body.classList.contains('mview-depth'))setDetailView('overview')});
  function loadScript(src){return new Promise((resolve,reject)=>{const existing=[...document.scripts].find(x=>(x.getAttribute('src')||'').split('?')[0]===src.split('?')[0]);if(existing){if(existing.dataset.rwaReady==='1')return resolve();existing.addEventListener('load',resolve,{once:true});existing.addEventListener('error',reject,{once:true});return}const s=document.createElement('script');s.src=src;s.onload=()=>{s.dataset.rwaReady='1';resolve()};s.onerror=reject;document.body.appendChild(s)})}
  document.addEventListener('click',e=>{const b=e.target.closest?.('.signin,.institutional,.topnav button,.product-nav button');if(!b)return;const t=(b.textContent||'').trim().toLowerCase();let tab='';if(b.matches('.signin')||t==='company')tab='profile';else if(b.matches('.institutional')||t.includes('asset'))tab='rwa';else if(t.includes('intelligence')||t.includes('rwa index'))tab='intel';else if(t.includes('research'))tab='feed';if(!tab)return;e.preventDefault();e.stopImmediatePropagation();loadSuite().then(()=>window.RWASuite?.open(tab));},true);
  function loadSuite(){if(suiteLoadPromise)return suiteLoadPromise;suiteLoadPromise=(async()=>{try{if(!document.querySelector('link[href^="suite.css"]')){const l=document.createElement('link');l.rel='stylesheet';l.href='suite.css?v=1';document.head.appendChild(l)}await loadScript('suite-ui.js?v=1');await loadScript('suite.js?v=1');await loadScript('suite-nav.js?v=1')}catch(e){console.error('RWA suite load failed',e)}})();return suiteLoadPromise}
  warmConnections();instantChartBoot();
  syncMobile();renderFeed();if(innerWidth<=680){closeMarkets();closeSocial();setDetailView('overview')}setInterval(()=>{syncMobile();if(document.body.classList.contains('social-open')){renderTrending();renderFeed()}},2200);
})();
