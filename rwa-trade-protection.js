(()=>{
'use strict';
if(window.RWATradeProtection?.version==='1.0.0')return;
const VERSION='1.0.0';
const POLICY={
  minSlippage:0.0005,
  defaultSlippage:0.005,
  stableSlippage:0.005,
  longTailSlippage:0.01,
  maxSlippage:0.05,
  warnImpact:0.01,
  explicitAckImpact:0.03,
  hardBlockImpact:0.10,
  maxQuoteAgeMs:55000
};
const stables=new Set(['USDC','USDT','DAI','USDE','FDUSD','USDS','PYUSD','USDC.E']);
const majors=new Set(['ETH','WETH','BTC','WBTC','SOL','WSOL','BNB','WBNB','AVAX','WAVAX','POL','MATIC','HYPE','MON']);
const num=v=>Number.isFinite(Number(v))?Number(v):0;
const sym=t=>String(t?.symbol||t?.coinKey||'').toUpperCase();
const clamp=(v,a,b)=>Math.min(b,Math.max(a,Number(v)||0));
function chooseSlippage({fromToken,toToken,slippage}={}){if(slippage!=null)return clamp(slippage,POLICY.minSlippage,POLICY.maxSlippage);const a=sym(fromToken),b=sym(toToken);if(stables.has(a)&&stables.has(b))return POLICY.stableSlippage;if(majors.has(a)&&majors.has(b))return POLICY.defaultSlippage;return POLICY.longTailSlippage}
function ratioImpact(q){const e=q?.estimate||{};const direct=num(e.priceImpact);if(direct>0&&direct<1)return{value:direct,source:'provider-priceImpact'};const fromUSD=num(e.fromAmountUSD),toUSD=num(e.toAmountUSD);if(fromUSD>0&&toUSD>=0)return{value:Math.max(0,(fromUSD-toUSD)/fromUSD),source:'usd-value-delta'};const a=q?.action||{},ft=a.fromToken||{},tt=a.toToken||{};const fromAmount=num(a.fromAmount)/(10**Number(ft.decimals||0)),toAmount=num(e.toAmount)/(10**Number(tt.decimals||0)),fp=num(ft.priceUSD),tp=num(tt.priceUSD);if(fromAmount>0&&fp>0&&toAmount>=0&&tp>0){const x=fromAmount*fp,y=toAmount*tp;return{value:Math.max(0,(x-y)/x),source:'token-price-delta'}}return{value:null,source:'unavailable'}}
function slippageFromQuote(q){const e=q?.estimate||{},tt=q?.action?.toToken||{};const d=Number(tt.decimals||0),expected=num(e.toAmount)/(10**d),minimum=num(e.toAmountMin)/(10**d);if(expected<=0||minimum<=0)return null;return Math.max(0,(expected-minimum)/expected)}
function minimumReceived(q){const e=q?.estimate||{},tt=q?.action?.toToken||{},d=Number(tt.decimals||0);return{amount:num(e.toAmountMin)/(10**d),symbol:sym(tt)}}
function assess(q,{now=Date.now()}={}){if(!q?.estimate||!q?.action)return{ok:false,hardBlocked:true,level:'BLOCK',reasons:['Incomplete route quote'],warnings:[]};const impact=ratioImpact(q),slippage=slippageFromQuote(q),min=minimumReceived(q),created=Number(q?.__rwa?.createdAt||now),ageMs=Math.max(0,now-created),warnings=[],reasons=[];if(!(min.amount>0))reasons.push('Minimum received is zero or unavailable');if(ageMs>POLICY.maxQuoteAgeMs)reasons.push('Quote expired; request a fresh route');if(slippage!=null&&slippage>POLICY.maxSlippage+1e-9)reasons.push('Quoted slippage exceeds hard maximum');if(impact.value!=null&&impact.value>=POLICY.hardBlockImpact)reasons.push(`Economic/price impact ${(impact.value*100).toFixed(2)}% exceeds hard limit ${(POLICY.hardBlockImpact*100).toFixed(0)}%`);if(impact.value!=null&&impact.value>=POLICY.explicitAckImpact&&impact.value<POLICY.hardBlockImpact)warnings.push(`High impact ${(impact.value*100).toFixed(2)}% requires explicit acknowledgement`);else if(impact.value!=null&&impact.value>=POLICY.warnImpact)warnings.push(`Elevated impact ${(impact.value*100).toFixed(2)}%`);if(impact.value==null)warnings.push('Price impact unavailable; rely on provider minimum received and simulation');if(slippage==null)warnings.push('Slippage could not be derived from quote');const hardBlocked=reasons.length>0,requiresAck=!hardBlocked&&impact.value!=null&&impact.value>=POLICY.explicitAckImpact;return{
  ok:!hardBlocked,
  hardBlocked,
  requiresAck,
  level:hardBlocked?'BLOCK':requiresAck?'ACK_REQUIRED':warnings.length?'WARN':'PASS',
  reasons,warnings,
  slippage:slippage,
  slippagePct:slippage==null?null:slippage*100,
  impact:impact.value,
  impactPct:impact.value==null?null:impact.value*100,
  impactSource:impact.source,
  minimumReceived:min,
  quoteAgeMs:ageMs,
  expiresInMs:Math.max(0,POLICY.maxQuoteAgeMs-ageMs),
  mevNote:'Public mempool and third-party route execution can still expose users to market movement or MEV; no MEV protection is claimed unless the selected provider route explicitly supplies it.'
}}
function assertExecutable(q,{ackHighImpact=false}={}){const a=assess(q);if(a.hardBlocked)throw Error(a.reasons.join(' · '));if(a.requiresAck&&!ackHighImpact)throw Error('High price/economic impact requires explicit acknowledgement');return a}
function install(engine=window.RWAMultiChainEngine){if(!engine?.quote||!engine?.execute)throw Error('RWAMultiChainEngine is required');if(engine.__rwaProtectionInstalled)return engine;const originalQuote=engine.quote.bind(engine),originalExecute=engine.execute.bind(engine),originalSummary=engine.quoteSummary.bind(engine);engine.quote=async opts=>{const o={...(opts||{})};o.slippage=chooseSlippage(o);const q=await originalQuote(o);const a=assess(q);q.__riskGuard={...a,requestedSlippage:o.slippage};if(a.hardBlocked)throw Error(a.reasons.join(' · '));return q};engine.quoteSummary=q=>{const s=originalSummary(q),a=q?assess(q):null;return s&&a?{...s,risk:a}:s};engine.execute=async(q,opts={})=>{assertExecutable(q,opts);return originalExecute(q,opts)};engine.__rwaProtectionInstalled={version:VERSION,policy:{...POLICY},originalQuote,originalExecute};return engine}
async function protectedQuote(params,engine=window.RWAMultiChainEngine){install(engine);const q=await engine.quote(params);return{quote:q,summary:engine.quoteSummary(q),risk:assess(q)}}
window.RWATradeProtection={version:VERSION,policy:{...POLICY},chooseSlippage,assess,assertExecutable,install,protectedQuote};
})();
