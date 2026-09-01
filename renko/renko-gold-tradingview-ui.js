(()=>{
'use strict';
if(!window.RENKO_GOLD_ONLY||window.RWARenkoGoldHistoryGeometryStitch||document.getElementById('renkoGoldGeometryStitchScript'))return;
const s=document.createElement('script');s.id='renkoGoldGeometryStitchScript';s.src='renko-gold-history-geometry-stitch.js?v=1';s.async=false;document.head.appendChild(s);
})();

(()=>{
'use strict';
if(!window.RENKO_GOLD_ONLY||window.RWARenkoGoldTradingViewUI)return;
const root=document.documentElement;
const legacyLocks=new WeakMap();
const hideEl=el=>{if(!el)return;if(!el.hidden)el.hidden=true;if(el.getAttribute('aria-hidden')!=='true')el.setAttribute('aria-hidden','true')};
const hardHide=el=>{
  if(!el)return;
  if(!el.hidden)el.hidden=true;
  if(el.getAttribute('aria-hidden')!=='true')el.setAttribute('aria-hidden','true');
  if(el.style.getPropertyValue('display')!=='none'||el.style.getPropertyPriority('display')!=='important')el.style.setProperty('display','none','important');
  if(legacyLocks.has(el))return;
  const o=new MutationObserver(()=>{
    if(!el.isConnected)return;
    if(!el.hidden)el.hidden=true;
    if(el.getAttribute('aria-hidden')!=='true')el.setAttribute('aria-hidden','true');
    if(el.style.getPropertyValue('display')!=='none'||el.style.getPropertyPriority('display')!=='important')el.style.setProperty('display','none','important');
  });
  o.observe(el,{attributes:true,attributeFilter:['hidden','style','class','aria-hidden']});
  legacyLocks.set(el,o);
};
const setText=(el,text)=>{if(el&&el.textContent!==text)el.textContent=text};
let legacyObserver=null,legacyQueued=false;
function hideLegacyChartOverlays(){
  document.querySelectorAll('#tvGoldRecent,#tvGoldOlder,#tvGoldNewer,#tvOrigin').forEach(hardHide);
  const wrap=document.getElementById('chartWrap');
  if(!wrap)return;
  for(const input of wrap.querySelectorAll('input[type="range"]')){
    let box=input;
    while(box.parentElement&&box.parentElement!==wrap)box=box.parentElement;
    hardHide(input);
    if(box.parentElement===wrap)hardHide(box);
  }
}
function installLegacyObserver(){
  const wrap=document.getElementById('chartWrap');
  if(!wrap||legacyObserver)return false;
  legacyObserver=new MutationObserver(records=>{
    if(!records.some(r=>r.addedNodes&&r.addedNodes.length))return;
    if(legacyQueued)return;legacyQueued=true;
    queueMicrotask(()=>{legacyQueued=false;hideLegacyChartOverlays()});
  });
  legacyObserver.observe(wrap,{childList:true,subtree:true});
  root.dataset.renkoTradingViewLegacyObserver='true';
  return true;
}
const hideNonGold=()=>{
  root.classList.add('gold-clean-only','tv-gold-shell');
  root.dataset.renkoDownloadedOnly='gold';
  document.querySelectorAll('.markets,#openPairs,.easybar,.source-card,.instrument-bar .stats,.auditbar,.attribution,.methodology,.summary,.method[data-method="percentage"],.chart-toolbar .pill,#tvCoverage,.topbar .nav').forEach(hideEl);
  hideLegacyChartOverlays();installLegacyObserver();
  setText(document.getElementById('pairName'),'XAU / USD');
  setText(document.getElementById('pairIcon'),'AU');
  setText(document.querySelector('.pair-title span'),'GOLD');
  setText(document.getElementById('sourceText'),'Dukascopy XAU/USD · canonical downloaded fixed 1-second history');
  const feed=document.querySelector('#feedPill b');if(feed&&feed.textContent!=='HISTORY')feed.textContent='HISTORY';
  if(document.title!=='GOLD / XAUUSD — RENKO')document.title='GOLD / XAUUSD — RENKO';
};
const historyOwnsViewport=()=>!!window.RWARenkoGoldManualViewport?.inHistoryMutation||!!window.RWARenkoGoldViewportAuthority?.hold;
const skinChart=()=>{
  const chart=window.__RWARenkoChart;if(!chart?.applyOptions)return false;
  if(historyOwnsViewport()){root.dataset.renkoTradingViewSkinDeferred='true';return false}
  try{
    chart.applyOptions({
      layout:{background:{type:'solid',color:'#131722'},textColor:'#d1d4dc',fontSize:11,fontFamily:'-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif'},
      grid:{vertLines:{color:'#1f2430'},horzLines:{color:'#1f2430'}},
      rightPriceScale:{borderColor:'#2a2e39',scaleMargins:{top:.08,bottom:.08}},
      timeScale:{borderColor:'#2a2e39',timeVisible:true,secondsVisible:true,rightOffset:5,minBarSpacing:.01},
      crosshair:{vertLine:{color:'#758696',width:1,style:3,labelBackgroundColor:'#363a45'},horzLine:{color:'#758696',width:1,style:3,labelBackgroundColor:'#363a45'}}
    });
    root.dataset.renkoTradingViewSkin='true';root.dataset.renkoTradingViewSkinDeferred='false';
    return true;
  }catch(_){return false}
};
const canonicalize=()=>{try{const target='/rwa/renko';if(location.pathname!==target||location.search||location.hash)history.replaceState(null,'',target);root.dataset.renkoCanonicalUrl=location.pathname+location.search}catch(_){ }};
let syncQueued=false;
const sync=()=>{if(syncQueued)return;syncQueued=true;requestAnimationFrame(()=>{syncQueued=false;hideNonGold();skinChart()})};
const start=()=>{hideNonGold();skinChart();installLegacyObserver();requestAnimationFrame(hideLegacyChartOverlays);setTimeout(hideLegacyChartOverlays,250);setTimeout(hideLegacyChartOverlays,1000);setTimeout(canonicalize,100)};
for(const ev of ['renko:chart-ready','renko:tv-ready','renko:gold-recent','renko:gold-total','renko:gold-origin','renko:atr-control-applied','renko:traditional-applied'])window.addEventListener(ev,()=>{if(ev==='renko:gold-total'&&historyOwnsViewport()){hideNonGold();installLegacyObserver();root.dataset.renkoTradingViewSkinDeferred='true'}else sync();installLegacyObserver();if(ev==='renko:gold-recent')setTimeout(canonicalize,0)});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
window.addEventListener('load',()=>{sync();installLegacyObserver();setTimeout(hideLegacyChartOverlays,0);setTimeout(canonicalize,0)},{once:true});
window.RWARenkoGoldTradingViewUI={version:'1.5.0-history-viewport-safe-skin',sync,skinChart,canonicalize,hideNonGold,hideLegacyChartOverlays,installLegacyObserver,historyOwnsViewport};
})();
