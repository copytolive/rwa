import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {RWAWorkerExecutionAPI,WORKER_SINGLE_WRITE_PATH,WORKER_IDEMPOTENCY} from '../execution.mjs';

test('worker execution API rejects invalid master wallet',()=>{
  assert.throws(()=>new RWAWorkerExecutionAPI({master:'0x123',agentPrivateKey:'0x'+'11'.repeat(32)}),/master/i);
});

test('worker exposes single write and idempotency markers',()=>{
  assert.equal(WORKER_SINGLE_WRITE_PATH,'RWAWorkerExecutionAPI');
  assert.equal(WORKER_IDEMPOTENCY,'deterministic-cloid-v1');
});

test('copy worker cannot instantiate ExchangeClient or expose fund movement',async()=>{
  const worker=await readFile(new URL('../worker.mjs',import.meta.url),'utf8');
  const execution=await readFile(new URL('../execution.mjs',import.meta.url),'utf8');
  assert.equal(worker.includes('ExchangeClient'),false);
  assert.equal(/withdraw3|usdClassTransfer|spotSend|sendAsset/.test(worker),false);
  assert.equal(/withdraw3|usdClassTransfer|spotSend|sendAsset/.test(execution),false);
  assert.match(execution,/class RWAWorkerExecutionAPI/);
});

test('worker has replay protection, origin binding and deterministic cloid path',async()=>{
  const worker=await readFile(new URL('../worker.mjs',import.meta.url),'utf8');
  const execution=await readFile(new URL('../execution.mjs',import.meta.url),'utf8');
  assert.match(worker,/consumeNonce/);
  assert.match(worker,/RWA_PUBLIC_ORIGIN/);
  assert.match(worker,/sourceFillId/);
  assert.match(worker,/cloidFor/);
  assert.match(worker,/copy\.retry_pending/);
  assert.match(execution,/orderStatus/);
  assert.match(execution,/CLOID_TERMINAL/);
  assert.match(execution,/c:String\(cloid\)/);
});
