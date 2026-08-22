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
if(!Number(p.verified_at)||Math.abs(Date.now()-Number(p.verified_at))>7*86400000)throw Error('E2E proof is stale');
for(const k of required){const r=p.evidence?.[k];if(!r||!Number(r.ts))throw Error(`Missing ${k} evidence`);if(k==='wallet'){if(r.source!=='wallet-signature')throw Error('Wallet evidence must be wallet-signature')}else if(r.source!=='venue')throw Error(`${k} evidence must be venue-backed`)}
const hash=createHash('sha256').update(JSON.stringify(p.evidence)).digest('hex');if(hash!==p.evidence_hash)throw Error('Evidence hash mismatch');
const expected=`RWA TESTNET E2E PROOF\nWallet: ${String(p.wallet).toLowerCase()}\nVerified At: ${p.verified_at}\nEvidence Hash: ${hash}`;
if(p.message!==expected)throw Error('Signed E2E message mismatch');
if(!await verifyMessage({address:p.wallet,message:p.message,signature:p.signature}))throw Error('E2E master-wallet signature invalid');
async function info(type,data={}){const r=await fetch('https://api.hyperliquid-testnet.xyz/info',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({type,...data}),signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error(`Hyperliquid testnet ${type} HTTP ${r.status}`);return r.json()}
const [fills,orders,ch,portfolio,agents]=await Promise.all([info('userFills',{user:p.wallet}),info('historicalOrders',{user:p.wallet}),info('clearinghouseState',{user:p.wallet}),info('portfolio',{user:p.wallet}),info('extraAgents',{user:p.wallet})]);
if(!Array.isArray(fills)||fills.length<2)throw Error('Venue does not show enough testnet fills for entry + close');
if(!Array.isArray(orders)||orders.length<1)throw Error('Venue testnet order history is empty');
if(!ch||!Array.isArray(portfolio))throw Error('Venue account/PnL data unavailable');
if(!Array.isArray(agents)||!agents.length)throw Error('Venue does not show an approved API agent');
const registry=JSON.parse(await readFile('launch/e2e-registry.json','utf8')),wallet=String(p.wallet).toLowerCase(),entry={wallet,status:'E2E_VERIFIED',environment:'testnet',verified_at:Number(p.verified_at),proof_hash:hash,issue:Number(process.env.ISSUE_NUMBER||0)||null,venue_checked_at:Date.now(),venue_summary:{fills:fills.length,historical_orders:orders.length,agents:agents.length}};
registry.wallets=Array.isArray(registry.wallets)?registry.wallets:[];const i=registry.wallets.findIndex(x=>String(x.wallet).toLowerCase()===wallet);if(i>=0)registry.wallets[i]=entry;else registry.wallets.push(entry);registry.updated_at=new Date().toISOString();
if(process.argv.includes('--write'))await writeFile('launch/e2e-registry.json',JSON.stringify(registry,null,2)+'\n');
console.log(JSON.stringify(entry,null,2));
