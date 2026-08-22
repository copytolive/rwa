import { ExchangeClient, HttpTransport } from '@nktkas/hyperliquid';
import { privateKeyToAccount } from 'viem/accounts';

const ADDRESS=/^0x[a-fA-F0-9]{40}$/;
const PK=/^0x[a-fA-F0-9]{64}$/;
const n=(v,d=0)=>Number.isFinite(Number(v))?Number(v):d;

export class RWAWorkerExecutionAPI {
  constructor({master,agentPrivateKey,testnet=true,risk={}}={}){
    if(!ADDRESS.test(String(master||''))) throw Error('RWA_MASTER_WALLET is invalid');
    if(!PK.test(String(agentPrivateKey||''))) throw Error('Delegated agent private key is invalid');
    this.master=String(master).toLowerCase();
    this.testnet=!!testnet;
    this.agent=privateKeyToAccount(agentPrivateKey);
    this.risk={
      dailyLoss:Math.max(0,n(risk.dailyLoss,250)),
      maxLeverage:Math.max(1,n(risk.maxLeverage,5)),
      maxExposure:Math.max(0,n(risk.maxExposure,5000)),
      perAsset:Math.max(0,n(risk.perAsset,2000)),
      kill:!!risk.kill
    };
    this.transport=new HttpTransport({isTestnet:this.testnet,timeout:15000});
    this.exchange=new ExchangeClient({transport:this.transport,wallet:this.agent,defaultExpiresAfter:()=>Date.now()+15000});
    this.metaCache=null;
    this.metaAt=0;
  }

  get apiUrl(){return this.testnet?'https://api.hyperliquid-testnet.xyz':'https://api.hyperliquid.xyz'}

  async info(type,data={}){
    const r=await fetch(this.apiUrl+'/info',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({type,...data}),signal:AbortSignal.timeout(15000)});
    if(!r.ok)throw Error(`Hyperliquid info HTTP ${r.status}`);
    return r.json();
  }

  async verifyAgent(){
    const rows=await this.info('extraAgents',{user:this.master});
    const remote=(Array.isArray(rows)?rows:[]).find(x=>String(x?.address||'').toLowerCase()===this.agent.address.toLowerCase());
    if(!remote)throw Error('Delegated worker agent is not approved by master wallet');
    if(remote.validUntil&&Date.now()>Number(remote.validUntil))throw Error('Delegated worker agent authorization expired');
    return remote;
  }

  async meta(){
    if(this.metaCache&&Date.now()-this.metaAt<30000)return this.metaCache;
    this.metaCache=await this.info('meta');this.metaAt=Date.now();return this.metaCache;
  }

  async asset(coin){
    coin=String(coin||'').toUpperCase();const m=await this.meta();const idx=(m.universe||[]).findIndex(x=>x.name===coin);
    if(idx<0)throw Error(`${coin} is not listed in Hyperliquid perps`);return{idx,u:m.universe[idx]};
  }

  fmtPx(v,szDecimals){
    const x=n(v);if(!(x>0))throw Error('Invalid price');const sig=Number(x.toPrecision(5)),max=Math.max(0,6-n(szDecimals)),dec=(String(sig).split('.')[1]||'').length;
    return sig.toFixed(Math.min(max,dec)).replace(/\.?0+$/,'');
  }
  fmtSz(v,szDecimals){
    const x=n(v);if(!(x>0))throw Error('Invalid size');const out=x.toFixed(n(szDecimals)).replace(/\.?0+$/,'');if(!Number(out))throw Error('Size rounds to zero');return out;
  }

  async liveRisk(){
    const [ch,pf]=await Promise.all([this.info('clearinghouseState',{user:this.master}),this.info('portfolio',{user:this.master})]);
    const positions=(ch?.assetPositions||[]).map(x=>x.position||x).filter(p=>n(p?.szi)!==0);
    const exposure=positions.reduce((s,p)=>s+Math.abs(n(p.positionValue)||n(p.szi)*n(p.entryPx)),0);
    const maxLeverage=Math.max(0,...positions.map(p=>n(p.leverage?.value??p.leverage)));
    const day=(Array.isArray(pf)?pf:[]).find(x=>Array.isArray(x)&&x[0]==='day')?.[1];
    const last=day?.pnlHistory?.at?.(-1);const pnl=n(Array.isArray(last)?last[1]:0);
    return{ch,pf,positions,exposure,maxLeverage,pnl};
  }

  async riskCheck({coin,price,size,leverage=1,reduceOnly=false,copyRemaining=null}={}){
    const r=this.risk;if(reduceOnly)return{pass:true,reduceOnly:true};
    if(r.kill)throw Error('Worker kill switch is active');
    if(n(leverage,1)>r.maxLeverage)throw Error(`Max leverage ${r.maxLeverage}x exceeded`);
    const live=await this.liveRisk();
    if(r.dailyLoss>0&&live.pnl<-r.dailyLoss)throw Error('Daily max loss reached');
    if(r.maxLeverage>0&&live.maxLeverage>r.maxLeverage)throw Error('Account leverage exceeds worker limit');
    const notional=Math.abs(n(price)*n(size));
    if(copyRemaining!=null&&notional>Math.max(0,n(copyRemaining)))throw Error('Copy capital cap exceeded');
    const assetExposure=live.positions.filter(p=>String(p.coin).toUpperCase()===String(coin).toUpperCase()).reduce((s,p)=>s+Math.abs(n(p.positionValue)||n(p.szi)*n(p.entryPx)),0);
    if(r.perAsset>0&&assetExposure+notional>r.perAsset)throw Error('Per-asset exposure limit exceeded');
    if(r.maxExposure>0&&live.exposure+notional>r.maxExposure)throw Error('Total exposure limit exceeded');
    return{pass:true,live,notional};
  }

  assertResult(result,label='Order'){
    if(result?.status&&result.status!=='ok')throw Error(`${label} rejected by venue`);
    const statuses=result?.response?.data?.statuses;if(Array.isArray(statuses)){const bad=statuses.find(x=>x&&typeof x==='object'&&x.error);if(bad?.error)throw Error(`${label} rejected: ${bad.error}`)}
    return result;
  }

  async limit({coin,side='BUY',price,size,reduceOnly=false,tif='Gtc',leverage=1,copyRemaining=null}){
    const {idx,u}=await this.asset(coin),p=this.fmtPx(price,u.szDecimals),s=this.fmtSz(size,u.szDecimals);
    await this.riskCheck({coin,price:Number(p),size:Number(s),leverage,reduceOnly,copyRemaining});
    if(!reduceOnly&&leverage!=null)this.assertResult(await this.exchange.updateLeverage({asset:idx,isCross:true,leverage:Math.max(1,Math.floor(n(leverage,1)))}),'Leverage update');
    const result=this.assertResult(await this.exchange.order({orders:[{a:idx,b:String(side).toUpperCase()==='BUY',p,s,r:!!reduceOnly,t:{limit:{tif}}}],grouping:'na'}),'Worker order');
    return{result,price:p,size:s,agent:this.agent.address};
  }

  async market({coin,side='BUY',size,reduceOnly=false,slippageBps=30,leverage=1,copyRemaining=null}){
    const mids=await this.info('allMids'),mid=n(mids?.[String(coin).toUpperCase()]);if(!(mid>0))throw Error('Market price unavailable');
    const buy=String(side).toUpperCase()==='BUY',px=mid*(1+(buy?1:-1)*n(slippageBps,30)/10000);
    return this.limit({coin,side,price:px,size,reduceOnly,tif:'Ioc',leverage,copyRemaining});
  }

  async cancel({coin,oid}){
    const {idx}=await this.asset(coin);const result=this.assertResult(await this.exchange.cancel({cancels:[{a:idx,o:Number(oid)}]}),'Worker cancel');return{result};
  }

  async accountState(){return this.info('clearinghouseState',{user:this.master})}
  async portfolio(){return this.info('portfolio',{user:this.master})}
  async fillsByTime(user,startTime,endTime=Date.now(),sourceTestnet=this.testnet){
    const url=sourceTestnet?'https://api.hyperliquid-testnet.xyz':'https://api.hyperliquid.xyz';
    const r=await fetch(url+'/info',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({type:'userFillsByTime',user,startTime,endTime,aggregateByTime:false}),signal:AbortSignal.timeout(15000)});
    if(!r.ok)throw Error(`Source fills HTTP ${r.status}`);return r.json();
  }
}

export const WORKER_SINGLE_WRITE_PATH='RWAWorkerExecutionAPI';
