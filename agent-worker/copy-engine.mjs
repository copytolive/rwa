import {createHash} from 'node:crypto';

const n=(v,d=0)=>Number.isFinite(Number(v))?Number(v):d;

export function sourceFillId(target,fill={}){
  const stable=fill.tid??fill.hash??fill.oid??`${fill.time||0}:${fill.coin||''}:${fill.side||''}:${fill.px||''}:${fill.sz||''}:${fill.dir||''}:${fill.closedPnl||''}`;
  return `${String(target||'').toLowerCase()}:${String(stable)}`;
}

export function cloidFor(master,target,fill={}){
  const digest=createHash('sha256').update(`${String(master||'').toLowerCase()}|${sourceFillId(target,fill)}`).digest('hex').slice(0,32);
  return `0x${digest}`;
}

export function isProcessed(copy,id){
  return Array.isArray(copy?.processed)&&copy.processed.includes(id);
}

export function markProcessed(copy,id,limit=5000){
  copy.processed=Array.isArray(copy.processed)?copy.processed:[];
  if(!copy.processed.includes(id))copy.processed.push(id);
  if(copy.processed.length>limit)copy.processed=copy.processed.slice(-limit);
  return copy.processed;
}

export function planCopyFill({fill={},scale=0,capital=0,used=0,signed=0}={}){
  const coin=String(fill.coin||'').toUpperCase();
  const side=fill.side==='B'?'BUY':'SELL';
  const px=n(fill.px);
  const sourceSize=Math.abs(n(fill.sz));
  const dir=String(fill.dir||'').toLowerCase();
  const closing=dir.includes('close')||n(fill.closedPnl)!==0;
  let size=sourceSize*n(scale),reduceOnly=false;

  if(!(px>0&&size>0))return{kind:'skip',reason:'bad-source-fill',coin,side,px,size:0,reduceOnly:false};

  if(closing){
    if(!signed)return{kind:'skip',reason:'no-copied-position',coin,side,px,size:0,reduceOnly:true};
    if((signed>0&&side!=='SELL')||(signed<0&&side!=='BUY'))return{kind:'skip',reason:'not-reducing',coin,side,px,size:0,reduceOnly:true};
    size=Math.min(size,Math.abs(signed));
    if(!(size>0))return{kind:'skip',reason:'zero-reduction',coin,side,px,size:0,reduceOnly:true};
    reduceOnly=true;
  }else{
    const remaining=Math.max(0,n(capital)-n(used));
    if(!(remaining>0))return{kind:'block',reason:'capital-cap',coin,side,px,size:0,reduceOnly:false};
    size=Math.min(size,remaining/px);
    if(!(size>0))return{kind:'block',reason:'capital-cap',coin,side,px,size:0,reduceOnly:false};
  }

  return{kind:'execute',coin,side,px,size,reduceOnly,closing};
}

export function applyLedgerPosition(signed,side,size,reduceOnly=false){
  const delta=(String(side).toUpperCase()==='BUY'?1:-1)*Math.abs(n(size));
  const next=n(signed)+delta;
  if(reduceOnly&&n(signed)!==0&&Math.sign(next)!==Math.sign(n(signed)))return 0;
  if(Math.abs(next)<1e-12)return 0;
  return next;
}

export function sessionLoss({baselineEquity=0,currentEquity=0,baselinePnl=0,currentPnl=0}={}){
  const equityLoss=n(baselineEquity)>0?Math.max(0,n(baselineEquity)-n(currentEquity)):0;
  const pnlLoss=Math.max(0,n(baselinePnl)-n(currentPnl));
  return Math.max(equityLoss,pnlLoss);
}
