(()=>{
'use strict';
if(window.RWAEcommerceParityFinishV2)return;
const VERSION='2.0.0',STYLE_ID='rwaEcommerceParityFinishV2Style';
let depthKey='',depthAt=0,depthSeq=0;
const $=s=>document.querySelector(s);
function open(){return document.body?.classList.contains('rwa-seablueprint-commerce-open')||location.hash==='#shop'}
function installStyle(){if(document.getElementById(STYLE_ID))return;const s=document.createElement('style');s.id=STYLE_ID;s.textContent=`
@media(min-width:681px){
  html:has(body.rwa-target-dashboard-v2.rwa-seablueprint-commerce-open),
  html:has(body.rwa-target-dashboard-v2.rwa-seablueprint-commerce-open) body{overflow:hidden!important}
  html body.rwa-target-dashboard-v2.rwa-seablueprint-commerce-open .layout{box-sizing:border-box!important;width:100vw!important;max-width:100vw!important;min-width:0!important;margin:0!important;padding:0!important;height:calc(100vh - 122px)!important;min-height:calc(100vh - 122px)!important;max-height:calc(100vh - 122px)!important;overflow:hidden!important;align-items:stretch!important}
  html body.rwa-target-dashboard-v2.rwa-seablueprint-commerce-open .layout>.left,
  html body.rwa-target-dashboard-v2.rwa-seablueprint-commerce-open .layout>.right{top:62px!important;height:calc(100vh - 122px)!important;min-height:0!important;max-height:calc(100vh - 122px)!important;overflow:auto!important}
  html body.rwa-target-dashboard-v2.rwa-seablueprint-commerce-open .layout>.main{height:calc(100vh - 122px)!important;min-height:0!important;max-height:calc(100vh - 122px)!important;overflow:hidden!important}
  html body.rwa-target-dashboard-v2.rwa-seablueprint-commerce-open #rwaCommerceDock{top:62px!important;bottom:60px!important;height:auto!important}
  html body.rwa-target-dashboard-v2.rwa-seablueprint-commerce-open .right .order-section{min-height:0!important;height:auto!important;padding-bottom:12px!important}
  html body.rwa-target-dashboard-v2.rwa-seablueprint-commerce-open .right-title{display:flex!important;visibility:visible!important;opacity:1!important}
  html body.rwa-target-dashboard-v2.rwa-seablueprint-commerce-open .book-head,
  html body.rwa-target-dashboard-v2.rwa-seablueprint-commerce-open .bookrow{grid-template-columns:1fr .72fr .82fr!important}
  html body.rwa-target-dashboard-v2.rwa-seablueprint-commerce-open .rwa-ecom-art{background-size:cover!important;background-position:center!important;background-repeat:no-repeat!important;filter:none!important}
}
@media(min-width:1600px){
  html body.rwa-target-dashboard-v2.rwa-seablueprint-commerce-open .layout{grid-template-columns:291px minmax(0,calc(100vw - 990px)) 239px!important}
  html body.rwa-target-dashboard-v2.rwa-seablueprint-commerce-open .layout>.left{width:291px!important;min-width:291px!important;max-width:291px!important}
  html body.rwa-target-dashboard-v2.rwa-seablueprint-commerce-open .layout>.right{width:239px!important;min-width:239px!important;max-width:239px!important}
  html body.rwa-target-dashboard-v2.rwa-seablueprint-commerce-open #rwaCommerceDock{width:460px!important;min-width:460px!important;max-width:460px!important}
}
@media(max-width:1599px) and (min-width:1401px){
  html body.rwa-target-dashboard-v2.rwa-seablueprint-commerce-open .layout{grid-template-columns:286px minmax(0,calc(100vw - 962px)) 236px!important}
  html body.rwa-target-dashboard-v2.rwa-seablueprint-commerce-open #rwaCommerceDock{width:440px!important;min-width:440px!important;max-width:440px!important}
}
@media(max-width:1400px) and (min-width:681px){
  html body.rwa-target-dashboard-v2.rwa-seablueprint-commerce-open .layout{grid-template-columns:260px minmax(0,calc(100vw - 920px)) 220px!important}
  html body.rwa-target-dashboard-v2.rwa-seablueprint-commerce-open #rwaCommerceDock{width:440px!important;min-width:440px!important;max-width:440px!important}
}
`;
document.head.appendChild(s)}
function symbol(){const raw=($('#selName')?.textContent||'BTC / USDT').toUpperCase();const m=raw.match(/([A-Z0-9]+)\s*\/\s*([A-Z0-9]+)/);return m?m[1]+m[2]:'BTCUSDT'}
function fmtPrice(v){const n=Number(v);if(!Number.isFinite(n))return'—';return n.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}
function fmtQty(v){const n=Number(v);if(!Number.isFinite(n))return'—';return n.toLocaleString('en-US',{minimumFractionDigits:4,maximumFractionDigits:4})}
function rows(arr,side){let cum=0;return arr.map(([p,q])=>{cum+=Number(q)||0;return `<div class="bookrow"><span class="${side}">${fmtPrice(p)}</span><span>${fmtQty(q)}</span><span>${fmtQty(cum)}</span></div>`}).join('')}
async function hydrateDepth(){if(!open()||innerWidth<=680)return false;const asks=$('#asks'),bids=$('#bids');if(!asks||!bids)return false;if(asks.querySelectorAll('.bookrow').length>=5&&bids.querySelectorAll('.bookrow').length>=5)return true;const key=symbol(),now=Date.now();if(depthKey===key&&now-depthAt<1400)return false;depthKey=key;depthAt=now;const seq=++depthSeq;try{const r=await fetch(`https://data-api.binance.vision/api/v3/depth?symbol=${encodeURIComponent(key)}&limit=10`,{cache:'no-store'});if(!r.ok)throw Error(`depth ${r.status}`);const d=await r.json();if(seq!==depthSeq||symbol()!==key)return false;const aa=(Array.isArray(d.asks)?d.asks:[]).slice(0,5).reverse(),bb=(Array.isArray(d.bids)?d.bids:[]).slice(0,5);if(!aa.length||!bb.length)return false;asks.innerHTML=rows(aa,'down');bids.innerHTML=rows(bb,'up');const bestAsk=Number(d.asks?.[0]?.[0]),bestBid=Number(d.bids?.[0]?.[0]),mid=$('#midPrice');if(mid&&Number.isFinite(bestAsk)&&Number.isFinite(bestBid))mid.textContent=fmtPrice((bestAsk+bestBid)/2);return true}catch(e){console.warn('RWA depth snapshot delayed',e?.message||e);return false}}
function sync(){installStyle();void hydrateDepth()}
function audit(){const root=document.documentElement,layout=$('.layout')?.getBoundingClientRect(),left=$('.layout>.left')?.getBoundingClientRect(),main=$('.layout>.main')?.getBoundingClientRect(),order=$('.layout>.right')?.getBoundingClientRect(),dock=$('#rwaCommerceDock')?.getBoundingClientRect();return{version:VERSION,open:open(),viewportWidth:innerWidth,clientWidth:root.clientWidth,horizontalScrollbarPx:Math.max(0,innerWidth-root.clientWidth),layout:layout?{left:Math.round(layout.left),right:Math.round(layout.right),width:Math.round(layout.width),height:Math.round(layout.height)}:null,leftWidth:Math.round(left?.width||0),mainWidth:Math.round(main?.width||0),orderWidth:Math.round(order?.width||0),dockWidth:Math.round(dock?.width||0),dockLeft:Math.round(dock?.left||0),askRows:document.querySelectorAll('#asks .bookrow').length,bidRows:document.querySelectorAll('#bids .bookrow').length}}
installStyle();sync();new MutationObserver(()=>queueMicrotask(sync)).observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['class']});addEventListener('resize',sync,{passive:true});addEventListener('hashchange',sync);setInterval(sync,1200);window.RWAEcommerceParityFinishV2={version:VERSION,apply:sync,audit,hydrateDepth};
})();
