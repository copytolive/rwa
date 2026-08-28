import {readFile} from 'node:fs/promises';

const read=async p=>JSON.parse(await readFile(p,'utf8'));
const https=x=>/^https:\/\//i.test(String(x||''));
const addr=x=>/^0x[a-fA-F0-9]{40}$/.test(String(x||''));

const [global,multi,revenue,assets,product,commerce,worker,control,external,beta]=await Promise.all([
  read('launch/readiness.json'),
  read('launch/multichain-readiness.json'),
  read('rwa-multichain-revenue.json'),
  read('rwa-assets.json'),
  read('launch/product-rwa-testnet.json'),
  read('rwa-commerce-config.json'),
  read('agent-worker/public-config.json'),
  read('agent-worker/control.json'),
  read('launch/external-gates.json'),
  read('launch/beta-registry.json')
]);

const lifi=!!(
  revenue?.lifi?.enabled===true&&
  revenue?.lifi?.integrator_verified===true&&
  revenue?.lifi?.portal_configured===true&&
  revenue?.lifi?.fee_wallet_configured_externally===true&&
  revenue?.lifi?.partner_configured===true&&
  revenue?.lifi?.payout_wallet_configured_externally===true&&
  Number(revenue?.lifi?.fee_bps)>0&&
  https(revenue?.lifi?.evidence_url)
);
const hyperliquid=!!(
  revenue?.hyperliquid?.enabled===true&&
  revenue?.hyperliquid?.builder_wallet_configured===true&&
  addr(revenue?.hyperliquid?.builder_address)&&
  Number(revenue?.hyperliquid?.builder_min_account_value_usdc)>=100&&
  revenue?.hyperliquid?.builder_account_value_verified===true&&
  revenue?.hyperliquid?.user_approval_required===true&&
  https(revenue?.hyperliquid?.evidence_url)
);
const ext=external?.gates||{};
const externalKeys=['legal_terms','operating_economics','inventory_reconciliation','refund_shortage_remedy','settlement_tieout','incident_backup_recovery','evidence_repository'];
const externalOk=externalKeys.every(k=>ext[k]?.approved===true&&ext[k]?.status==='VERIFIED'&&https(ext[k]?.evidence_url));
const betaProofs=Array.isArray(beta?.proofs)?beta.proofs:[];
const thresholds=beta?.thresholds||{internal:3,closed:20,public:100};
const rank={internal:1,closed:2,public:3};
const unique=min=>new Set(betaProofs.filter(p=>p?.status==='VERIFIED'&&rank[p?.phase]>=min&&addr(p?.wallet)).map(p=>String(p.wallet).toLowerCase())).size;
const betaCounts={internal:unique(1),closed:unique(2),public:unique(3)};
const betaOk=betaCounts.internal>=Number(thresholds.internal||3)&&betaCounts.closed>=Number(thresholds.closed||20)&&betaCounts.public>=Number(thresholds.public||100);

const workstreams={
  global_gate:{ok:global?.status==='READY_FOR_MAINNET'&&global?.mainnet_ready===true,detail:`${global?.status||'UNKNOWN'} / mainnet_ready=${global?.mainnet_ready===true}`},
  multichain:{ok:multi?.status==='READY'&&multi?.ready===true,detail:`${multi?.status||'UNKNOWN'} / ready=${multi?.ready===true}`},
  lifi_revenue:{ok:lifi,detail:lifi?'production fee setup verified':'Partner Portal + fee/payout wallet + public evidence required'},
  hyperliquid_builder:{ok:hyperliquid,detail:hyperliquid?'builder setup verified':'funded >=100 USDC builder + user approval + public evidence required'},
  verified_rwa_asset:{ok:Array.isArray(assets?.verified)&&assets.verified.length>0,detail:`${assets?.verified?.length||0} registered verified asset(s); canonical launch gate performs full evidence validation`},
  product_rwa_testnet:{ok:product?.status==='TESTNET_VERIFIED',detail:`${product?.status||'NOT_DEPLOYED'} on chain ${product?.chain_id||'unknown'}`},
  commerce:{ok:https(commerce?.api_base),detail:https(commerce?.api_base)?commerce.api_base:'production api_base not configured'},
  worker:{ok:worker?.enabled===true&&https(worker?.base_url)&&control?.enabled===true&&control?.kill_switch===false&&control?.production_ready===true,detail:`worker=${worker?.enabled===true?'enabled':'disabled'} control=${control?.enabled===true?'enabled':'disabled'} kill=${control?.kill_switch} production_ready=${control?.production_ready}`},
  external_evidence:{ok:externalOk,detail:`${externalKeys.filter(k=>ext[k]?.approved===true&&ext[k]?.status==='VERIFIED'&&https(ext[k]?.evidence_url)).length}/${externalKeys.length} verified`},
  beta:{ok:betaOk,detail:`internal ${betaCounts.internal}/${thresholds.internal||3}, closed ${betaCounts.closed}/${thresholds.closed||20}, public ${betaCounts.public}/${thresholds.public||100}`},
  mainnet_control:{ok:control?.mainnet_enabled===true,detail:`mainnet_enabled=${control?.mainnet_enabled===true}`}
};

const blockers=Object.entries(workstreams).filter(([,v])=>!v.ok).map(([gate,v])=>({gate,detail:v.detail}));
const launch_go=blockers.length===0;
const out={schema:1,contract:'rwa-total-launch-finalization-v6',generated_at:new Date().toISOString(),launch_go,status:launch_go?'GO':'NO-GO',workstreams,blockers};
console.log(JSON.stringify(out,null,2));
if(process.argv.includes('--require-go')&&!launch_go)process.exit(3);
