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

  // GOLD downloaded-only mode. The public GOLD link must never preload or expose
  // market symbols whose fixed-1s source packs are not already materialized.
  let goldOnly=false;
  try{goldOnly=new URLSearchParams(location.search).get('gold')==='1'}catch(_){ }
  if(!goldOnly)return;

  document.documentElement.dataset.renkoDownloadedOnly='gold';
  const nativeFetch=window.fetch.bind(window);
  const isUndownloadedMarketUrl=input=>{
    let u='';
    try{u=typeof input==='string'?input:(input?.url||String(input||''))}catch(_){ }
    return /(^|\/\/)(?:data-api\.binance\.vision|api\.binance\.com)(?:\/|$)/i.test(u);
  };
  window.fetch=(input,init)=>isUndownloadedMarketUrl(input)
    ? Promise.reject(new Error('GOLD downloaded-only mode: non-downloaded market source blocked'))
    : nativeFetch(input,init);

  const lockGoldUi=()=>{
    const markets=document.querySelector('.markets');if(markets)markets.hidden=true;
    const openPairs=document.getElementById('openPairs');if(openPairs)openPairs.hidden=true;
    document.querySelectorAll('[data-quick]').forEach(el=>{el.hidden=true});
    const list=document.getElementById('pairList');if(list)list.replaceChildren();
    const search=document.getElementById('pairSearch');if(search){search.disabled=true;search.value='GOLD / XAUUSD'}
    const total=document.getElementById('pairTotal');if(total)total.textContent='1 downloaded';
    const shown=document.getElementById('pairShown');if(shown)shown.textContent='Downloaded only';
    const note=document.getElementById('universeNote');if(note)note.textContent='GOLD · XAU/USD · Dukascopy fixed 1s';
    const easy=document.querySelector('.easy-label');if(easy)easy.textContent='DOWNLOADED';
  };
  lockGoldUi();
  const list=document.getElementById('pairList');
  if(list){
    const observer=new MutationObserver(()=>{if(list.childNodes.length)list.replaceChildren()});
    observer.observe(list,{childList:true});
  }
  window.addEventListener('renko:tv-ready',lockGoldUi);
  window.addEventListener('renko:gold-recent',lockGoldUi);
})();
