await import(new URL('../renko/renko-tv-engine.js',import.meta.url));
const E=globalThis.RWARenkoTVEngine;
if(!E?.traditionalBox)throw new Error('traditionalBox helper missing');
const eq=(a,b,t=1e-12)=>Math.abs(Number(a)-Number(b))<=Math.max(t,Math.abs(Number(b))*1e-10);
const bars=[
  {openTime:1000,closeTime:1999,open:100,high:100,low:100,close:100},
  {openTime:2000,closeTime:2999,open:100,high:104,low:100,close:104},
  {openTime:3000,closeTime:3999,open:104,high:104,low:96,close:96}
];
const tick=.01;
const min=E.traditionalBox(.001,tick);
if(!eq(min,tick))throw new Error(`traditional sub-tick must clamp to one tick: ${min}`);
const box=E.computeBox(bars,{method:'traditional',boxSize:2,_exactBox:999},tick);
if(!eq(box,2))throw new Error(`ATR _exactBox leaked into Traditional: ${box}`);
const built=E.build(bars,{method:'traditional',boxSize:2,_exactBox:999,source:'close',wicks:true,_unboundedBricks:true},tick);
if(!eq(built.box,2)||!built.bricks.length)throw new Error('Traditional build did not use fixed absolute box');
const audit=E.audit(built.bricks);
if(!audit.continuation||!audit.reversal)throw new Error(`Traditional 1x/2x audit failed ${JSON.stringify(audit)}`);
console.log('RENKO_TRADITIONAL_ENGINE_CONTRACT_PASS '+JSON.stringify({minTickFloor:min,box:built.box,bricks:built.bricks.length,audit,revision:E.traditionalRevision}));
