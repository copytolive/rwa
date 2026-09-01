'use strict';

// Decode one canonical monthly gzip into compact transferable Int32 columns.
// The worker never fabricates source seconds and never expands the month into
// millions of JS objects. Only typed columns are returned to the UI thread.
self.onmessage=async event=>{
  const {id,bytes,barCount,header}=event.data||{};
  try{
    if(!(bytes instanceof ArrayBuffer))throw new Error('MONTH_BYTES_REQUIRED');
    if(!(barCount>0))throw new Error('MONTH_BARCOUNT_REQUIRED');
    if(typeof DecompressionStream!=='function')throw new Error('DECOMPRESSION_STREAM_UNAVAILABLE');
    const sec=new Int32Array(barCount),open=new Int32Array(barCount),high=new Int32Array(barCount),low=new Int32Array(barCount),close=new Int32Array(barCount);
    const stream=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
    const reader=stream.getReader(),decoder=new TextDecoder();
    let carry='',row=0,headerSeen=false,previous=-1;
    const parseLine=line=>{
      if(!headerSeen){
        headerSeen=true;
        if(line!==(header||'unix_second,open_tick,high_tick,low_tick,close_tick'))throw new Error('CANONICAL_HEADER_MISMATCH');
        return;
      }
      if(!line)return;
      const p=line.split(',');
      if(p.length!==5)throw new Error('CANONICAL_COLUMN_MISMATCH');
      if(row>=barCount)throw new Error('CANONICAL_BARCOUNT_OVERFLOW');
      const s=Number(p[0]),o=Number(p[1]),h=Number(p[2]),l=Number(p[3]),c=Number(p[4]);
      if(![s,o,h,l,c].every(Number.isInteger))throw new Error('CANONICAL_INTEGER_MISMATCH');
      if(previous>=0&&s<=previous)throw new Error('CANONICAL_DUPLICATE_OR_NON_MONOTONIC_SECOND');
      if(l>h||o<l||o>h||c<l||c>h)throw new Error('CANONICAL_OHLC_INVALID');
      sec[row]=s;open[row]=o;high[row]=h;low[row]=l;close[row]=c;previous=s;row++;
    };
    while(true){
      const {value,done}=await reader.read();
      if(done)break;
      carry+=decoder.decode(value,{stream:true});
      let start=0;
      for(let i=0;i<carry.length;i++)if(carry.charCodeAt(i)===10){
        let line=carry.slice(start,i);if(line.endsWith('\r'))line=line.slice(0,-1);parseLine(line);start=i+1;
      }
      carry=carry.slice(start);
    }
    carry+=decoder.decode();
    if(carry){let line=carry.endsWith('\r')?carry.slice(0,-1):carry;parseLine(line)}
    if(!headerSeen||row!==barCount)throw new Error(`CANONICAL_BARCOUNT_MISMATCH:${row}:${barCount}`);
    self.postMessage({id,ok:true,row,first:sec[0],last:sec[row-1],sec:sec.buffer,open:open.buffer,high:high.buffer,low:low.buffer,close:close.buffer},[sec.buffer,open.buffer,high.buffer,low.buffer,close.buffer]);
  }catch(error){self.postMessage({id,ok:false,error:String(error&&error.stack||error)})}
};
