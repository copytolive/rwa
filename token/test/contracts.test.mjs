import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import solc from 'solc';
import ganache from 'ganache';
import {ethers} from 'ethers';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');

function read(rel){return fs.readFileSync(path.join(root,rel),'utf8')}
function findImports(importPath){
  const candidates=[
    path.join(root,importPath),
    path.join(root,'contracts',importPath),
    path.join(root,'node_modules',importPath)
  ];
  for(const p of candidates){if(fs.existsSync(p))return{contents:fs.readFileSync(p,'utf8')}}
  return{error:`Import not found: ${importPath}`};
}
function compile(){
  const input={
    language:'Solidity',
    sources:{
      'contracts/RWAToken.sol':{content:read('contracts/RWAToken.sol')},
      'contracts/RWAVestingVault.sol':{content:read('contracts/RWAVestingVault.sol')}
    },
    settings:{optimizer:{enabled:true,runs:200},outputSelection:{'*':{'*':['abi','evm.bytecode.object']}}}
  };
  const output=JSON.parse(solc.compile(JSON.stringify(input),{import:findImports}));
  const errors=(output.errors||[]).filter(x=>x.severity==='error');
  if(errors.length)throw new Error(errors.map(x=>x.formattedMessage).join('\n'));
  return output.contracts;
}
function artifact(contracts,file,name){
  const c=contracts[file]?.[name];
  assert.ok(c,`Missing artifact ${name}`);
  assert.ok(c.evm?.bytecode?.object,`Missing bytecode ${name}`);
  return c;
}
async function deploy(a,signer,args=[]){
  const f=new ethers.ContractFactory(a.abi,'0x'+a.evm.bytecode.object,signer);
  const c=await f.deploy(...args);
  await c.waitForDeployment();
  return c;
}
async function expectRevert(fn,label){
  let reverted=false;
  try{await fn()}catch{reverted=true}
  assert.equal(reverted,true,label);
}

const contracts=compile();
const tokenA=artifact(contracts,'contracts/RWAToken.sol','RWAToken');
const vestA=artifact(contracts,'contracts/RWAVestingVault.sol','RWAVestingVault');
const rpc=ganache.provider({logging:{quiet:true},wallet:{totalAccounts:6,defaultBalance:1000}});
const provider=new ethers.BrowserProvider(rpc);
const deployer=await provider.getSigner(0);
const treasury=await provider.getSigner(1);
const beneficiary=await provider.getSigner(2);
const outsider=await provider.getSigner(3);
const treasuryAddress=await treasury.getAddress();
const beneficiaryAddress=await beneficiary.getAddress();
const outsiderAddress=await outsider.getAddress();

const supply=ethers.parseEther('1000000');
const token=await deploy(tokenA,deployer,['RWA PRE-TGE TEST','RWATEST',treasuryAddress,supply]);
assert.equal(await token.totalSupply(),supply,'fixed total supply mismatch');
assert.equal(await token.balanceOf(treasuryAddress),supply,'treasury must receive full fixed supply');
assert.equal(tokenA.abi.some(x=>x.type==='function'&&x.name==='mint'),false,'post-deployment mint function must not exist');
assert.equal(await token.nonces(treasuryAddress),0n,'permit nonce must start at zero');
assert.ok(await token.DOMAIN_SEPARATOR(),'permit domain separator missing');

const tokenFactory=new ethers.ContractFactory(tokenA.abi,'0x'+tokenA.evm.bytecode.object,deployer);
await expectRevert(()=>tokenFactory.deploy('X','X',ethers.ZeroAddress,1n),'zero treasury must revert');
await expectRevert(()=>tokenFactory.deploy('X','X',treasuryAddress,0n),'zero supply must revert');

const directTransfer=ethers.parseEther('100');
await (await token.connect(treasury).transfer(beneficiaryAddress,directTransfer)).wait();
assert.equal(await token.balanceOf(beneficiaryAddress),directTransfer,'ERC20 transfer failed');
await (await token.connect(treasury).delegate(treasuryAddress)).wait();
assert.equal(await token.getVotes(treasuryAddress),await token.balanceOf(treasuryAddress),'delegated votes must equal delegated balance');

const latest=await provider.getBlock('latest');
const start=Number(latest.timestamp)+10;
const cliffSeconds=100;
const durationSeconds=1000;
const allocation=ethers.parseEther('1000');
const vesting=await deploy(vestA,deployer,[await token.getAddress(),beneficiaryAddress,start,cliffSeconds,durationSeconds,allocation]);
await (await token.connect(treasury).transfer(await vesting.getAddress(),allocation)).wait();
assert.equal(await token.balanceOf(await vesting.getAddress()),allocation,'vesting vault funding mismatch');
assert.equal(await vesting.vestedAt(start+cliffSeconds-1),0n,'vesting must be zero before cliff');
assert.equal(await vesting.vestedAt(start+500),allocation*500n/1000n,'linear midpoint vesting mismatch');
assert.equal(await vesting.vestedAt(start+durationSeconds),allocation,'full allocation must vest at duration end');

const vestFactory=new ethers.ContractFactory(vestA.abi,'0x'+vestA.evm.bytecode.object,deployer);
await expectRevert(()=>vestFactory.deploy(await token.getAddress(),ethers.ZeroAddress,start,0,100,1n),'zero beneficiary must revert');
await expectRevert(()=>vestFactory.deploy(await token.getAddress(),beneficiaryAddress,start,101,100,1n),'cliff greater than duration must revert');

let now=(await provider.getBlock('latest')).timestamp;
await provider.send('evm_increaseTime',[Math.max(0,start+500-now)]);
await provider.send('evm_mine',[]);
await expectRevert(()=>vesting.connect(outsider).release(),'non-beneficiary release must revert');
const releaseBlock=await provider.getBlock('latest');
const vestedNow=await vesting.vestedAt(releaseBlock.timestamp);
const beforeRelease=await token.balanceOf(beneficiaryAddress);
await (await vesting.connect(beneficiary).release()).wait();
const afterRelease=await token.balanceOf(beneficiaryAddress);
assert.equal(afterRelease-beforeRelease,vestedNow,'beneficiary release amount mismatch');

now=(await provider.getBlock('latest')).timestamp;
await provider.send('evm_increaseTime',[Math.max(0,start+durationSeconds+1-now)]);
await provider.send('evm_mine',[]);
await (await vesting.connect(beneficiary).release()).wait();
assert.equal(await vesting.released(),allocation,'released amount must equal allocation after full vesting');
assert.equal(await token.balanceOf(await vesting.getAddress()),0n,'vesting vault must be empty after full release');
assert.equal(await token.balanceOf(outsiderAddress),0n,'outsider must receive no vested tokens');

console.log('PRE-TGE contract unit tests PASS: fixed supply, permit/votes surface, immutable vesting schedule, cliff, linear release, access control.');
