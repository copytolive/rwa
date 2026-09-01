(()=>{
  'use strict';
  const L=window.LightweightCharts;
  if(!L||typeof L.createChart!=='function'||L.__rwaBridgeInstalled)return;
  const native=L.createChart.bind(L);
  L.createChart=(...args)=>{
    const chart=native(...args);
    window.__RWARenkoChart=chart;
    try{window.dispatchEvent(new CustomEvent('renko:chart-ready',{detail:{chart}}))}catch(_){ }
    return chart;
  };
  L.__rwaBridgeInstalled=true;

  // GOLD downloaded-only mode. Never preload or expose symbols whose fixed-1s
  // source packs are not already materialized in the GOLD dataset.
  let goldOnly=false;
  try{goldOnly=new URLSearchParams(location.search).get('gold')==='1'}catch(_){ }
  if(!goldOnly)return;

  document.documentElement.dataset.renkoDownloadedOnly='gold';
  document.documentElement.classList.add('gold-clean-only');

  const style=document.createElement('style');
  style.id='renko-gold-clean-only-style';
  style.textContent=`
    html.gold-clean-only,html.gold-clean-only body{width:100%;min-height:100%;overflow-x:hidden}
    html.gold-clean-only .workspace{display:block!important;width:100%!important;max-width:none!important}
    html.gold-clean-only .terminal{width:100%!important;max-width:none!important;min-width:0!important}
    html.gold-clean-only .markets,
    html.gold-clean-only #openPairs,
    html.gold-clean-only .easybar,
    html.gold-clean-only .source-card,
    html.gold-clean-only .instrument-bar .stats,
    html.gold-clean-only .auditbar,
    html.gold-clean-only .attribution,
    html.gold-clean-only .methodology,
    html.gold-clean-only .chart-toolbar .pill,
    html.gold-clean-only #tvCoverage,
    html.gold-clean-only .topbar .nav{display:none!important}
    html.gold-clean-only .instrument-bar{display:block!important;padding:8px 14px!important;min-height:0!important}
    html.gold-clean-only .instrument{width:100%!important;max-width:none!important}
    html.gold-clean-only .instrument .pair-title{gap:8px!important}
    html.gold-clean-only .control-deck{display:block!important;padding:6px 10px!important;margin:0!important}
    html.gold-clean-only .method-card{display:block!important;width:100%!important;max-width:none!important;margin:0!important;padding:8px 10px!important}
    html.gold-clean-only .method-card .source-head{margin-bottom:6px!important}
    html.gold-clean-only .method-grid{grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:8px!important}
    html.gold-clean-only .method[data-method="percentage"]{display:none!important}
    html.gold-clean-only .summary{display:none!important}
    html.gold-clean-only .chart-toolbar{padding:4px 10px!important;min-height:28px!important}
    html.gold-clean-only .chart-wrap{height:calc(100vh - 224px)!important;min-height:620px!important;margin:0!important;border-radius:0!important}
    html.gold-clean-only .chart-host{width:100%!important;height:100%!important}
    html.gold-clean-only .chart-nav{right:10px!important;bottom:10px!important;display:flex!important;gap:4px!important}
    html.gold-clean-only .chart-nav #tvGoldOrigin,
    html.gold-clean-only .chart-nav #tvGoldMaxZoom{min-width:48px!important;font-weight:800!important}
    @media(max-width:900px){
      html.gold-clean-only .method-grid{grid-template-columns:1fr 1fr!important}
      html.gold-clean-only .chart-wrap{height:calc(100vh - 240px)!important;min-height:520px!important}
    }
  `;
  document.head.appendChild(style);

  const nativeFetch=window.fetch.bind(window);
  const isUndownloadedMarketUrl=input=>{
    let u='';
    try{u=typeof input==='string'?input:(input?.url||String(input||''))}catch(_){ }
    return /(^|\/\/)(?:data-api\.binance\.vision|api\.binance\.com)(?:\/|$)/i.test(u);
  };
  window.fetch=(input,init)=>isUndownloadedMarketUrl(input)
    ? Promise.reject(new Error('GOLD downloaded-only mode: non-downloaded market source blocked'))
    : nativeFetch(input,init);

  const forceText=(id,value)=>{const el=document.getElementById(id);if(el&&el.textContent!==value)el.textContent=value};
  const lockGoldUi=()=>{
    const markets=document.querySelector('.markets');if(markets)markets.hidden=true;
    const openPairs=document.getElementById('openPairs');if(openPairs)openPairs.hidden=true;
    document.querySelectorAll('[data-quick]').forEach(el=>{el.hidden=true});
    const list=document.getElementById('pairList');if(list&&list.childNodes.length)list.replaceChildren();
    const search=document.getElementById('pairSearch');if(search){search.disabled=true;if(search.value!=='GOLD / XAUUSD')search.value='GOLD / XAUUSD'}
    forceText('pairTotal','1 downloaded');
    forceText('pairShown','Downloaded only');
    forceText('universeNote','GOLD · XAU/USD · Dukascopy fixed 1s');
    forceText('pairName','XAU / USD');
    forceText('pairIcon','AU');
    const pairTag=document.querySelector('.pair-title span');if(pairTag&&pairTag.textContent!=='GOLD')pairTag.textContent='GOLD';
    const easy=document.querySelector('.easy-label');if(easy&&easy.textContent!=='GOLD')easy.textContent='GOLD';
    const source=document.getElementById('sourceText');const sourceLabel='Dukascopy XAU/USD · downloaded canonical fixed 1-second source only.';if(source&&source.textContent!==sourceLabel)source.textContent=sourceLabel;
    const feed=document.getElementById('feedPill');if(feed){feed.classList.add('live');const b=feed.querySelector('b');if(b&&b.textContent!=='HISTORY')b.textContent='HISTORY'}
    const T=window.RWARenkoTV,count=Number(T?.state?.closedBars?.length||0);
    if(T?.state?.symbol==='XAUUSD'&&count){
      const method=T.settings?.method==='traditional'?'TRADITIONAL':T.settings?.method==='atr'?'ATR':'RENKO';
      const suffix=method==='ATR'?` ${Math.max(1,Math.floor(Number(T.settings?.atrLength)||14))}`:method==='TRADITIONAL'?` ${Number(T.state?.box)||Number(T.settings?.boxSize)||''}`:'';
      const scope=T.state?.historyViewMode==='gold-origin'?'GOLD ORIGIN':T.state?.historyViewMode==='gold-total'?'GOLD TOTAL':'GOLD';
      const load=document.getElementById('tvLoadState');if(load){load.textContent=`${scope} · Dukascopy fixed 1s · ${method}${suffix} · ${count.toLocaleString()} source bars`;load.classList.add('live')}
    }
  };

  // User viewport ownership. Once the operator zooms/pans, no rebuild is allowed
  // to auto-fit or snap back to the latest frame until an explicit latest/reset.
  let viewportLocked=false,lastLogicalRange=null,rebuildWrapped=false,interactionAt=0,viewportSeq=0;
  const tv=()=>window.RWARenkoTV||null;
  const ts=()=>window.__RWARenkoChart?.timeScale?.()||null;
  const finiteRange=r=>r&&Number.isFinite(Number(r.from))&&Number.isFinite(Number(r.to));
  const readRange=()=>{try{return ts()?.getVisibleLogicalRange?.()||null}catch(_){return null}};
  const setFollowingOff=()=>{const T=tv();if(T?.state)T.state.following=false};
  function rememberRange(token=viewportSeq){
    if(token!==viewportSeq)return lastLogicalRange;
    const r=readRange();if(finiteRange(r))lastLogicalRange={from:Number(r.from),to:Number(r.to)};
    document.documentElement.dataset.renkoGoldViewportLocked=viewportLocked?'true':'false';
    if(lastLogicalRange)document.documentElement.dataset.renkoGoldViewportRange=`${lastLogicalRange.from.toFixed(4)}:${lastLogicalRange.to.toFixed(4)}`;
    return lastLogicalRange;
  }
  function restoreRange(range=lastLogicalRange,token=viewportSeq){
    if(token!==viewportSeq||!finiteRange(range))return false;
    requestAnimationFrame(()=>requestAnimationFrame(()=>{
      if(token!==viewportSeq)return;
      try{const t=ts();if(!t)return;t.setVisibleLogicalRange({from:Number(range.from),to:Number(range.to)});setFollowingOff();lastLogicalRange={from:Number(range.from),to:Number(range.to)}}catch(_){ }
    }));
    return true;
  }
  function lockViewport(reason='user'){
    const token=++viewportSeq;viewportLocked=true;interactionAt=performance.now();setFollowingOff();
    document.documentElement.dataset.renkoGoldViewportReason=String(reason);
    document.documentElement.dataset.renkoGoldViewportLocked='true';
    requestAnimationFrame(()=>requestAnimationFrame(()=>rememberRange(token)));
  }
  function unlockViewport(reason='latest'){
    viewportSeq++;viewportLocked=false;lastLogicalRange=null;
    document.documentElement.dataset.renkoGoldViewportReason=String(reason);
    document.documentElement.dataset.renkoGoldViewportLocked='false';
  }
  function installRebuildGuard(){
    const T=tv();if(!T?.rebuild||rebuildWrapped)return false;
    const original=T.rebuild.bind(T);
    T.rebuild=(opts={})=>{
      const token=viewportSeq,range=readRange()||lastLogicalRange,preserve=viewportLocked&&finiteRange(range);
      if(viewportLocked)setFollowingOff();
      const out=original({...opts,fit:preserve?false:!!opts?.fit});
      const totalBusy=!!window.RWARenkoGoldTotalHistory?.busy;
      if(preserve&&!totalBusy)restoreRange(range,token);
      if(viewportLocked)setFollowingOff();
      return out;
    };
    rebuildWrapped=true;
    document.documentElement.dataset.renkoGoldRebuildGuard='true';
    return true;
  }
  function maxZoomOut(){
    const T=tv(),t=ts();if(!T||!t)return null;
    const token=++viewportSeq,n=Math.max(1,Number(T.state?.confirmedData?.length||0)+Number(T.state?.projectionData?.length||0));
    viewportLocked=true;setFollowingOff();
    try{t.applyOptions?.({minBarSpacing:0.01,rightOffset:0});}catch(_){ }
    const range={from:-2,to:n+2};
    try{t.setVisibleLogicalRange(range)}catch(_){return null}
    lastLogicalRange=range;
    document.documentElement.dataset.renkoGoldMaxZoom='true';
    document.documentElement.dataset.renkoGoldMaxZoomBars=String(n);
    document.documentElement.dataset.renkoGoldViewportLocked='true';
    requestAnimationFrame(()=>requestAnimationFrame(()=>rememberRange(token)));
    return range;
  }
  async function jumpToOrigin(){
    const T=tv(),H=window.RWARenkoGoldTotalHistory;if(!T?.state||!H?.loadManifest||!H?.decodeMonth)throw new Error('GOLD total-history runtime unavailable');
    const m=await H.loadManifest();const meta=m.months?.[0];if(!meta)throw new Error('GOLD origin month unavailable');
    const c=await H.decodeMonth(meta),limit=Math.min(140000,c.sec.length),tick=Number(meta.tickSize)||Number(m.tickSize)||0.001;
    if(!limit||Number(c.sec[0])!==Number(meta.earliestSecond))throw new Error('GOLD origin witness mismatch');
    const bars=new Array(limit);
    for(let i=0;i<limit;i++){const s=Number(c.sec[i]);bars[i]={openTime:s*1000,closeTime:s*1000+999,open:Number(c.open[i])*tick,high:Number(c.high[i])*tick,low:Number(c.low[i])*tick,close:Number(c.close[i])*tick,volume:0}}
    unlockViewport('origin-load');
    T.state.generation++;T.state.symbol='XAUUSD';T.state.pendingSymbol='';T.state.currentBar=null;T.state.closedBars=bars;T.state.tickSize=tick;T.state.lastPrice=Number(bars.at(-1).close);T.state.historyPages=Math.max(1,Number(T.state.historyPages)||1);T.state.historyViewMode='gold-origin';T.state.status='history-gold-origin';T.state.following=false;
    T.state.historyMeta={...(T.state.historyMeta||{}),symbol:'XAUUSD',instrumentCode:'XAU-USD',provider:'Dukascopy',source:'immutable Git LFS canonical monthly gzip',interval:'1s',dataVersion:m.dataVersion,priceSide:m.priceSide,tickSize:tick,loadedOldestMs:Number(bars[0].openTime),loadedNewestMs:Number(bars.at(-1).closeTime),totalSourceChunks:m.months.length,chunkUnit:'calendar-month',backfillComplete:!!m.backfillComplete,cachePersisted:true,losses:0};
    T.rebuild({fit:false});T.state.status='history-gold-origin';T.state.following=false;
    lockGoldUi();
    Object.assign(document.documentElement.dataset,{renkoGoldOriginView:'true',renkoGoldOriginSecond:String(c.sec[0]),renkoGoldOriginBars:String(bars.length),renkoGoldCoverageLatest:String(m.months.at(-1)?.latestSecond||'')});
    maxZoomOut();
    try{window.dispatchEvent(new CustomEvent('renko:gold-origin',{detail:{originSecond:Number(c.sec[0]),loadedBars:bars.length,dataVersion:m.dataVersion,months:m.months.length,latestSecond:Number(m.months.at(-1)?.latestSecond||0)}}))}catch(_){ }
    return{originSecond:Number(c.sec[0]),loadedBars:bars.length,months:m.months.length,latestSecond:Number(m.months.at(-1)?.latestSecond||0),dataVersion:m.dataVersion};
  }
  async function returnLatest(){
    unlockViewport('latest');
    const R=window.RWARenkoGoldRecentHistory;if(!R?.newest)throw new Error('GOLD recent runtime unavailable');
    const ok=await R.newest();
    requestAnimationFrame(()=>{try{document.getElementById('tvLive')?.click()}catch(_){ }});
    return ok;
  }
  function ensureHistoryButtons(){
    const nav=document.querySelector('.chart-nav');if(!nav)return;
    if(!document.getElementById('tvGoldOrigin')){const b=document.createElement('button');b.id='tvGoldOrigin';b.textContent='23Y←';b.title='Jump directly to the earliest downloaded GOLD history (2003)';b.addEventListener('click',()=>void jumpToOrigin());nav.insertBefore(b,nav.firstChild)}
    if(!document.getElementById('tvGoldMaxZoom')){const b=document.createElement('button');b.id='tvGoldMaxZoom';b.textContent='MAX';b.title='Maximum zoom-out without snap-back';b.addEventListener('click',()=>{lockViewport('max-button');maxZoomOut()});nav.insertBefore(b,document.getElementById('tvGoldOrigin')?.nextSibling||nav.firstChild)}
  }
  function installViewportInteractions(){
    const mark=e=>{if(e.target?.closest?.('#chartWrap,#chartHost'))lockViewport(e.type)};
    document.addEventListener('wheel',mark,{capture:true,passive:true});
    document.addEventListener('pointerdown',mark,{capture:true,passive:true});
    document.addEventListener('touchstart',mark,{capture:true,passive:true});
    document.addEventListener('click',e=>{const id=e.target?.closest?.('button')?.id;if(['tvZoomIn','tvZoomOut','tvPanOlder','tvPanNewer','tvGoldOlder','tvGoldNewer'].includes(id)){lockViewport(id);requestAnimationFrame(()=>requestAnimationFrame(()=>rememberRange(viewportSeq)))}if(id==='tvLive'||id==='tvReset')unlockViewport(id)},true);
  }

  lockGoldUi();installViewportInteractions();
  const list=document.getElementById('pairList');
  if(list){
    const listObserver=new MutationObserver(()=>{if(list.childNodes.length)list.replaceChildren()});
    listObserver.observe(list,{childList:true});
  }
  const ready=()=>{lockGoldUi();installRebuildGuard();ensureHistoryButtons()};
  window.addEventListener('renko:chart-ready',ready);
  window.addEventListener('renko:tv-ready',ready);
  window.addEventListener('renko:gold-recent',()=>{ready();if(!viewportLocked)document.documentElement.dataset.renkoGoldOriginView='false'});
  window.addEventListener('renko:gold-total',()=>{ready();if(viewportLocked)setFollowingOff()});
  window.addEventListener('renko:gold-origin',ready);
  window.addEventListener('renko:atr-control-applied',()=>setTimeout(lockGoldUi,0));
  window.addEventListener('renko:traditional-applied',()=>setTimeout(lockGoldUi,0));
  window.addEventListener('resize',()=>{try{window.__RWARenkoChart?.applyOptions?.({width:document.getElementById('chartHost')?.clientWidth||0,height:document.getElementById('chartHost')?.clientHeight||0})}catch(_){ }});
  const poll=setInterval(()=>{ready();if(window.RWARenkoGoldTotalHistory){ensureHistoryButtons();clearInterval(poll)}},250);
  setTimeout(()=>clearInterval(poll),15000);
  window.RWARenkoGoldViewport={version:'2.1.0-23y-authoritative-max',rule:'user-owned-logical-range-tokenized-no-stale-restore-plus-direct-canonical-origin-jump',get locked(){return viewportLocked},get lastRange(){return lastLogicalRange},get interactionAt(){return interactionAt},get sequence(){return viewportSeq},lockViewport,unlockViewport,rememberRange,restoreRange,maxZoomOut,jumpToOrigin,returnLatest,installRebuildGuard,ensureHistoryButtons};
})();
