import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import solc from 'solc';
import ganache from 'ganache';
import {ethers} from 'ethers';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const read=rel=>fs.readFileSync(path.join(root,rel),'utf8');
function findImports(importPath){
  for(const p of [path.join(root,importPath),path.join(root,'contracts',importPath),path.join(root,'node_modules',importPath)])if(fs.existsSync(p))return{contents:fs.readFileSync(p,'utf8')};
  return{error:`Import not found: ${importPath}`};
}
function compile(){
  const sources={};
  for(const f of ['contracts/ProductInventoryGate.sol','contracts/ProductRWA1155.sol','contracts/RedemptionManager.sol'])sources[f]={content:read(f)};
  const input={language:'Solidity',sources,settings:{optimizer:{enabled:true,runs:200},outputSelection:{'*':{'*':['abi','evm.bytecode.object']}}}};
  const output=JSON.parse(solc.compile(JSON.stringify(input),{import:findImports}));
  const errors=(output.errors||[]).filter(x=>x.severity==='error');
  if(errors.length)throw new Error(errors.map(x=>x.formattedMessage).join('\n'));
  return output.contracts;
}
function artifact(contracts,file,name){const a=contracts[file]?.[name];assert.ok(a?.evm?.bytecode?.object,`Missing ${name}`);return a}
async function deploy(a,signer,args=[]){const f=new ethers.ContractFactory(a.abi,'0x'+a.evm.bytecode.object,signer);const c=await f.deploy(...args);await c.waitForDeployment();return c}
async function send(label,promise){try{const tx=await promise;await tx.wait();return tx}catch(e){throw new Error(`${label}: ${e.shortMessage||e.message}`,{cause:e})}}
async function expectRevert(fn,label){let reverted=false;try{const x=await fn();if(x?.wait)await x.wait();if(x?.waitForDeployment)await x.waitForDeployment()}catch{reverted=true}assert.equal(reverted,true,label)}
const hash=s=>ethers.keccak256(ethers.toUtf8Bytes(s));

const contracts=compile();
const gateA=artifact(contracts,'contracts/ProductInventoryGate.sol','ProductInventoryGate');
const tokenA=artifact(contracts,'contracts/ProductRWA1155.sol','ProductRWA1155');
const redeemA=artifact(contracts,'contracts/RedemptionManager.sol','RedemptionManager');
const rpc=ganache.provider({logging:{quiet:true},wallet:{totalAccounts:10,defaultBalance:1000}});
const provider=new ethers.BrowserProvider(rpc);provider.pollingInterval=50;
const admin=await provider.getSigner(0),inventory=await provider.getSigner(1),requester=await provider.getSigner(2),approver=await provider.getSigner(3),minter=await provider.getSigner(4),fulfillment=await provider.getSigner(5),buyer=await provider.getSigner(6),outsider=await provider.getSigner(7);
const adminAddress=await admin.getAddress(),buyerAddress=await buyer.getAddress(),outsiderAddress=await outsider.getAddress();

const gate=await deploy(gateA,admin,[adminAddress]);
const token=await deploy(tokenA,admin,[adminAddress,await gate.getAddress()]);
const redemption=await deploy(redeemA,admin,[adminAddress,await token.getAddress(),await gate.getAddress()]);
await send('grant inventory role',gate.connect(admin).grantRole(await gate.INVENTORY_ROLE(),await inventory.getAddress()));
await send('grant token mint-ledger role',gate.connect(admin).grantRole(await gate.MINT_LEDGER_ROLE(),await token.getAddress()));
await send('grant redemption gate role',gate.connect(admin).grantRole(await gate.REDEMPTION_ROLE(),await redemption.getAddress()));
await send('grant class admin',token.connect(admin).grantRole(await token.CLASS_ADMIN_ROLE(),adminAddress));
await send('grant mint requester',token.connect(admin).grantRole(await token.MINT_REQUEST_ROLE(),await requester.getAddress()));
await send('grant mint approver',token.connect(admin).grantRole(await token.MINT_APPROVER_ROLE(),await approver.getAddress()));
await send('grant mint executor',token.connect(admin).grantRole(await token.MINT_ROLE(),await minter.getAddress()));
await send('grant redemption burner',token.connect(admin).grantRole(await token.BURNER_ROLE(),await redemption.getAddress()));
await send('grant fulfillment',redemption.connect(admin).grantRole(await redemption.FULFILLMENT_ROLE(),await fulfillment.getAddress()));

const tokenId=1n;
const entitlement={productFamilyHash:hash('FOOTWEAR-WH001'),skuHash:hash('SKU-001'),batchLotHash:hash('BATCH-001'),quantityPerToken:1n,redemptionUnit:'PAIR',optionsHash:hash('SIZE-COLOR-TERMS'),geographyHash:hash('INDONESIA'),expiry:0,exclusionsHash:hash('TERMS-EXCLUSIONS'),metadataURI:'https://evidence.example/product-rwa/1.json',active:true};
await send('configure entitlement',token.connect(admin).setEntitlement(tokenId,entitlement));
const stored=await token.entitlement(tokenId);assert.equal(stored.redemptionUnit,'PAIR');assert.equal(stored.active,true);assert.equal(await token.uri(tokenId),entitlement.metadataURI);
await expectRevert(()=>token.connect(admin).setEntitlement(2n,{...entitlement,productFamilyHash:ethers.ZeroHash}),'class without product-family entitlement must fail');

await send('set initial inventory',gate.connect(inventory).setInventory(tokenId,100n,10n,5n,hash('COUNT-001')));
assert.equal(await gate.additionalMintable(tokenId),85n,'canonical additional mintable formula mismatch');
let coverage=await gate.coverage(tokenId);assert.equal(coverage[0],false,'coverage must be N/A when outstanding is zero');assert.equal(coverage[2],0n);
await expectRevert(()=>gate.connect(inventory).setInventory(tokenId,100n,10n,5n,ethers.ZeroHash),'inventory evidence is mandatory');

const requestEvidence=hash('MINT-REQUEST-COUNT-001'),approvalEvidence=hash('MINT-APPROVAL-001');
const reqId=await token.nextRequestId();
await send('mint request',token.connect(requester).requestMint(tokenId,buyerAddress,50n,requestEvidence));
await send('temporarily grant requester approver role',token.connect(admin).grantRole(await token.MINT_APPROVER_ROLE(),await requester.getAddress()));
await expectRevert(()=>token.connect(requester).approveMint(reqId,approvalEvidence),'requester must not self-approve');
await send('independent mint approval',token.connect(approver).approveMint(reqId,approvalEvidence));
await send('set low inventory before execution',gate.connect(inventory).setInventory(tokenId,40n,10n,5n,hash('COUNT-LOW')));
await expectRevert(()=>token.connect(minter).executeMint(reqId),'approved mint must fail if inventory fell before execution');
await send('restore verified inventory',gate.connect(inventory).setInventory(tokenId,100n,10n,5n,hash('COUNT-RESTORED')));
await expectRevert(()=>token.connect(approver).executeMint(reqId),'approver without mint execution authority must fail');
await send('execute inventory-gated mint',token.connect(minter).executeMint(reqId));
assert.equal(await token.balanceOf(buyerAddress,tokenId),50n,'minted entitlement balance mismatch');
let inv=await gate.inventory(tokenId);assert.equal(inv.outstanding,50n,'outstanding liability must increase with mint');assert.equal(await gate.additionalMintable(tokenId),35n,'post-mint eligibility mismatch');
coverage=await gate.coverage(tokenId);assert.equal(coverage[0],true);assert.equal(coverage[3],18000n,'coverage should be 1.80x');
await expectRevert(()=>token.connect(buyer).safeTransferFrom(buyerAddress,outsiderAddress,tokenId,1n,'0x'),'MVP holder transfer must stay disabled');

const req2=await token.nextRequestId();await send('second mint request',token.connect(requester).requestMint(tokenId,buyerAddress,1n,hash('REQ-2')));await expectRevert(()=>token.connect(requester).approveMint(req2,hash('APP-2')),'same actor request+approval must be rejected');await send('cancel unapproved mint',token.connect(requester).cancelMint(req2));

const redemptionId=await redemption.nextRedemptionId();
await send('reserve redemption',redemption.connect(buyer).requestRedemption(tokenId,10n,hash('REDEEM-REQ-1')));
assert.equal(await redemption.lockedForRedemption(buyerAddress,tokenId),10n);inv=await gate.inventory(tokenId);assert.equal(inv.redeemReserved,10n);
await expectRevert(()=>redemption.connect(buyer).requestRedemption(tokenId,41n,hash('DOUBLE-CLAIM')),'locked tokens must block duplicate redeem claims');
await expectRevert(()=>redemption.connect(outsider).markPickPack(redemptionId,hash('PICK')),'unauthorized fulfillment action must fail');
await expectRevert(()=>redemption.connect(fulfillment).closeRedemption(redemptionId),'token must not burn before delivered state');
await send('mark pick pack',redemption.connect(fulfillment).markPickPack(redemptionId,hash('PICK-1')));
await send('mark shipped',redemption.connect(fulfillment).markShipped(redemptionId,hash('SHIP-1')));
await send('mark delivered',redemption.connect(fulfillment).markDelivered(redemptionId,hash('DELIVERY-1')));
await send('close delivered redemption',redemption.connect(fulfillment).closeRedemption(redemptionId));
assert.equal(await token.balanceOf(buyerAddress,tokenId),40n,'delivered entitlement must burn exactly once');assert.equal(await redemption.lockedForRedemption(buyerAddress,tokenId),0n);
inv=await gate.inventory(tokenId);assert.equal(inv.outstanding,40n);assert.equal(inv.verifiedRedeemable,90n);assert.equal(inv.redeemReserved,0n);
await expectRevert(()=>redemption.connect(fulfillment).closeRedemption(redemptionId),'closed redemption cannot be closed twice');

const cancelId=await redemption.nextRedemptionId();await send('reserve cancellable redemption',redemption.connect(buyer).requestRedemption(tokenId,5n,hash('REDEEM-CANCEL')));await send('cancel redemption',redemption.connect(buyer).cancelRedemption(cancelId));
assert.equal(await redemption.lockedForRedemption(buyerAddress,tokenId),0n);inv=await gate.inventory(tokenId);assert.equal(inv.redeemReserved,0n);

await send('record actual shortage',gate.connect(inventory).setInventory(tokenId,30n,0n,0n,hash('SHORTAGE-ACTUAL-COUNT')));
coverage=await gate.coverage(tokenId);assert.equal(coverage[0],true);assert.equal(coverage[3],7500n,'coverage breach should report 0.75x');assert.equal(await gate.additionalMintable(tokenId),0n,'new mint must be blocked during coverage breach');
const req3=await token.nextRequestId();await send('shortage mint request',token.connect(requester).requestMint(tokenId,buyerAddress,1n,hash('REQ-BLOCKED')));await send('shortage mint approval',token.connect(approver).approveMint(req3,hash('APP-BLOCKED')));await expectRevert(()=>token.connect(minter).executeMint(req3),'coverage/inventory shortage must block new mint');

console.log('Product RWA MVP PASS: explicit entitlement, canonical mint gate, SoD, immutable transfer-off, atomic redeem reservation, evidence state machine, delivery-only burn and shortage fail-closed.');
await rpc.disconnect?.();
