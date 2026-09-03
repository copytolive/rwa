/* GOLD lazy-history RENKO build worker.
 * Uses the exact shared RENKO engine off the main thread. The main thread only
 * receives the completed base and performs one fit:false render transaction.
 */
'use strict';
importScripts('renko-tv-engine.js?v=186');
self.onmessage=e=>{
  const d=e.data||{},id=d.id;
  try{
    const count=Math.max(0,Math.floor(Number(d.count)||0)),a=new Float64Array(d.buffer);
    if(!count||a.length!==count*6)throw new Error(`GOLD rebuild worker input mismatch ${a.length}/${count*6}`);
    const bars=new Array(count);
    for(let i=0;i<count;i++){
      const o=i*6;
      bars[i]={openTime:a[o],closeTime:a[o+1],open:a[o+2],high:a[o+3],low:a[o+4],close:a[o+5],volume:0};
    }
    const E=self.RWARenkoTVEngine;
    if(!E?.build)throw new Error('RWARenkoTVEngine missing in rebuild worker');
    const base=E.build(bars,d.settings||{},Number(d.tickSize));
    self.postMessage({id,ok:true,base});
  }catch(err){self.postMessage({id,ok:false,error:String(err?.stack||err?.message||err)})}
};
