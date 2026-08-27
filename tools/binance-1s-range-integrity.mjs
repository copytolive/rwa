const ROOT='https://data-api.binance.vision';
const symbol=process.env.RENKO_SYMBOL||'SOLUSDT';
const sec=1000,span=1000000;
const anchor=Math.floor((Date.now()-5000)/sec)*sec;
const results=[];
for(const j of [0,1,2,10]){
  const end=anchor-j*span,start=end-999*sec;
  const url=`${ROOT}/api/v3/klines?symbol=${symbol}&interval=1s&startTime=${start}&endTime=${end}&limit=1000`;
  const r=await fetch(url,{cache:'no-store'});if(!r.ok)throw new Error(`HTTP ${r.status} ${url}`);
  const rows=await r.json();const times=rows.map(x=>Number(x?.[0])).filter(Number.isFinite);const closes=rows.map(x=>Number(x?.[6])).filter(Number.isFinite);
  results.push({j,requested:{start,end},count:rows.length,first:times[0],last:times.at(-1),min:times.length?Math.min(...times):null,max:times.length?Math.max(...times):null,minClose:closes.length?Math.min(...closes):null,maxClose:closes.length?Math.max(...closes):null,ascending:times.every((v,i)=>i===0||v>=times[i-1]),inside:times.every(t=>t>=start&&t<=end),unique:new Set(times).size});
}
console.log('BINANCE_1S_RANGE_INTEGRITY',JSON.stringify({anchor,results},null,2));
const pass=results.every(x=>x.count>0&&x.inside&&x.ascending&&x.unique===x.count&&x.max-x.min>=Math.min(900000,(x.count-1)*1000*.9));
if(!pass)process.exit(2);
