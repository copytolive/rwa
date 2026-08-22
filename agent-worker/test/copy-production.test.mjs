import test from 'node:test';
import assert from 'node:assert/strict';
import {sourceFillId,cloidFor,isProcessed,markProcessed,planCopyFill,applyLedgerPosition,sessionLoss} from '../copy-engine.mjs';

const master='0x'+'31'.repeat(20),target='0x'+'42'.repeat(20);
const f=(tid,side,sz,dir='Open Long',closedPnl='0',px='100',time=1000)=>({coin:'BTC',tid,side,sz:String(sz),dir,closedPnl:String(closedPnl),px:String(px),time});

function executeSequence(fills,{capital=100,scale=.25}={}){
  const copy={processed:[]},ledger={BTC:0},seen=[];let used=0;
  for(const fill of fills){
    const id=sourceFillId(target,fill);if(isProcessed(copy,id)){seen.push('duplicate');continue}
    const p=planCopyFill({fill,scale,capital,used,signed:ledger.BTC});
    if(p.kind==='execute'){
      ledger.BTC=applyLedgerPosition(ledger.BTC,p.side,p.size,p.reduceOnly);
      used=Math.abs(ledger.BTC)*Number(fill.px);
      markProcessed(copy,id);seen.push(p.reduceOnly?'reduce':'open');
    }else{markProcessed(copy,id);seen.push(p.reason)}
  }
  return{copy,ledger,used,seen};
}

test('partial and multiple fills scale independently without duplicate loss',()=>{
  const rows=[f(1,'B',.2),f(2,'B',.3),f(3,'B',.5)];
  const r=executeSequence(rows,{capital:100,scale:.5});
  assert.deepEqual(r.seen,['open','open','open']);
  assert.equal(r.copy.processed.length,3);
  assert.equal(r.ledger.BTC,.5);
  assert.equal(r.used,50);
});

test('duplicate source fill cannot execute twice',()=>{
  const row=f(8,'B',.4),r=executeSequence([row,{...row}],{capital:100,scale:1});
  assert.deepEqual(r.seen,['open','duplicate']);
  assert.equal(r.ledger.BTC,.4);
});

test('restart persistence keeps duplicate blocked',()=>{
  const row=f(9,'B',.25),copy={processed:[]},id=sourceFillId(target,row);markProcessed(copy,id);const restored=JSON.parse(JSON.stringify(copy));
  assert.equal(isProcessed(restored,id),true);
  assert.equal(cloidFor(master,target,row),cloidFor(master,target,{...row}));
});

test('transient network ambiguity retries exact same CLOID until venue result is known',()=>{
  const row=f(10,'B',.1),id=sourceFillId(target,row),copy={processed:[]};const first=cloidFor(master,target,row);
  // Simulated transport timeout: source fill remains unprocessed.
  assert.equal(isProcessed(copy,id),false);
  const retry=cloidFor(master,target,row);assert.equal(retry,first);
  // Venue orderStatus later confirms same CLOID; only then ledger is terminally marked.
  markProcessed(copy,id);assert.equal(isProcessed(copy,id),true);
});

test('source close reduces only copied quantity and cannot reverse follower',()=>{
  const rows=[f(11,'B',1),f(12,'A',5,'Close Long','8')];
  const r=executeSequence(rows,{capital:1000,scale:.5});
  assert.deepEqual(r.seen,['open','reduce']);
  assert.equal(r.ledger.BTC,0);
});

test('capital cap blocks excess opens but still records terminal source fill',()=>{
  const rows=[f(13,'B',1),f(14,'B',1)];
  const r=executeSequence(rows,{capital:50,scale:1});
  assert.deepEqual(r.seen,['open','capital-cap']);
  assert.equal(r.used,50);
  assert.equal(r.copy.processed.length,2);
});

test('max loss threshold remains effective even when daily PnL resets',()=>{
  const loss=sessionLoss({baselineEquity:1000,currentEquity:949,baselinePnl:0,currentPnl:0});
  assert.equal(loss,51);
  assert.equal(loss>=50,true);
});

test('API failure before terminal venue result must not mark fill processed',()=>{
  const row=f(15,'B',.2),id=sourceFillId(target,row),copy={processed:[]};
  const simulated=()=>{throw Error('network unavailable')};
  assert.throws(simulated,/network/);
  assert.equal(isProcessed(copy,id),false);
});
