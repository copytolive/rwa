let cancelled=false;
self.onmessage=e=>{if(e.data?.type==='run'){cancelled=false;run(e.data.config,e.data.file||null).catch(err=>postMessage({type:'error',message:String(err?.message||err)}))}else if(e.data?.type==='cancel'){cancelled=true}};

const pip=0.0001;

class RollingMean{
  constructor(n){this.n=Math.max(1,n|0);this.buf=new Float64Array(this.n);this.i=0;this.count=0;this.sum=0}
  push(v){if(this.count<this.n){this.buf[this.i]=v;this.sum+=v;this.count++}else{this.sum+=v-this.buf[this.i];this.buf[this.i]=v}this.i=(this.i+1)%this.n}
  avg(){return this.count===this.n?this.sum/this.n:null}
}

class DonchianWindow{
  constructor(n){this.n=Math.max(2,n|0);this.idx=0;this.maxI=[];this.maxV=[];this.minI=[];this.minV=[];this.hMax=0;this.hMin=0}
  bounds(){
    const expire=this.idx-this.n;
    while(this.hMax<this.maxI.length&&this.maxI[this.hMax]<expire)this.hMax++;
    while(this.hMin<this.minI.length&&this.minI[this.hMin]<expire)this.hMin++;
    if(this.idx<this.n)return [null,null];
    return [this.maxV[this.hMax],this.minV[this.hMin]];
  }
  push(v){
    const i=this.idx++;
    while(this.maxI.length>this.hMax&&this.maxV[this.maxV.length-1]<=v){this.maxI.pop();this.maxV.pop()}
    this.maxI.push(i);this.maxV.push(v);
    while(this.minI.length>this.hMin&&this.minV[this.minV.length-1]>=v){this.minI.pop();this.minV.pop()}
    this.minI.push(i);this.minV.push(v);
    if(this.hMax>4096){this.maxI=this.maxI.slice(this.hMax);this.maxV=this.maxV.slice(this.hMax);this.hMax=0}
    if(this.hMin>4096){this.minI=this.minI.slice(this.hMin);this.minV=this.minV.slice(this.hMin);this.hMin=0}
  }
}

class Strategy{
  constructor(c){
    this.c=c;this.prevRel=0;this.fast=new RollingMean(c.fast);this.slow=new RollingMean(c.slow);
    this.emaF=null;this.emaS=null;this.prevPrice=null;this.avgGain=null;this.avgLoss=null;this.warmCount=0;this.warmGain=0;this.warmLoss=0;
    this.don=new DonchianWindow(c.slow);
  }
  signal(price){
    const c=this.c;
    if(c.strategy==='price_sma'){
      this.slow.push(price);const ma=this.slow.avg();if(ma==null)return 0;
      const rel=price>ma?1:price<ma?-1:this.prevRel;const sig=this.prevRel&&rel!==this.prevRel?rel:0;this.prevRel=rel;return sig;
    }
    if(c.strategy==='sma_cross'){
      this.fast.push(price);this.slow.push(price);const f=this.fast.avg(),s=this.slow.avg();if(f==null||s==null)return 0;
      const rel=f>s?1:f<s?-1:this.prevRel;const sig=this.prevRel&&rel!==this.prevRel?rel:0;this.prevRel=rel;return sig;
    }
    if(c.strategy==='ema_cross'){
      const af=2/(c.fast+1),as=2/(c.slow+1);this.emaF=this.emaF==null?price:af*price+(1-af)*this.emaF;this.emaS=this.emaS==null?price:as*price+(1-as)*this.emaS;
      const rel=this.emaF>this.emaS?1:this.emaF<this.emaS?-1:this.prevRel;const sig=this.prevRel&&rel!==this.prevRel?rel:0;this.prevRel=rel;return sig;
    }
    if(c.strategy==='rsi_revert'){
      if(this.prevPrice==null){this.prevPrice=price;return 0}
      const ch=price-this.prevPrice;this.prevPrice=price;const g=Math.max(0,ch),l=Math.max(0,-ch),n=Math.max(2,c.fast|0);
      if(this.avgGain==null){this.warmGain+=g;this.warmLoss+=l;this.warmCount++;if(this.warmCount<n)return 0;this.avgGain=this.warmGain/n;this.avgLoss=this.warmLoss/n}
      else{this.avgGain=(this.avgGain*(n-1)+g)/n;this.avgLoss=(this.avgLoss*(n-1)+l)/n}
      const rs=this.avgLoss===0?Infinity:this.avgGain/this.avgLoss;const rsi=100-(100/(1+rs));if(rsi<=c.rsiBuy)return 1;if(rsi>=c.rsiSell)return -1;return 0;
    }
    if(c.strategy==='donchian'){
      const [hi,lo]=this.don.bounds();let sig=0;if(hi!=null&&price>hi)sig=1;else if(lo!=null&&price<lo)sig=-1;this.don.push(price);return sig;
    }
    return 0;
  }
}

function parsePrices(line,fallbackSpreadPips){
  const s=line.trim();if(!s)return null;const parts=s.split(/[\s,;]+/,3);const bid=Number(parts[0]);if(!Number.isFinite(bid)||!(bid>0.000001&&bid<1000000))return null;
  let ask=parts.length>1?Number(parts[1]):NaN;if(!Number.isFinite(ask)||ask<bid||ask-bid>Math.max(0.02,bid*0.02))ask=bid+fallbackSpreadPips*pip;
  return [bid,ask];
}

async function run(c,customFile){
  const st=new Strategy(c);let pos=null,samples=0,events=0,wins=0,grossPos=0,grossNeg=0,netR=0,peak=0,maxDD=0,lastBid=null,lastAsk=null,processed=0;
  const record=r=>{events++;netR+=r;if(r>0){wins++;grossPos+=r}else grossNeg+=Math.abs(r);if(netR>peak)peak=netR;maxDD=Math.max(maxDD,peak-netR)};
  const maybeExit=(bid,ask)=>{
    if(!pos)return;
    if(pos.dir===1){if(bid<=pos.stop){record(-1);pos=null}else if(bid>=pos.target){record(c.rr);pos=null}}
    else{if(ask>=pos.stop){record(-1);pos=null}else if(ask<=pos.target){record(c.rr);pos=null}}
  };
  const processQuote=(bid,ask)=>{
    lastBid=bid;lastAsk=ask;samples++;maybeExit(bid,ask);const mid=(bid+ask)/2;const sig=st.signal(mid);
    if(!pos&&sig){const d=c.slPips*pip;pos=sig===1?{dir:1,entry:ask,stop:ask-d,target:ask+d*c.rr}:{dir:-1,entry:bid,stop:bid+d,target:bid-d*c.rr}}
  };
  const labels=customFile?[customFile.name]:c.months;
  for(let mi=0;mi<labels.length;mi++){
    if(cancelled)throw new Error('Cancelled');const label=labels[mi];let reader;
    if(customFile){postMessage({type:'progress',pct:0,text:`Reading ${label}…`,log:`${label} · local file`});reader=customFile.stream().getReader()}
    else{const url=`${c.rawBase}/EURUSD-${label}_converted.txt`;postMessage({type:'progress',pct:mi/labels.length*100,text:`Downloading ${label}…`,log:`${label} · fetch`});const res=await fetch(url,{cache:'force-cache'});if(!res.ok)throw new Error(`${label}: HTTP ${res.status}`);reader=res.body.getReader()}
    const decoder=new TextDecoder();let carry='',local=0;
    while(true){
      if(cancelled)throw new Error('Cancelled');const {value,done}=await reader.read();carry+=decoder.decode(value||new Uint8Array(),{stream:!done});
      const lines=carry.split(/\r?\n/);carry=lines.pop()||'';
      for(const line of lines){const q=parsePrices(line,c.spreadPips);if(!q)continue;processQuote(q[0],q[1]);local++}
      if(done)break;
    }
    if(carry){const q=parsePrices(carry,c.spreadPips);if(q){processQuote(q[0],q[1]);local++}}
    processed++;postMessage({type:'progress',pct:(mi+1)/labels.length*100,text:`Processed ${label} · ${local.toLocaleString()} samples`,log:`${label} · ${local.toLocaleString()} valid samples`});
  }
  if(pos&&lastBid!=null&&lastAsk!=null){const px=pos.dir===1?lastBid:lastAsk;const d=c.slPips*pip;let r=pos.dir===1?(px-pos.entry)/d:(pos.entry-px)/d;r=Math.max(-1,Math.min(c.rr,r));record(r);pos=null}
  const activeWeeks=Math.max(1,samples/(5*24*3600));
  postMessage({type:'result',result:{netR,positiveRate:events?wins/events*100:0,gainLossRatio:grossNeg?grossPos/grossNeg:(grossPos?Infinity:0),maxDrawdownR:maxDD,events,eventsPerWeek:events/activeWeeks,samples,monthsProcessed:processed,sourceType:customFile?'custom-local':'public-github'}});
}
