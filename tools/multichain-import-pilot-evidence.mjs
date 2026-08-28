import {readFile,writeFile} from 'node:fs/promises';

const src=process.argv[2];
if(!src){
  console.error('usage: node tools/multichain-import-pilot-evidence.mjs <multichain-real-receipts.json> [--write]');
  process.exit(64);
}
const data=JSON.parse(await readFile(src,'utf8'));
const required=['EVM_TO_EVM','EVM_TO_SOLANA','SOLANA_TO_EVM','SAME_CHAIN','FAILURE_OR_REFUND'];
const evmHash=x=>/^0x[a-fA-F0-9]{64}$/.test(String(x||''));
const solSig=x=>/^[1-9A-HJ-NP-Za-km-z]{64,100}$/.test(String(x||''));
const https=x=>/^https:\/\//i.test(String(x||''));
const receipts=Array.isArray(data?.receipts)?data.receipts:[];
const fail=[];
const canonical=[];
for(const kind of required){
  const r=receipts.find(x=>x?.kind===kind);
  if(!r){fail.push(`${kind}: missing`);continue}
  const amount=Number(r.amount||0);
  const provider=String(r.provider_status||'').toUpperCase();
  const sourceFamily=String(r.source_family||'').toUpperCase();
  const hashOk=sourceFamily==='SVM'?solSig(r.tx_hash):evmHash(r.tx_hash);
  const terminal=kind==='FAILURE_OR_REFUND'?['FAILED','REFUNDED'].includes(provider):['DONE','SUCCESS','COMPLETED'].includes(provider);
  if(r.status!=='VERIFIED')fail.push(`${kind}: status must be VERIFIED`);
  if(!(amount>0))fail.push(`${kind}: amount must be >0`);
  if(!hashOk)fail.push(`${kind}: invalid real transaction hash/signature`);
  if(!https(r.evidence_url))fail.push(`${kind}: HTTPS evidence_url required`);
  if(!terminal)fail.push(`${kind}: provider_status not terminal (${provider||'blank'})`);
  canonical.push({
    id:String(r.id||kind.toLowerCase().replaceAll('_','-')),
    kind,
    status:'VERIFIED',
    source_network:String(r.source_network||''),
    destination_network:String(r.destination_network||''),
    source_family:String(r.source_family||''),
    destination_family:String(r.destination_family||''),
    token:String(r.token||'USDC'),
    amount,
    tx_hash:String(r.tx_hash||''),
    provider_status:provider,
    evidence_url:String(r.evidence_url||''),
    captured_at:String(r.captured_at||'')
  });
}
const hf=data?.hyperliquid_funding||null;
const fundingOk=hf?.status==='VERIFIED'&&evmHash(hf?.tx_hash)&&https(hf?.evidence_url)&&Number(hf?.after_account_value)>=100&&Number(hf?.target_account_value)>=100;
if(hf&&!fundingOk)fail.push('HYPERLIQUID_FUNDING: receipt present but builder target/evidence is not verified');
const report={ok:fail.length===0,required,verified:canonical.filter(x=>x.status==='VERIFIED').length,hyperliquid_funding_verified:Boolean(fundingOk),fail};
console.log(JSON.stringify(report,null,2));
if(fail.length)process.exit(2);
if(process.argv.includes('--write')){
  const out={schema:1,version:'1.0.0',status:'VERIFIED',evidence_policy:'real-provider-receipt-v1',required,receipts:canonical,imported_at:new Date().toISOString(),source_export:src};
  await writeFile('launch/multichain-receipts.json',JSON.stringify(out,null,2)+'\n');
  if(hf)await writeFile('launch/hyperliquid-funding-evidence.json',JSON.stringify(hf,null,2)+'\n');
}
