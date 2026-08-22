let cancelled=false;
self.onmessage=e=>{if(e.data?.type==='run'){cancelled=false;run(e.data.config).catch(err=>postMessage({type:'error',message:String(err?.message||err)}))}else if(e.data?.type==='cancel'){cancelled=true}};

const pip=0.0001;

class Rolling{
  constructor(n){this.n=Math.max(1,n|0);this.a=[];this.sum=0}
  push(v){this.a.push(v);this.sum+=v;if(this.a.length>this.n)this.sum-=this.a.shift()}
  avg(){return this.a.length===this.n?this.sum/this.n:null}
  maxPrev(){if(this.a.length<this.n)return null;let m=-Infinity;for(const v of this.a)m=Math.max(m,v);return m}
  minPrev(){if(this.a.length<this.n)return null;let m=Infinity;for(const v of this.a)m=Math.min(m,v);return m}
}

class Strategy{
  constructor(c){this.c=c;this.prevRel=0;this.fast=new Rolling(c.fast);this.slow=new Rolling(c.slow);this.emaF=null;this.emaS=null;this.prevPrice=null;this.avgGain=null;this.avgLoss=null;this.rsiWarm=[];this.don=new Rolling(c.slow)}
  signal(price){
    const c=this.c;
    if(c.strategy==='price_sma'){
      this.slow.push(price);const ma=this.slow.avg();if(ma==null)return 0;const rel=price>ma?1:price<ma?-1:this.prevRel;const sig=this.prevRel&&rel!==this.prevRel?rel:0;this.prevRel=rel;return sig;
    }
    if(c.strategy==='sma_cross'){
      this.fast.push(price);this.slow.push(price);const f=this.fast.avg(),s=this.slow.avg();if(f==null||s==null)return 0;const rel=f>s?1:f<s?-1:this.prevRel;const sig=this.prevRel&&rel!==this.prevRel?rel:0;this.prevRel=rel;return sig;
    }
    if(c.strategy==='ema_cross'){
      const af=2/(c.fast+1),as=2/(c.slow+1);this.emaF=this.emaF==null?price:af*price+(1-af)*this.emaF;this.emaS=this.emaS==null?price:as*price+(1-as)*this.emaS;const rel=this.emaF>this.emaS?1:this.emaF<this.emaS?-1:this.prevRel;const sig=this.prevRel&&rel!==this.prevRel?rel:0;this.prevRel=rel;return sig;
    }
    if(c.strategy==='rsi_revert'){
      if(this.prevPrice==null){this.prevPrice=price;return 0}
      const ch=price-this.prevPrice;this.prevPrice=price;const g=Math.max(0,ch),l=Math.max(0,-ch),n=Math.max(2,c.fast|0);
      if(this.avgGain==null){this.rsiWarm.push([g,l]);if(this.rsiWarm.length<n)return 0;this.avgGain=this.rsiWarm.reduce((s,x)=>s+x[0],0)/n;this.avgLoss=this.rsiWarm.reduce((s,x)=>s+x[1],0)/n}else{this.avgGain=(this.avgGain*(n-1)+g)/n;this.avgLoss=(this.avgLoss*(n-1)+l)/n}
      const rs=this.avgLoss===0?Infinity:this.avgGain/this.avgLoss;const rsi=100-(100/(1+rs));if(rsi<=c.rsiBuy)return 1;if(rsi>=c.rsiSell)return -1;return 0;
    }
    if(c.strategy==='donchian'){
      const hi=this.don.maxPrev(),lo=this.don.minPrev();let sig=0;if(hi!=null&&price>hi)sig=1;else if(lo!=null&&price<lo)sig=-1;this.don.push(price);return sig;
    }
    return 0;
  }
}

function parsePrices(line,fallbackSpreadPips){
  const nums=line.trim().split(/[\s,;]+/).map(Number).filter(Number.isFinite);if(!nums.length)return null;
  const bid=nums[0];if(!(bid>0.5&&bid<2.5))return null;
  let ask=nums.length>1?nums[1]:NaN;if(!(ask>=bid&&ask-bid<0.02))ask=bid+fallbackSpreadPips*pip;
  return [bid,ask];
}

async function run(c){
  const st=new Strategy(c);let pos=null,samples=0,events=0,wins=0,grossPos=0,grossNeg=0,netR=0,peak=0,maxDD=0,lastBid=null,lastAsk=null,processed=0;
  const record=r=>{events++;netR+=r;if(r>0){wins++;grossPos+=r}else grossNeg+=Math.abs(r);if(netR>peak)peak=netR;maxDD=Math.max(maxDD,peak-netR)};
  const maybeExit=(bid,ask)=>{
    if(!pos)return;
    if(pos.dir===1){if(bid<=pos.stop){record(-1);pos=null}else if(bid>=pos.target){record(c.rr);pos=null}}
    else {if(ask>=pos.stop){record(-1);pos=null}else if(ask<=pos.target){record(c.rr);pos=null}}
  };
  for(let mi=0;mi<c.months.length;mi++){
    if(cancelled)throw new Error('Cancelled');const ym=c.months[mi],url=`${c.rawBase}/EURUSD-${ym}_converted.txt`;
    postMessage({type:'progress',pct:mi/c.months.length*100,text:`Downloading ${ym}…`,log:`${ym} · fetch`});
    const res=await fetch(url,{cache:'force-cache'});if(!res.ok)throw new Error(`${ym}: HTTP ${res.status}`);
    const reader=res.body.getReader(),decoder=new TextDecoder();let carry='',local=0;
    while(true){
      if(cancelled)throw new Error('Cancelled');const {value,done}=await reader.read();carry+=decoder.decode(value||new Uint8Array(),{stream:!done});
      const lines=carry.split(/\r?\n/);carry=lines.pop()||'';
      for(const line of lines){const q=parsePrices(line,c.spreadPips);if(!q)continue;const [bid,ask]=q;lastBid=bid;lastAsk=ask;samples++;local++;maybeExit(bid,ask);if(!pos){const sig=st.signal((bid+ask)/2);if(sig){const d=c.slPips*pip;if(sig===1)pos={dir:1,entry:ask,stop:ask-d,target:ask+d*c.rr};else pos={dir:-1,entry:bid,stop:bid+d,target:bid-d*c.rr}}}else st.signal((bid+ask)/2)}
      if(done)break;
    }
    if(carry){const q=parsePrices(carry,c.spreadPips);if(q){const [bid,ask]=q;lastBid=bid;lastAsk=ask;samples++;maybeExit(bid,ask);if(!pos){const sig=st.signal((bid+ask)/2);if(sig){const d=c.slPips*pip;pos=sig===1?{dir:1,entry:ask,stop:ask-d,target:ask+d*c.rr}:{dir:-1,entry:bid,stop:bid+d,target:bid-d*c.rr}}}}}
    processed++;postMessage({type:'progress',pct:(mi+1)/c.months.length*100,text:`Processed ${ym} · ${local.toLocaleString()} samples`,log:`${ym} · ${local.toLocaleString()} valid samples`});
  }
  if(pos&&lastBid!=null&&lastAsk!=null){const px=pos.dir===1?lastBid:lastAsk;const d=c.slPips*pip;let r=pos.dir===1?(px-pos.entry)/d:(pos.entry-px)/d;r=Math.max(-1,Math.min(c.rr,r));record(r);pos=null}
  const weeks=Math.max(1,c.months.length*30.4375/7);
  postMessage({type:'result',result:{netR,positiveRate:events?wins/events*100:0,gainLossRatio:grossNeg?grossPos/grossNeg:(grossPos?Infinity:0),maxDrawdownR:maxDD,events,eventsPerWeek:events/weeks,samples,monthsProcessed:processed}});
}
