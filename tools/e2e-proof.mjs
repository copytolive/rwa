import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {verifyMessage} from 'viem';

const required=['wallet','collateral','agent','entry','position','tpsl','modify','cancel','close','history','pnl'];
const body=process.env.ISSUE_BODY||'';
const m=body.match(/E2E_PROOF_JSON_START[\s\S]*?```json\s*([\s\S]*?)```[\s\S]*?E2E_PROOF_JSON_END/);
if(!m)throw Error('E2E proof JSON block not found');
const p=JSON.parse(m[1]);
if(p.schema!==1||p.status!=='E2E_VERIFIED'||p.environment!=='testnet')throw Error('Invalid E2E proof schema/status/environment');
if(!/^0x[a-fA-F0-9]{40}$/.test(p.wallet||''))throw Error('Invalid proof wallet');
const verifiedAt=Number(p.verified_at),now=Date.now();
if(!verifiedAt||verifiedAt>now+5*60_000||now-verifiedAt>24*60*60_000)throw Error('E2E proof is stale or future-dated');
const timestamps=[];
for(const k of required){
  const r=p.evidence?.[k];
  if(!r||!Number(r.ts))throw Error(`Missing ${k} evidence`);
  if(k==='wallet'){if(r.source!=='wallet-signature')throw Error('Wallet evidence must be wallet-signature')}else if(r.source!=='venue')throw Error(`${k} evidence must be venue-backed`);
  timestamps.push(Number(r.ts));
}
const evidenceStart=Math.min(...timestamps),evidenceEnd=Math.max(...timestamps);
if(evidenceEnd-evidenceStart>60*60_000)throw Error('E2E evidence spans more than one hour');
if(evidenceStart>verifiedAt||verifiedAt-evidenceEnd>24*60*60_000)throw Error('E2E signed proof time does not match evidence session');
const hash=createHash('sha256').update(JSON.stringify(p.evidence)).digest('hex');
if(hash!==p.evidence_hash)throw Error('Evidence hash mismatch');
const expected=`RWA TESTNET E2E PROOF\nWallet: ${String(p.wallet).toLowerCase()}\nVerified At: ${p.verified_at}\nEvidence Hash: ${hash}`;
if(p.message!==expected)throw Error('Signed E2E message mismatch');
if(!await verifyMessage({address:p.wallet,message:p.message,signature:p.signature}))throw Error('E2E master-wallet signature invalid');

async function info(type,data={}){const r=await fetch('https://api.hyperliquid-testnet.xyz/info',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({type,...data}),signal:AbortSignal.timeout(15_000)});if(!r.ok)throw Error(`Hyperliquid testnet ${type} HTTP ${r.status}`);return r.json()}
const windowStart=Math.max(0,evidenceStart-120_000),windowEnd=evidenceEnd+120_000;
const [fills,orders,ch,portfolio,agents]=await Promise.all([
  info('userFillsByTime',{user:p.wallet,startTime:windowStart,endTime:windowEnd,aggregateByTime:false}),
  info('historicalOrders',{user:p.wallet}),
  info('clearinghouseState',{user:p.wallet}),
  info('portfolio',{user:p.wallet}),
  info('extraAgents',{user:p.wallet})
]);
if(!Array.isArray(fills)||fills.length<2)throw Error('Venue does not show enough testnet fills inside the E2E session');
const opened=fills.some(f=>String(f.dir||'').toLowerCase().includes('open'));
const closed=fills.some(f=>String(f.dir||'').toLowerCase().includes('close')||Number(f.closedPnl||0)!==0);
if(!opened||!closed)throw Error('E2E session must contain venue-backed open and close fills');
if(!Array.isArray(orders)||!orders.length)throw Error('Venue testnet order history is empty');
if(!ch||!Array.isArray(portfolio))throw Error('Venue account/PnL data unavailable');
if(!Array.isArray(agents)||!agents.length)throw Error('Venue does not show an approved API agent');

const orderTime=row=>Number(row?.statusTimestamp||row?.order?.timestamp||row?.timestamp||0);
const recentOrders=orders.filter(row=>{const t=orderTime(row);return t>=windowStart&&t<=windowEnd});
if(recentOrders.length<3)throw Error('Insufficient venue order history inside the E2E session');
const canceled=recentOrders.some(row=>/cancel/i.test(String(row?.status||'')));
if(!canceled)throw Error('Venue does not show the E2E cancel step');
const triggers=recentOrders.filter(row=>{const o=row?.order||row||{};return o.reduceOnly===true&&(o.isTrigger===true||Number(o.triggerPx||0)>0||/(stop|take.?profit|trigger)/i.test(String(o.orderType||'')+' '+String(o.triggerCondition||'')))});
if(triggers.length<2)throw Error('Venue does not show both TP/SL trigger children for the E2E bracket');

const idsFrom=s=>[...String(s||'').matchAll(/(?:order\s+|#)(\d+)/gi)].map(x=>Number(x[1])).filter(Number.isFinite);
const venueIds=new Set(recentOrders.map(row=>Number(row?.order?.oid??row?.oid)).filter(Number.isFinite));
for(const k of ['modify','cancel']){const ids=idsFrom(p.evidence?.[k]?.detail);if(ids.length&&!ids.some(id=>venueIds.has(id)))throw Error(`${k} evidence order id is not present in venue session history`)}
const agentDetail=String(p.evidence?.agent?.detail||'').match(/0x[a-fA-F0-9]{40}/)?.[0]?.toLowerCase();
if(!agentDetail)throw Error('E2E agent evidence does not contain the approved agent address');
const agent=agents.find(x=>String(x?.address||'').toLowerCase()===agentDetail);
if(!agent)throw Error('E2E agent address is not approved by the master wallet');
if(agent.validUntil&&Number(agent.validUntil)<evidenceEnd)throw Error('E2E agent authorization was expired during the proof session');

const registry=JSON.parse(await readFile('launch/e2e-registry.json','utf8')),wallet=String(p.wallet).toLowerCase(),entry={wallet,status:'E2E_VERIFIED',environment:'testnet',verified_at:verifiedAt,proof_hash:hash,issue:Number(process.env.ISSUE_NUMBER||0)||null,venue_checked_at:Date.now(),venue_window:{start:windowStart,end:windowEnd},venue_summary:{fills:fills.length,historical_orders:recentOrders.length,trigger_orders:triggers.length,agents:1,agent:agentDetail}};
registry.wallets=Array.isArray(registry.wallets)?registry.wallets:[];
const i=registry.wallets.findIndex(x=>String(x.wallet).toLowerCase()===wallet);
if(i>=0)registry.wallets[i]=entry;else registry.wallets.push(entry);
registry.updated_at=new Date().toISOString();
if(process.argv.includes('--write'))await writeFile('launch/e2e-registry.json',JSON.stringify(registry,null,2)+'\n');
console.log(JSON.stringify(entry,null,2));
