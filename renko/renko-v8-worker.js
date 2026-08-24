self.onmessage=e=>{
  const m=e.data||{};
  if(m.type!=='build')return;
  const id=m.id,generation=m.generation,box=Number(m.box),bars=Array.isArray(m.bars)?m.bars:[];
  const out=[];
  let lastClose=NaN,direction=0;
  const add=(open,close,dir,time)=>{out.push({open,close,direction:dir,time:Number(time)||0});lastClose=close;direction=dir};
  if(box>0){
    for(const k of bars){
      const p=Number(k?.[4]),t=Number(k?.[0]);
      if(!Number.isFinite(p))continue;
      if(!Number.isFinite(lastClose))lastClose=Math.floor(p/box)*box;
      let guard=0;
      while(guard++<10000){
        if(direction===0){
          if(p>=lastClose+box){add(lastClose,lastClose+box,1,t);continue}
          if(p<=lastClose-box){add(lastClose,lastClose-box,-1,t);continue}
          break;
        }
        if(direction===1){
          if(p>=lastClose+box){add(lastClose,lastClose+box,1,t);continue}
          if(p<=lastClose-2*box){add(lastClose-box,lastClose-2*box,-1,t);continue}
          break;
        }
        if(p<=lastClose-box){add(lastClose,lastClose-box,-1,t);continue}
        if(p>=lastClose+2*box){add(lastClose+box,lastClose+2*box,1,t);continue}
        break;
      }
    }
  }
  self.postMessage({type:'built',id,generation,box,barCount:bars.length,bricks:out});
};
