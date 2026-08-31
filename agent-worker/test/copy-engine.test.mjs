import test from 'node:test';
import assert from 'node:assert/strict';
import {sourceFillId,cloidFor,isProcessed,markProcessed,planCopyFill,applyLedgerPosition,sessionLoss} from '../copy-engine.mjs';

const master='0x'+'11'.repeat(20),target='0x'+'22'.repeat(20);
const fill=(x={})=>({coin:'BTC',side:'B',px:'100',sz:'2',time:1000,tid:1,dir:'Open Long',closedPnl:'0',...x});

test('opening fill scales and respects remaining copy capital',()=>{
  const p=planCopyFill({fill:fill(),scale:.5,capital:70,used:20,signed:0});
  assert.equal(p.kind,'execute');
  assert.equal(p.side,'BUY');
  assert.equal(p.reduceOnly,false);
  assert.equal(p.size,.5); // desired 1 BTC is capped to $50 remaining at $100
});

test('partial source fills remain distinct with same timestamp',()=>{
  const a=fill({tid:101,sz:'0.2'}),b=fill({tid:102,sz:'0.3'});
  assert.notEqual(sourceFillId(target,a),sourceFillId(target,b));
  assert.notEqual(cloidFor(master,target,a),cloidFor(master,target,b));
});

test('deterministic cloid survives restart/retry',()=>{
  const f=fill({tid:999});
  const a=cloidFor(master,target,f),b=cloidFor(master,target,{...f});
  assert.equal(a,b);
  assert.match(a,/^0x[a-f0-9]{32}$/);
});

test('closing fill becomes reduce-only and cannot flip copied position',()=>{
  const p=planCopyFill({fill:fill({side:'A',sz:'5',dir:'Close Long',closedPnl:'3'}),scale:1,capital:1000,used:0,signed:1.25});
  assert.equal(p.kind,'execute');
  assert.equal(p.reduceOnly,true);
  assert.equal(p.size,1.25);
  assert.equal(applyLedgerPosition(1.25,'SELL',p.size,true),0);
});

test('opposite close signal is skipped instead of increasing exposure',()=>{
  const p=planCopyFill({fill:fill({side:'B',dir:'Close Long',closedPnl:'2'}),scale:1,capital:1000,used:0,signed:1});
  assert.equal(p.kind,'skip');
  assert.equal(p.reason,'not-reducing');
});

test('capital exhausted blocks new opening fill',()=>{
  const p=planCopyFill({fill:fill(),scale:1,capital:100,used:100,signed:0});
  assert.equal(p.kind,'block');
  assert.equal(p.reason,'capital-cap');
});

test('processed fill ledger prevents duplicate execution after restart',()=>{
  const c={processed:[]},id=sourceFillId(target,fill({tid:55}));
  assert.equal(isProcessed(c,id),false);
  markProcessed(c,id);
  assert.equal(isProcessed(c,id),true);
  const restored=JSON.parse(JSON.stringify(c));
  assert.equal(isProcessed(restored,id),true);
});

test('processed ledger stays bounded',()=>{
  const c={processed:[]};for(let i=0;i<20;i++)markProcessed(c,String(i),10);
  assert.equal(c.processed.length,10);
  assert.equal(c.processed[0],'10');
});

test('session max loss uses worst of equity and PnL loss across daily reset',()=>{
  assert.equal(sessionLoss({baselineEquity:1000,currentEquity:940,baselinePnl:50,currentPnl:0}),60);
  assert.equal(sessionLoss({baselineEquity:1000,currentEquity:995,baselinePnl:20,currentPnl:-30}),50);
});
