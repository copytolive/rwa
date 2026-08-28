import {readFile,writeFile} from 'node:fs/promises';

const read=async p=>JSON.parse(await readFile(p,'utf8'));
const https=x=>/^https:\/\/[^\s]+$/i.test(String(x||''));
const evm=x=>/^0x[a-fA-F0-9]{40}$/.test(String(x||''));
const evmHash=x=>/^0x[a-fA-F0-9]{64}$/.test(String(x||''));
const solSig=x=>/^[1-9A-HJ-NP-Za-km-z]{64,100}$/.test(String(x||''));
const terminal=x=>['DONE','SUCCESS','COMPLETED','REFUNDED','FAILED'].includes(String(x||'').toUpperCase());
const required=['EVM_TO_EVM','EVM_TO_SOLANA','SOLANA_TO_EVM','SAME_CHAIN','FAILURE_OR_REFUND'];
const [matrix,revenue,funding]=await Promise.all([
  read('launch/multichain-receipts.json'),
  read('rwa-multichain-revenue.json'),
  read('rwa-multichain-funding.json')
]);
const rows=Array.isArray(matrix?.receipts)?matrix.receipts:[];
function receiptOk(row){
  if(!row||row.status!=='VERIFIED'||!(Number(row.amount)>0)||!https(row.evidence_url)||!terminal(row.provider_status))return false;
  if(row.kind==='FAILURE_OR_REFUND')return ['FAILED','REFUNDED'].includes(String(row.provider_status).toUpperCase())&&(evmHash(row.tx_hash)||solSig(row.tx_hash));
  const hashOk=row.source_family==='SVM'?solSig(row.tx_hash):row.source_family==='EVM'?evmHash(row.tx_hash):false;
  if(!hashOk)return false;
  if(row.kind==='EVM_TO_EVM')return row.source_family==='EVM'&&row.destination_family==='EVM';
  if(row.kind==='EVM_TO_SOLANA')return row.source_family==='EVM'&&row.destination_family==='SVM';
  if(row.kind==='SOLANA_TO_EVM')return row.source_family==='SVM'&&row.destination_family==='EVM';
  if(row.kind==='SAME_CHAIN')return row.source_network===row.destination_network;
  return false;
}
const receiptChecks=Object.fromEntries(required.map(k=>[k,receiptOk(rows.find(x=>x?.kind===k))]));
const receiptsReady=required.every(k=>receiptChecks[k]===true);
const lifi=revenue?.lifi||{};
const hl=revenue?.hyperliquid||{};
const hf=funding?.hyperliquid||{};
const lifiProviderReady=lifi.enabled===true&&lifi.partner_configured===true&&lifi.payout_wallet_configured_externally===true&&Number(lifi.fee_bps)>0&&Number(lifi.fee_decimal)>0&&https(lifi.evidence_url);
const hyperliquidBuilderReady=hl.enabled===true&&hl.builder_wallet_configured===true&&evm(hl.builder_address)&&Number(hl.perp_fee_tenths_bp)>0&&https(hl.evidence_url);
const hyperliquidFundingReady=hf.enabled===true&&hf.adapter_verified===true&&hf.legacy_bridge_direct_write===false&&https(hf.evidence_url);
const policyOk=revenue?.policy?.never_charge_without_provider_confirmation===true&&revenue?.policy?.no_hidden_fee===true&&revenue?.policy?.fail_closed===true&&funding?.policy?.no_direct_legacy_bridge_write===true&&funding?.policy?.final_hyperliquid_handoff_fail_closed===true;
const checks={
  real_receipt_matrix:{ok:receiptsReady,detail:required.map(k=>`${k}=${receiptChecks[k]?'VERIFIED':'PENDING'}`).join(' · ')},
  lifi_provider_approval:{ok:lifiProviderReady,detail:lifiProviderReady?'provider fee/payout approval verified':'LI.FI partner+payout approval evidence required before fee activation'},
  hyperliquid_builder_approval:{ok:hyperliquidBuilderReady,detail:hyperliquidBuilderReady?'builder address/fee approval verified':'Hyperliquid builder eligibility, builder address and fee approval evidence required'},
  hyperliquid_funding_adapter:{ok:hyperliquidFundingReady,detail:hyperliquidFundingReady?'current deposit adapter verified':'current Hyperliquid CCTP/official deposit adapter evidence required; legacy bridge direct write remains disabled'},
  fail_closed_policy:{ok:policyOk,detail:policyOk?'provider-confirmed visible-fee and funding fail-closed policies present':'required fail-closed policy markers missing'}
};
const blockers=Object.entries(checks).filter(([,v])=>!v.ok).map(([gate,v])=>({gate,detail:v.detail}));
const ready=blockers.length===0;
const out={schema:1,generated_at:new Date().toISOString(),status:ready?'READY':'BLOCKED',ready,execution_unlock_requires:'GLOBAL_READY_FOR_MAINNET_AND_MULTICHAIN_READY',checks,blockers,revenue_mode:revenue?.mode||'UNKNOWN',funding_mode:funding?.mode||'UNKNOWN'};
if(process.argv.includes('--write'))await writeFile('launch/multichain-readiness.json',JSON.stringify(out,null,2)+'\n');
console.log(JSON.stringify(out,null,2));
if(process.argv.includes('--require')&&!ready)process.exit(3);
