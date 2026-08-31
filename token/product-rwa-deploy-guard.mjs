import fs from 'node:fs';
import {ethers} from 'ethers';

const config=JSON.parse(fs.readFileSync(new URL('./product-rwa-config.json',import.meta.url),'utf8'));
const network=String(process.argv.find(x=>x.startsWith('--network='))||'--network=testnet').split('=')[1];
const fail=m=>{console.error(`PRODUCT_RWA_DEPLOY_BLOCKED: ${m}`);process.exit(2)};
const address=(x,label)=>{if(!ethers.isAddress(String(x||''))||String(x).toLowerCase()===ethers.ZeroAddress)fail(`${label} address missing/invalid`);return ethers.getAddress(x)};
if(config.policy!=='CANONICAL_PRODUCT_RWA_MVP_V1')fail('canonical policy missing');
if(config.transfer_enabled!==false||config.secondary_market_enabled!==false)fail('MVP transfer/secondary market must remain OFF');
if(network==='mainnet'){
  if(config.mainnet_deployment_allowed!==true)fail('mainnet deployment is locked');
  fail('automatic Product RWA mainnet deployment is intentionally unsupported');
}
if(network!=='testnet')fail('only testnet planning is supported');
if(config.testnet_deployment_allowed!==true)fail('testnet deployment has not been explicitly approved');
const r=config.roles||{};
const roles={
  admin:address(r.admin,'admin'),inventory:address(r.inventory,'inventory'),mint_requester:address(r.mint_requester,'mint requester'),mint_approver:address(r.mint_approver,'mint approver'),mint_executor:address(r.mint_executor,'mint executor'),fulfillment:address(r.fulfillment,'fulfillment')
};
const sod=[roles.mint_requester,roles.mint_approver,roles.mint_executor].map(x=>x.toLowerCase());
if(new Set(sod).size!==sod.length)fail('mint requester, approver and executor must be separate addresses');
for(const artifact of [
  'build/contracts_ProductInventoryGate_sol_ProductInventoryGate.bin',
  'build/contracts_ProductRWA1155_sol_ProductRWA1155.bin',
  'build/contracts_RedemptionManager_sol_RedemptionManager.bin'
])if(!fs.existsSync(new URL(`./${artifact}`,import.meta.url)))fail(`compile artifact missing: ${artifact}`);
const plan={
  schema:1,kind:'UNSIGNED_PRODUCT_RWA_TESTNET_DEPLOYMENT_PLAN',network:'HyperEVM testnet',chain_id:998,rpc:config.network.testnet_rpc,generated_at:new Date().toISOString(),policy:config.policy,transfers:'OFF_IMMUTABLE_MVP',roles,
  sequence:[
    {step:1,contract:'ProductInventoryGate',constructor:[roles.admin]},
    {step:2,contract:'ProductRWA1155',constructor:[roles.admin,'<ProductInventoryGate address>']},
    {step:3,contract:'RedemptionManager',constructor:[roles.admin,'<ProductRWA1155 address>','<ProductInventoryGate address>']},
    {step:4,action:'grant ProductInventoryGate.INVENTORY_ROLE',to:roles.inventory},
    {step:5,action:'grant ProductInventoryGate.MINT_LEDGER_ROLE',to:'<ProductRWA1155 address>'},
    {step:6,action:'grant ProductInventoryGate.REDEMPTION_ROLE',to:'<RedemptionManager address>'},
    {step:7,action:'grant ProductRWA1155.CLASS_ADMIN_ROLE',to:roles.admin},
    {step:8,action:'grant ProductRWA1155.MINT_REQUEST_ROLE',to:roles.mint_requester},
    {step:9,action:'grant ProductRWA1155.MINT_APPROVER_ROLE',to:roles.mint_approver},
    {step:10,action:'grant ProductRWA1155.MINT_ROLE',to:roles.mint_executor},
    {step:11,action:'grant ProductRWA1155.BURNER_ROLE',to:'<RedemptionManager address>'},
    {step:12,action:'grant RedemptionManager.FULFILLMENT_ROLE',to:roles.fulfillment}
  ],
  required_post_deploy_evidence:['transaction_hashes','contract_addresses','chain_id_998_receipts','role_assignments','source_verification','testnet_mint_redeem_lifecycle','inventory_evidence_reference'],
  private_key_required_by_this_script:false
};
console.log(JSON.stringify(plan,null,2));
