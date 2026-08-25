(()=>{
'use strict';
window.RWALegacyCanonical={version:'5.0.0',canonical:'https://copytolive.github.io/rwa/'};
try{
  const u=new URL(location.href),p=u.pathname.replace(/\/+$/,'/'),base='/rwa/';
  // Embedded legacy engines are allowed only inside the canonical Super App workspace.
  // Never redirect an iframe carrying ?embed=1 or it would recurse back into /rwa/.
  if(u.searchParams.get('embed')==='1'){document.documentElement.dataset.rwaEmbedded='1';return;}
  if(p===base)return;
  let route='markets';
  if(p.startsWith(base+'trade/'))route='trade/'+(u.searchParams.get('coin')||'BTC').toUpperCase();
  else if(p.startsWith(base+'asset/'))route='asset/'+(u.searchParams.get('symbol')||'BTC').toUpperCase();
  else if(p.startsWith(base+'trader/'))route='trader/'+(u.searchParams.get('wallet')||'');
  else if(p.startsWith(base+'backtest/'))route='research/backtest/'+(u.searchParams.get('symbol')||'BTC').toUpperCase();
  else if(p.startsWith(base+'renko/'))route='research/renko/'+(u.searchParams.get('symbol')||'BTC').toUpperCase();
  else return;
  const target=new URL(base,location.origin);target.hash=route;location.replace(target.href);
}catch{}
})();
