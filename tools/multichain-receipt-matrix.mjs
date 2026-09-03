import {readFile} from 'node:fs/promises';

const FILE='launch/multichain-receipts.json';
const required=['EVM_TO_EVM','EVM_TO_SOLANA','SOLANA_TO_EVM','SAME_CHAIN','FAILURE_OR_REFUND'];
const evmHash=x=>/^0x[a-fA-F0-9]{64}$/.test(String(x||''));
const solSig=x=>/^[1-9A-HJ-NP-Za-km-z]{64,100}$/.test(String(x||''));
const https=x=>/^https:\/\/[^\s]+$/i.test(String(x||''));
const family=x=>['EVM','SVM'].includes(String(x||''));
const terminal=x=>['DONE','SUCCESS','COMPLETED','REFUNDED','FAILED'].includes(String(x||'').toUpperCase());

const doc=JSON.parse(await readFile(FILE,'utf8'));
const errors=[];
if(doc?.schema!==1)errors.push('schema must be 1');
if(!Array.isArray(doc?.receipts))errors.push('receipts must be an array');
const rows=Array.isArray(doc?.receipts)?doc.receipts:[];
for(const kind of required){
  const matches=rows.filter(x=>x?.kind===kind);
  if(matches.length!==1)errors.push(`${kind} must have exactly one receipt row`);
}

function verified(row){
  if(!row||row.status!=='VERIFIED')return false;
  if(!(Number(row.amount)>0))return false;
  if(!https(row.evidence_url))return false;
  if(!terminal(row.provider_status))return false;
  if(row.kind==='FAILURE_OR_REFUND')return ['FAILED','REFUNDED'].includes(String(row.provider_status).toUpperCase())&&(evmHash(row.tx_hash)||solSig(row.tx_hash));
  if(!family(row.source_family)||!family(row.destination_family))return false;
  const sourceOk=row.source_family==='SVM'?solSig(row.tx_hash):evmHash(row.tx_hash);
  if(!sourceOk)return false;
  if(row.kind==='EVM_TO_EVM'&&(row.source_family!=='EVM'||row.destination_family!=='EVM'))return false;
  if(row.kind==='EVM_TO_SOLANA'&&(row.source_family!=='EVM'||row.destination_family!=='SVM'))return false;
  if(row.kind==='SOLANA_TO_EVM'&&(row.source_family!=='SVM'||row.destination_family!=='EVM'))return false;
  if(row.kind==='SAME_CHAIN'&&row.source_network!==row.destination_network)return false;
  return true;
}

const checks=Object.fromEntries(required.map(kind=>{
  const row=rows.find(x=>x?.kind===kind);
  return[kind,{ok:verified(row),status:row?.status||'MISSING',provider_status:row?.provider_status||'',id:row?.id||''}];
}));
const ready=errors.length===0&&Object.values(checks).every(x=>x.ok);
const report={schema:1,contract:'rwa-multichain-real-receipt-matrix-v1',ready,status:ready?'VERIFIED':'BLOCKED',required,checks,errors};
console.log(JSON.stringify(report,null,2));
if(errors.length)process.exit(2);
if(process.argv.includes('--require')&&!ready)process.exit(3);
