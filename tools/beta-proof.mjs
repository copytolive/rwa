import fs from 'node:fs';
import {verifyMessage} from 'ethers';

const fail=msg=>{fs.writeFileSync('beta-proof-error.txt',String(msg));console.error(msg);process.exit(1)};
const ADDRESS=/^0x[a-fA-F0-9]{40}$/;
const PHASES={internal:{rank:1,minMs:5*60*1000},closed:{rank:2,minMs:15*60*1000},public:{rank:3,minMs:30*60*1000}};
const short=w=>`${w.slice(0,6)}…${w.slice(-4)}`;
async function json(url,payload=null){const r=await fetch(url,{method:payload?'POST':'GET',headers:{'content-type':'application/json'},body:payload?JSON.stringify(payload):undefined,cache:'no-store',signal:AbortSignal.timeout(10000)});if(!r.ok)throw Error(`${url} HTTP ${r.status}`);return r.json()}

try{
  const body=process.env.ISSUE_BODY||'';
  const m=body.match(/BETA_PROOF_JSON_START[\s\S]*?```json\s*([\s\S]*?)```[\s\S]*?BETA_PROOF_JSON_END/i);
  if(!m)fail('Missing beta proof JSON package');
  const p=JSON.parse(m[1]),wallet=String(p.wallet||'').toLowerCase(),phase=String(p.phase||'').toLowerCase(),worker=String(p.worker||'').replace(/\/$/,'');
  if(!ADDRESS.test(wallet))fail('Invalid beta wallet');
  if(!PHASES[phase])fail('Invalid beta phase');
  if(p.environment!=='testnet')fail('Beta proof must use testnet');
  if(!/^https:\/\//i.test(worker))fail('Beta worker must be HTTPS');
  const start=Number(p.started_at),end=Number(p.ended_at),now=Date.now();
  if(!(start>0&&end>start))fail('Invalid beta session time range');
  if(end-start<PHASES[phase].minMs)fail(`Beta ${phase} session is too short`);
  if(end>now+5*60*1000||now-end>24*60*60*1000)fail('Beta proof is stale or future-dated');
  const expected=`RWA BETA TESTNET PROOF\nWallet: ${wallet}\nPhase: ${phase}\nWorker: ${worker}\nStarted At: ${start}\nEnded At: ${end}`;
  if(p.message!==expected)fail('Beta proof message mismatch');
  if(!p.signature)fail('Beta proof signature missing');
  if(String(verifyMessage(p.message,p.signature)).toLowerCase()!==wallet)fail('Beta wallet signature mismatch');

  const cfg=JSON.parse(fs.readFileSync('agent-worker/public-config.json','utf8'));
  const official=String(cfg.base_url||'').replace(/\/$/,'');
  if(!cfg.enabled||official!==worker)fail('Beta proof does not use the enabled official worker');
  const [health,status]=await Promise.all([json(worker+'/healthz'),json(worker+'/status')]);
  if(!health.ok||health.kill_switch||health.control_enabled!==true||health.production_ready!==true||health.origin_bound!==true)fail('Official worker is not production-ready and active');
  if(health.single_write_path!=='RWAWorkerExecutionAPI'||health.idempotency!=='deterministic-cloid-v1')fail('Worker safety contract mismatch');
  if(status.single_write_path!=='RWAWorkerExecutionAPI'||status.idempotency!=='deterministic-cloid-v1')fail('Worker status safety contract mismatch');
  if(Number(status.metrics?.executed||0)+Number(status.metrics?.replay_confirmed||0)<1)fail('Worker has no verified copy execution activity');

  const workerUser=(status.users||[]).find(x=>x?.master===short(wallet));
  if(!workerUser)fail('Wallet has no matching 24/7 worker registration');
  if(workerUser.copy?.testnet!==true)fail('Wallet worker session is not TESTNET');
  if(Number(workerUser.copy?.processed||0)<1)fail('Wallet worker session has no processed source fill evidence');
  const workerStart=Number(workerUser.copy?.startedAt||0),workerLast=Number(workerUser.copy?.lastTime||0);
  if(!(workerStart>0)||Math.abs(workerStart-start)>5*60*1000)fail('Signed beta start does not match the worker session');
  if(workerLast&&workerLast<start-60*1000)fail('Worker session has no source activity in the signed beta window');
  if(workerLast>end+5*60*1000)fail('Worker source activity timestamp exceeds signed beta window');

  const fills=await json('https://api.hyperliquid-testnet.xyz/info',{type:'userFillsByTime',user:wallet,startTime:start,endTime:end,aggregateByTime:false});
  if(!Array.isArray(fills)||fills.length<2)fail('Insufficient Hyperliquid testnet fills during beta session');
  const opened=fills.some(f=>String(f.dir||'').toLowerCase().includes('open'));
  const closed=fills.some(f=>String(f.dir||'').toLowerCase().includes('close')||Number(f.closedPnl||0)!==0);
  if(!opened||!closed)fail('Beta session must include venue-backed open and close activity');

  const reg=JSON.parse(fs.readFileSync('launch/beta-registry.json','utf8'));
  reg.proofs=Array.isArray(reg.proofs)?reg.proofs:[];
  const proof={wallet,phase,environment:'testnet',worker,started_at:start,ended_at:end,verified_at:now,fill_count:fills.length,closed_fill_count:fills.filter(f=>String(f.dir||'').toLowerCase().includes('close')||Number(f.closedPnl||0)!==0).length,worker_version:String(health.version||''),worker_processed:Number(workerUser.copy?.processed||0),worker_last_source_time:workerLast,worker_executions:Number(status.metrics?.executed||0),status:'VERIFIED'};
  const i=reg.proofs.findIndex(x=>String(x.wallet||'').toLowerCase()===wallet);
  if(i>=0&&PHASES[String(reg.proofs[i].phase||'internal')]?.rank>PHASES[phase].rank)fail('Beta phase downgrade is not allowed');
  if(i>=0)reg.proofs[i]=proof;else reg.proofs.push(proof);
  reg.updated_at=new Date().toISOString().slice(0,10);
  fs.writeFileSync('launch/beta-registry.json',JSON.stringify(reg,null,2)+'\n');
  fs.writeFileSync('beta-proof-success.txt',JSON.stringify({wallet,phase,fill_count:fills.length,worker_processed:Number(workerUser.copy?.processed||0),verified_at:now}));
  console.log(`BETA VERIFIED ${phase} ${wallet} fills=${fills.length} processed=${workerUser.copy?.processed||0}`);
}catch(e){fail(e?.stack||e)}
