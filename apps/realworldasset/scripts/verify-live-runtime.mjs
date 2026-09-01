import fs from "node:fs";
import path from "node:path";
const root=process.cwd();
const repo=path.resolve(root,"../..");
const read=p=>fs.readFileSync(path.join(root,p),"utf8");
const live=read("src/lib/live-runtime.ts");
const shell=read("src/components/app/AppShell.tsx");
const auth=read("src/components/auth/AuthFlow.tsx");
const publicShell=read("src/components/public/PublicShell.tsx");
const center=read("src/components/live/LiveActionCenter.tsx");
const postbuild=read("scripts/postbuild-live-runtime.mjs");
const pkg=JSON.parse(read("package.json"));
for(const token of ["/v1/auth/challenge","/v1/auth/verify","/v1/auth/logout","/v1/quote","/v1/orders","/payment","personal_sign","authorization","Bearer","production.require","orders.limit","orders.market"]){if(!live.includes(token))throw new Error(`Live runtime contract missing ${token}`)}
for(const token of ["Log Out","logoutRealSession","UNSAFE_ACTION","data-live-financial-action","mainnetReady","rwa:open-live-action"]){if(!shell.includes(token)&&!center.includes(token))throw new Error(`App live/safety contract missing ${token}`)}
for(const token of ["Password authentication is not connected","No session was created","connectWalletAndAuthenticate"]){if(!auth.includes(token))throw new Error(`Auth fail-closed contract missing ${token}`)}
for(const token of ["Connect Wallet · Live","Log Out","data-backend-connected"]){if(!publicShell.includes(token))throw new Error(`Public live truth contract missing ${token}`)}
for(const token of ["Authoritative Checkout","Pay with Verified Checkout","Payment is NOT marked paid","Hyperliquid Execution","Authorize TESTNET Agent","MAINNET remains machine-locked"]){if(!center.includes(token))throw new Error(`Live action center missing ${token}`)}
for(const token of ["execution-api.js","rwa-execution-config.json","rwa-commerce-config.json","readiness.json","e2e-registry.json","live-runtime-manifest.json"]){if(!postbuild.includes(token))throw new Error(`Postbuild live packaging missing ${token}`)}
if(!postbuild.includes("commerceSource.candidate_api_base||commerceSource.candidate_base"))throw new Error("Legacy candidate_base is not mapped into the browser commerce runtime");
if(!postbuild.includes("commerceSource.fallback_candidate_api_base||commerceSource.fallback_candidate_base"))throw new Error("Legacy fallback_candidate_base compatibility mapping is missing");
if(!live.includes("candidate_api_base"))throw new Error("Browser runtime does not consume packaged commerce candidate_api_base");
if(!String(pkg.scripts?.build||"").includes("postbuild-live-runtime.mjs"))throw new Error("Build does not package live runtime");
if(!pkg.scripts?.["verify:live-runtime"])throw new Error("verify:live-runtime script missing");
if(shell.includes("const BACKEND_CONNECTED = true")||shell.includes("const BACKEND_CONNECTED=true"))throw new Error("Hard-coded backend success is forbidden");
if(/router\.push\(\s*["']\/onboarding["']\s*\)/.test(auth)&&auth.includes("socialAuth"))throw new Error("Auth still contains ambiguous local success routing");
const commerce=JSON.parse(fs.readFileSync(path.join(repo,"rwa-commerce-config.json"),"utf8"));
const failClosedConfig = commerce.ui_policy?.no_fake_success===true || (commerce.api_base==="" && /fail-closed/i.test(String(commerce.note||"")) && /LOCKED_UNTIL_BACKEND_AND_CHECKOUT_READY/.test(String(commerce.mode||"")));
if(!failClosedConfig)throw new Error("Commerce no-fake-success/fail-closed policy must remain explicit");
const external=JSON.parse(fs.readFileSync(path.join(repo,"launch/external-gates.json"),"utf8"));
const product=JSON.parse(fs.readFileSync(path.join(repo,"launch/product-rwa-testnet.json"),"utf8"));
if(external?.approved===true&&!external?.evidence)throw new Error("External launch approval cannot be asserted without evidence");
if(product?.complete===true&&!product?.receipts)throw new Error("Product testnet gate cannot be asserted without receipts");
console.log("REALWORLDASSET_LIVE_RUNTIME_STATIC_PASS auth=wallet-signature commerce=authoritative execution=hyperliquid mainnet=machine-gated unsafe=fail-closed");
