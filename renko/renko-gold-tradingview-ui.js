(()=>{
'use strict';
if(!window.RENKO_GOLD_ONLY||window.RWARenkoGoldTradingViewUI)return;
const root=document.documentElement;
const hideNonGold=()=>{
  root.classList.add('gold-clean-only','tv-gold-shell');
  root.dataset.renkoDownloadedOnly='gold';
  document.querySelectorAll('.markets,#openPairs,.easybar,.source-card,.instrument-bar .stats,.auditbar,.attribution,.methodology,.summary,.method[data-method="percentage"],.chart-toolbar .pill,#tvCoverage,.topbar .nav').forEach(el=>{el.hidden=true;el.setAttribute('aria-hidden','true')});
  const pair=document.getElementById('pairName');if(pair)pair.textContent='XAU / USD';
  const icon=document.getElementById('pairIcon');if(icon)icon.textContent='AU';
  const tag=document.querySelector('.pair-title span');if(tag)tag.textContent='GOLD';
  const source=document.getElementById('sourceText');if(source)source.textContent='Dukascopy XAU/USD · canonical downloaded fixed 1-second history';
  const feed=document.querySelector('#feedPill b');if(feed&&feed.textContent!=='HISTORY')feed.textContent='HISTORY';
  document.title='GOLD / XAUUSD — RENKO';
};
const skinChart=()=>{
  const chart=window.__RWARenkoChart;if(!chart?.applyOptions)return false;
  try{
    chart.applyOptions({
      layout:{background:{type:'solid',color:'#131722'},textColor:'#d1d4dc',fontSize:11,fontFamily:'-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif'},
      grid:{vertLines:{color:'#1f2430'},horzLines:{color:'#1f2430'}},
      rightPriceScale:{borderColor:'#2a2e39',scaleMargins:{top:.08,bottom:.08}},
      timeScale:{borderColor:'#2a2e39',timeVisible:true,secondsVisible:true,rightOffset:5,minBarSpacing:.01},
      crosshair:{vertLine:{color:'#758696',width:1,style:3,labelBackgroundColor:'#363a45'},horzLine:{color:'#758696',width:1,style:3,labelBackgroundColor:'#363a45'}}
    });
    root.dataset.renkoTradingViewSkin='true';
    return true;
  }catch(_){return false}
};
const canonicalize=()=>{
  try{
    const target='/rwa/renko';
    if(location.pathname!==target||location.search||location.hash)history.replaceState(null,'',target);
    root.dataset.renkoCanonicalUrl=location.pathname+location.search;
  }catch(_){ }
};
const sync=()=>{hideNonGold();skinChart()};
const observer=new MutationObserver(()=>hideNonGold());
const start=()=>{
  hideNonGold();skinChart();
  try{observer.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['hidden','class']})}catch(_){ }
  setTimeout(canonicalize,1200);
};
for(const ev of ['renko:chart-ready','renko:tv-ready','renko:gold-recent','renko:gold-total','renko:gold-origin','renko:atr-control-applied','renko:traditional-applied'])window.addEventListener(ev,sync);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
window.addEventListener('load',()=>{sync();setTimeout(canonicalize,50)},{once:true});
window.RWARenkoGoldTradingViewUI={version:'1.0.0-gold-only-tv-shell',sync,skinChart,canonicalize,hideNonGold};
})();
