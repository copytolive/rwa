import fs from 'node:fs';
import process from 'node:process';

const config=JSON.parse(fs.readFileSync(new URL('./config.json',import.meta.url),'utf8'));
const network=(process.argv.find(x=>x.startsWith('--network='))||'--network=testnet').split('=')[1];
const treasury=String(process.env.RWA_TOKEN_TREASURY||'').trim();
const token=config.token||{};
const isAddress=x=>/^0x[a-fA-F0-9]{40}$/.test(x||'');
const positive=x=>Number.isFinite(Number(x))&&Number(x)>0;

function fail(message){console.error(`BLOCKED: ${message}`);process.exitCode=1}

if(config.tgeEnabled!==false)fail('TGE flag must remain false during PRE_TGE preparation.');
if(network==='mainnet'){
  if(config.mainnetDeploymentEnabled!==true)fail('HyperEVM mainnet deployment is disabled.');
  if(config.status!=='APPROVED_FOR_MAINNET')fail('Token status is not APPROVED_FOR_MAINNET.');
}
if(!['testnet','mainnet'].includes(network))fail('Use --network=testnet or --network=mainnet.');
if(!String(token.name||'').trim())fail('Token name is not approved/configured.');
if(!/^[A-Z0-9]{2,12}$/.test(String(token.symbol||'')))fail('Token symbol must be an approved 2-12 character uppercase ticker.');
if(!positive(token.supply))fail('Fixed token supply is not approved/configured.');
if(!isAddress(treasury))fail('Set RWA_TOKEN_TREASURY to the approved multisig address.');

const net=network==='testnet'?config.networks?.hyperevmTestnet:config.networks?.hyperevmMainnet;
if(!net?.deploymentAllowed)fail(`${network} deploymentAllowed is false.`);

if(process.exitCode){
  console.error('No transaction was created. No private key is accepted or stored by this tool.');
} else {
  const plan={
    mode:'UNSIGNED_DEPLOYMENT_PLAN',network,chainId:net.chainId,rpc:net.rpc,
    contract:'token/contracts/RWAToken.sol',
    constructor:{name:token.name,symbol:token.symbol,treasury,fixedSupply:token.supply},
    vestingContract:'token/contracts/RWAVestingVault.sol',
    tgeEnabled:config.tgeEnabled,
    mainnetDeploymentEnabled:config.mainnetDeploymentEnabled,
    next:'Compile/audit contracts, then deploy with the approved wallet. This tool never handles a private key.'
  };
  console.log(JSON.stringify(plan,null,2));
}
