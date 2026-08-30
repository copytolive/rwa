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
    html.gold-clean-only .chart-nav{right:10px!important;bottom:10px!important}
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
    const search=document.getElementById('pairSearch');if(search){search.disabled=true;search.value='GOLD / XAUUSD'}
    forceText('pairTotal','1 downloaded');
    forceText('pairShown','Downloaded only');
    forceText('universeNote','GOLD · XAU/USD · Dukascopy fixed 1s');
    forceText('pairName','XAU / USD');
    forceText('pairIcon','AU');
    const easy=document.querySelector('.easy-label');if(easy)easy.textContent='GOLD';
    const source=document.getElementById('sourceText');if(source)source.textContent='Dukascopy XAU/USD · downloaded fixed 1-second source only.';
  };

  lockGoldUi();
  const bodyObserver=new MutationObserver(lockGoldUi);
  if(document.body)bodyObserver.observe(document.body,{childList:true,subtree:true,characterData:true});
  window.addEventListener('renko:tv-ready',lockGoldUi);
  window.addEventListener('renko:gold-recent',lockGoldUi);
  window.addEventListener('resize',()=>{try{window.__RWARenkoChart?.applyOptions?.({width:document.getElementById('chartHost')?.clientWidth||0,height:document.getElementById('chartHost')?.clientHeight||0})}catch(_){ }});
})();
