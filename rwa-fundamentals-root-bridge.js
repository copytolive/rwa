(()=>{
'use strict';
if(window.__RWA_FUNDAMENTALS_ROOT_BRIDGE__)return;
window.__RWA_FUNDAMENTALS_ROOT_BRIDGE__=true;
const symbolFromCommand=()=>{const q=String(document.getElementById('rwaCommandInput')?.value||'').toUpperCase();const skip=new Set(['TRADE','BACKTEST','RENKO','ASSET','MARKET','OPEN','SHOW','COPY','PORTFOLIO','SOCIAL','HOME','INTELLIGENCE','RWA','LEADERBOARD','DEFAULT','TERMINAL']);return(q.match(/\b[A-Z0-9]{2,12}\b/g)||[]).find(x=>!skip.has(x))||String(document.getElementById('selName')?.textContent||'BTC').split(/[\s\/-]/)[0]||'BTC'};
function openIntegrated(symbol){const layer=document.getElementById('rwaCommandLayer');if(layer)layer.hidden=true;window.RWAFundamentals?.open?.(String(symbol||'').toUpperCase())}
document.addEventListener('click',e=>{
  const cmd=e.target.closest?.('.rwa-command-item');
  const tag=cmd?.lastElementChild?.textContent?.trim?.().toUpperCase();
  if(cmd&&tag==='ASSET'){
    e.preventDefault();e.stopImmediatePropagation();openIntegrated(symbolFromCommand());return;
  }
  const link=e.target.closest?.('a[href*="/asset/"],a[href^="asset/"],a[href^="./asset/"],a[href^="../asset/"]');
  if(link){
    e.preventDefault();e.stopImmediatePropagation();
    try{const u=new URL(link.href,location.href),s=u.searchParams.get('symbol')||u.searchParams.get('ticker')||'';openIntegrated(s||symbolFromCommand())}catch{openIntegrated(symbolFromCommand())}
  }
},true);
addEventListener('rwa:product-os-ready',()=>{
  if(window.RWAProductOS)window.RWAProductOS.openAsset=s=>openIntegrated(s);
});
})();
