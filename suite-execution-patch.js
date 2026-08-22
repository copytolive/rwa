(()=>{
'use strict';
const $=id=>document.getElementById(id);
const toastSafe=t=>typeof toast==='function'?toast(t):console.log(t);
const status=(text,kind='')=>{const e=$('tradeStatus');if(!e)return;e.textContent=text;e.className='suite-status'+(kind?' '+kind:'')};
const jget=(k,d)=>{try{return JSON.parse(localStorage.getItem(k))??d}catch{return d}};
function money(v){const n=Number(v);return Number.isFinite(n)?'$'+n.toLocaleString(undefined,{maximumFractionDigits:2}):'—'}
function injectGuard(){
  if($('copyStopPrice'))return;
  const form=document.querySelector('[data-suite-panel="trade"] .suite-form.two');
  if(!form)return;
  const d=document.createElement('div');d.className='suite-field';d.id='copyStopField';
  d.innerHTML='<label>STOP PRICE · REQUIRED FOR COPY SIGNAL</label><input id="copyStopPrice" type="number" step="any" placeholder="Only required when reviewing a copy signal">';
  form.appendChild(d);
}
function formatPx(v,szDecimals){
  const n=Number(v);if(!Number.isFinite(n)||n<=0)throw new Error('Invalid price');
  const sig=Number(n.toPrecision(5)),maxDec=Math.max(0,6-Number(szDecimals||0));
  const raw=String(sig),dec=(raw.split('.')[1]||'').length;
  return sig.toFixed(Math.min(maxDec,dec)).replace(/\.?0+$/,'');
}
function formatSz(v,szDecimals){
  const n=Number(v);if(!Number.isFinite(n)||n<=0)throw new Error('Invalid size');
  const out=n.toFixed(Number(szDecimals||0)).replace(/\.?0+$/,'');
  if(!Number(out))throw new Error('Size rounds to zero for this market');
  return out;
}
function activeCopy(){
  const id=sessionStorage.getItem('rwa_active_copy_signal');
  if(!id)return null;
  return jget('rwa_copy_queue_v1',[]).find(x=>String(x.id)===String(id))||null;
}
function riskCheck(price,size){
  const maxNotional=Number($('tradeMaxNotional')?.value||1000),notional=Number(price)*Number(size);
  if(!Number.isFinite(maxNotional)||maxNotional<=0)throw new Error('Invalid max notional');
  if(notional>maxNotional)throw new Error(`Order notional ${money(notional)} exceeds max ${money(maxNotional)}`);
  const copy=activeCopy();
  if(copy){
    const cfg=jget('rwa_copy_v1',{}),stop=Number($('copyStopPrice')?.value),maxLoss=Number(cfg.maxLoss||0),copyMax=Number(cfg.maxNotional||0);
    if(copyMax>0&&notional>copyMax)throw new Error(`Copy notional ${money(notional)} exceeds copy cap ${money(copyMax)}`);
    if(maxLoss>0){
      if(!Number.isFinite(stop)||stop<=0)throw new Error('Stop price is required for a copy signal');
      const estimated=Math.abs(Number(price)-stop)*Number(size);
      if(estimated>maxLoss)throw new Error(`Estimated stop loss ${money(estimated)} exceeds copy max loss ${money(maxLoss)}`);
    }
  }
  return{notional};
}
async function submit(){
  const coin=($('tradeCoin')?.value||'').trim().toUpperCase(),side=($('tradeSide')?.value||'BUY').toUpperCase();
  const px=Number($('tradePrice')?.value),sz=Number($('tradeSize')?.value),testnet=!!$('tradeTestnet')?.checked;
  if(!coin||!Number.isFinite(px)||px<=0||!Number.isFinite(sz)||sz<=0)throw new Error('Enter valid coin, price and size');
  if(!testnet&&!$('tradeMainnetConfirm')?.checked)throw new Error('Mainnet confirmation is required');
  riskCheck(px,sz);
  if(!window.ethereum)throw new Error('Connect an EVM wallet first');
  const [{ExchangeClient,HttpTransport,InfoClient},{createWalletClient,custom},{arbitrum}]=await Promise.all([
    import('https://esm.sh/jsr/@nktkas/hyperliquid'),
    import('https://esm.sh/viem@2.37.3'),
    import('https://esm.sh/viem@2.37.3/chains')
  ]);
  const accounts=await window.ethereum.request({method:'eth_requestAccounts'}),account=accounts?.[0];
  if(!account)throw new Error('Wallet connection cancelled');
  const wallet=createWalletClient({account,chain:arbitrum,transport:custom(window.ethereum)});
  const transport=new HttpTransport({isTestnet:testnet,timeout:30000});
  const info=new InfoClient({transport}),meta=await info.meta();
  const idx=(meta.universe||[]).findIndex(x=>x.name===coin);if(idx<0)throw new Error(`${coin} is not listed in Hyperliquid perps`);
  const u=meta.universe[idx],price=formatPx(px,u.szDecimals),size=formatSz(sz,u.szDecimals);
  const exchange=new ExchangeClient({transport,wallet});
  status('Awaiting wallet signature…','warn');
  const result=await exchange.order({orders:[{a:idx,b:side==='BUY',p:price,s:size,r:!!$('tradeReduceOnly')?.checked,t:{limit:{tif:'Gtc'}}}],grouping:'na'});
  status('Order submitted','ok');
  if($('tradeResult'))$('tradeResult').textContent=JSON.stringify(result,null,2);
  sessionStorage.removeItem('rwa_active_copy_signal');
  toastSafe(`${testnet?'Testnet':'Mainnet'} limit order submitted`);
}
injectGuard();
document.addEventListener('click',e=>{
  const load=e.target.closest('[data-load-copy]');
  if(load){
    sessionStorage.setItem('rwa_active_copy_signal',load.dataset.loadCopy);
    setTimeout(()=>{
      injectGuard();
      const cfg=jget('rwa_copy_v1',{});
      if(Number(cfg.maxNotional)>0&&$('tradeMaxNotional'))$('tradeMaxNotional').value=String(cfg.maxNotional);
      $('copyStopPrice')?.focus();
      toastSafe('Copy signal loaded. Set a stop price to enforce max loss before signing.');
    },0);
    return;
  }
  const manual=e.target.closest('[data-suite-tab="trade"]');
  if(manual)sessionStorage.removeItem('rwa_active_copy_signal');
},false);
document.addEventListener('click',async e=>{
  if(!e.target.closest('#executeTrade'))return;
  e.preventDefault();e.stopImmediatePropagation();
  try{await submit()}catch(err){status('Order blocked','bad');if($('tradeResult'))$('tradeResult').textContent=String(err?.message||err);toastSafe(err?.message||'Order blocked')}
},true);
})();