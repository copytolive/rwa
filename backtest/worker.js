let cancelled=false;
self.onmessage=e=>{
  if(e.data?.type==='run'){
    cancelled=false;
    run(e.data.config,e.data.file||null).catch(err=>postMessage({type:'error',message:String(err?.message||err)}));
  }else if(e.data?.type==='cancel')cancelled=true;
};

class RollingMean{
  constructor(n){this.n=Math.max(1,n|0);this.buf=new Float64Array(this.n);this.i=0;this.count=0;this.sum=0}
  push(v){
    if(this.count<this.n){this.buf[this.i]=v;this.sum+=v;this.count++}
    else{this.sum+=v-this.buf[this.i];this.buf[this.i]=v}
    this.i=(this.i+1)%this.n;
  }
  avg(){return this.count===this.n?this.sum/this.n:null}
}

class DonchianWindow{
  constructor(n){this.n=Math.max(2,n|0);this.idx=0;this.maxI=[];this.maxV=[];this.minI=[];this.minV=[];this.hMax=0;this.hMin=0}
  bounds(){
    const expire=this.idx-this.n;
    while(this.hMax<this.maxI.length&&this.maxI[this.hMax]<expire)this.hMax++;
    while(this.hMin<this.minI.length&&this.minI[this.hMin]<expire)this.hMin++;
    if(this.idx<this.n)return[null,null];
    return[this.maxV[this.hMax],this.minV[this.hMin]];
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
    this.emaF=null;this.emaS=null;this.prevPrice=null;this.avgGain=null;this.avgLoss=null;
    this.warmCount=0;this.warmGain=0;this.warmLoss=0;this.don=new DonchianWindow(c.slow);
  }
  signal(price){
    const c=this.c;
    if(c.strategy==='price_sma'){
      this.slow.push(price);const ma=this.slow.avg();if(ma==null)return 0;
      const rel=price>ma?1:price<ma?-1:this.prevRel;
      const sig=this.prevRel&&rel!==this.prevRel?rel:0;this.prevRel=rel;return sig;
    }
    if(c.strategy==='sma_cross'){
      this.fast.push(price);this.slow.push(price);const f=this.fast.avg(),s=this.slow.avg();if(f==null||s==null)return 0;
      const rel=f>s?1:f<s?-1:this.prevRel;
      const sig=this.prevRel&&rel!==this.prevRel?rel:0;this.prevRel=rel;return sig;
    }
    if(c.strategy==='ema_cross'){
      const af=2/(c.fast+1),as=2/(c.slow+1);
      this.emaF=this.emaF==null?price:af*price+(1-af)*this.emaF;
      this.emaS=this.emaS==null?price:as*price+(1-as)*this.emaS;
      const rel=this.emaF>this.emaS?1:this.emaF<this.emaS?-1:this.prevRel;
      const sig=this.prevRel&&rel!==this.prevRel?rel:0;this.prevRel=rel;return sig;
    }
    if(c.strategy==='rsi_revert'){
      if(this.prevPrice==null){this.prevPrice=price;return 0}
      const ch=price-this.prevPrice;this.prevPrice=price;
      const g=Math.max(0,ch),l=Math.max(0,-ch),n=Math.max(2,c.fast|0);
      if(this.avgGain==null){
        this.warmGain+=g;this.warmLoss+=l;this.warmCount++;
        if(this.warmCount<n)return 0;
        this.avgGain=this.warmGain/n;this.avgLoss=this.warmLoss/n;
      }else{
        this.avgGain=(this.avgGain*(n-1)+g)/n;
        this.avgLoss=(this.avgLoss*(n-1)+l)/n;
      }
      const rs=this.avgLoss===0?Infinity:this.avgGain/this.avgLoss;
      const rsi=100-(100/(1+rs));
      if(rsi<=c.rsiBuy)return 1;if(rsi>=c.rsiSell)return-1;return 0;
    }
    if(c.strategy==='donchian'){
      const[hi,lo]=this.don.bounds();let sig=0;
      if(hi!=null&&price>hi)sig=1;else if(lo!=null&&price<lo)sig=-1;
      this.don.push(price);return sig;
    }
    return 0;
  }
}

function parsePrices(line,c){
  const s=line.trim();if(!s)return null;
  const parts=s.split(/[\s,;]+/);
  const bidIndex=Math.max(0,(c.bidCol||1)-1);
  const askIndex=(c.askCol||0)>0?(c.askCol-1):-1;
  if(bidIndex>=parts.length)return null;
  const bid=Number(parts[bidIndex]);
  if(!Number.isFinite(bid)||!(bid>0.000001&&bid<1000000000))return null;
  let ask=askIndex>=0&&askIndex<parts.length?Number(parts[askIndex]):NaN;
  const pointSize=Number(c.pointSize)||0.0001;
  if(!Number.isFinite(ask)||ask<bid||ask-bid>Math.max(pointSize*10000,bid*0.02))ask=bid+(Number(c.spreadPips)||0)*pointSize;
  return[bid,ask];
}

function sideAllowed(sig,mode){
  if(mode==='long')return sig===1;
  if(mode==='short')return sig===-1;
  return sig===1||sig===-1;
}

async function run(c,customFile){
  const pointSize=Number(c.pointSize)||0.0001;
  const stopDistance=(Number(c.slPips)||0)*pointSize;
  const rr=Number(c.rr)||0;
  const costR=Math.max(0,Number(c.costR)||0);
  const slip=Math.max(0,Number(c.slippagePoints)||0)*pointSize;
  if(!(stopDistance>0)||!(rr>0))throw new Error('Invalid stop/target configuration');

  const st=new Strategy(c);
  let pos=null,samples=0,events=0,wins=0,grossPos=0,grossNeg=0,netR=0,peak=0,maxDD=0;
  let lastBid=null,lastAsk=null,processed=0,signals=0,longEvents=0,shortEvents=0,currentLossStreak=0,maxLossStreak=0;

  const record=(rawR,dir)=>{
    const r=rawR-costR;
    events++;netR+=r;
    if(dir===1)longEvents++;else if(dir===-1)shortEvents++;
    if(r>0){wins++;grossPos+=r;currentLossStreak=0}
    else{grossNeg+=Math.abs(r);currentLossStreak++;maxLossStreak=Math.max(maxLossStreak,currentLossStreak)}
    if(netR>peak)peak=netR;maxDD=Math.max(maxDD,peak-netR);
  };

  const maybeExit=(bid,ask)=>{
    if(!pos)return;
    const dir=pos.dir;
    if(dir===1){
      if(bid<=pos.stop){record(-1,dir);pos=null}
      else if(bid>=pos.target){record(rr,dir);pos=null}
    }else{
      if(ask>=pos.stop){record(-1,dir);pos=null}
      else if(ask<=pos.target){record(rr,dir);pos=null}
    }
  };

  const processQuote=(bid,ask)=>{
    lastBid=bid;lastAsk=ask;samples++;maybeExit(bid,ask);
    const mid=(bid+ask)/2,sig=st.signal(mid);
    if(sig)signals++;
    if(!pos&&sig&&sideAllowed(sig,c.tradeSide)){
      if(sig===1){
        const entry=ask+slip;
        pos={dir:1,entry,stop:entry-stopDistance,target:entry+stopDistance*rr};
      }else{
        const entry=bid-slip;
        pos={dir:-1,entry,stop:entry+stopDistance,target:entry-stopDistance*rr};
      }
    }
  };

  const labels=customFile?[customFile.name]:c.months;
  for(let mi=0;mi<labels.length;mi++){
    if(cancelled)throw new Error('Cancelled');
    const label=labels[mi];let reader;
    if(customFile){
      postMessage({type:'progress',pct:0,text:`Reading ${label}…`,log:`${label} · local file`});
      reader=customFile.stream().getReader();
    }else{
      const url=`${c.rawBase}/EURUSD-${label}_converted.txt`;
      postMessage({type:'progress',pct:mi/labels.length*100,text:`Downloading ${label}…`,log:`${label} · fetch`});
      const res=await fetch(url,{cache:'force-cache'});if(!res.ok)throw new Error(`${label}: HTTP ${res.status}`);
      reader=res.body.getReader();
    }

    const decoder=new TextDecoder();let carry='',local=0;
    while(true){
      if(cancelled)throw new Error('Cancelled');
      const{value,done}=await reader.read();carry+=decoder.decode(value||new Uint8Array(),{stream:!done});
      const lines=carry.split(/\r?\n/);carry=lines.pop()||'';
      for(const line of lines){const q=parsePrices(line,c);if(!q)continue;processQuote(q[0],q[1]);local++}
      if(done)break;
    }
    if(carry){const q=parsePrices(carry,c);if(q){processQuote(q[0],q[1]);local++}}
    processed++;
    postMessage({type:'progress',pct:(mi+1)/labels.length*100,text:`Processed ${label} · ${local.toLocaleString()} samples`,log:`${label} · ${local.toLocaleString()} valid samples`});
  }

  if(pos&&lastBid!=null&&lastAsk!=null){
    const dir=pos.dir,px=dir===1?lastBid:lastAsk;
    let rawR=dir===1?(px-pos.entry)/stopDistance:(pos.entry-px)/stopDistance;
    rawR=Math.max(-1,Math.min(rr,rawR));record(rawR,dir);pos=null;
  }

  const sampleSeconds=customFile?Math.max(.001,Number(c.sampleSeconds)||1):1;
  const activeWeeks=Math.max(1,(samples*sampleSeconds)/(5*24*3600));
  postMessage({
    type:'result',
    result:{
      netR,
      positiveRate:events?wins/events*100:0,
      gainLossRatio:grossNeg?grossPos/grossNeg:(grossPos?Infinity:0),
      maxDrawdownR:maxDD,
      expectancyR:events?netR/events:0,
      events,
      eventsPerWeek:events/activeWeeks,
      maxLossStreak,
      longEvents,
      shortEvents,
      signals,
      samples,
      monthsProcessed:processed,
      sourceType:customFile?'custom-local':'public-github',
      pointSize,
      spreadFallbackPoints:Number(c.spreadPips)||0,
      slippagePoints:Number(c.slippagePoints)||0,
      roundTripCostR:costR,
      sampleSeconds
    }
  });
}
