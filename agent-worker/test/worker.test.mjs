import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {RWAWorkerExecutionAPI,WORKER_SINGLE_WRITE_PATH} from '../execution.mjs';

test('worker execution API rejects invalid master wallet',()=>{
  assert.throws(()=>new RWAWorkerExecutionAPI({master:'0x123',agentPrivateKey:'0x'+'11'.repeat(32)}),/master/i);
});

test('worker exposes the single write path marker',()=>{
  assert.equal(WORKER_SINGLE_WRITE_PATH,'RWAWorkerExecutionAPI');
});

test('copy worker cannot instantiate ExchangeClient or expose withdrawals',async()=>{
  const worker=await readFile(new URL('../worker.mjs',import.meta.url),'utf8');
  const execution=await readFile(new URL('../execution.mjs',import.meta.url),'utf8');
  assert.equal(worker.includes('ExchangeClient'),false);
  assert.equal(/withdraw3|usdClassTransfer|spotSend|sendAsset/.test(worker),false);
  assert.equal(/withdraw3|usdClassTransfer|spotSend|sendAsset/.test(execution),false);
  assert.match(execution,/class RWAWorkerExecutionAPI/);
});
