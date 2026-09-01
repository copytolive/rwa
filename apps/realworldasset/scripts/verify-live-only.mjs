import fs from "node:fs";
import path from "node:path";

const root=process.cwd();
const read=(file)=>fs.readFileSync(path.join(root,file),"utf8");
const walk=(dir)=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(entry=>{
  const full=path.join(dir,entry.name);
  return entry.isDirectory()?walk(full):[full];
});
const rel=(file)=>path.relative(root,file).replaceAll("\\","/");
const failures=[];
const fail=(message)=>failures.push(message);

const routeFiles=walk(path.join(root,"src/app")).filter(file=>file.endsWith("/page.tsx")||file.endsWith("\\page.tsx"));
const forbiddenRoutePatterns=[
  [/\bUI\s+DEMO\b/i,"UI DEMO marker"],
  [/\bDEMO_(?:ORDER|POSITION)_ID\b/,"demo order/position identifier"],
  [/\bORD-DEMO|\bPOS-DEMO/i,"demo order/position route"],
  [/\bAlex Morgan\b/i,"fake identity"],
  [/\bRoutePlaceholder\b/,"synthetic route placeholder"],
  [/\bOnboardingFlow\b/,"local prototype onboarding"],
  [/\bWalletManager\b/,"fixture wallet manager"],
  [/\bBusinessDirectory\b|\bDiscoverHub\b|\bRwaDirectory\b/,"fixture discovery directory"],
  [/\bPortfolioOverviewPage\b|\bTransactionsPage\b/,"fixture account portfolio"],
  [/\bAlertsManagement\b|\bNotificationsCenter\b|\bReportsPage\b|\bWatchlistPage\b/,"fixture account tools"],
  [/\bRewardsCenter\b|\bBusinessRewards\b/,"fixture rewards surface"],
  [/\bBusinessProfile\b|\bAssetDetail\b|getRwaAsset|getCryptoAsset|getBusinessToken/,"fixture asset/business detail"],
  [/\bTradingPage\b|\bOrderDetailPage\b|\bPositionDetailPage\b/,"fixture trading detail"],
  [/\bKycFlow\b|\bKybFlow\b|\bEligibilityGuard\b/,"unverified provider flow exposed as page"],
];
for(const file of routeFiles){
  const text=fs.readFileSync(file,"utf8");
  for(const [pattern,label] of forbiddenRoutePatterns){if(pattern.test(text))fail(`${rel(file)} contains forbidden ${label}`);}
}

const required={
  landing:"src/app/page.tsx",
  home:"src/app/home/page.tsx",
  catchAll:"src/app/[...slug]/page.tsx",
  publicShell:"src/components/public/PublicShell.tsx",
  appShell:"src/components/app/AppShell.tsx",
  live:"src/components/live-dashboard/LiveDashboard.tsx",
  theme:"src/app/live-only-dark-theme.css",
  everyPage:"scripts/every-page-live-proof.py",
};
const source=Object.fromEntries(Object.entries(required).map(([k,file])=>[k,read(file)]));
for(const [name,text] of Object.entries(source)){
  for(const [pattern,label] of [[/UI DEMO/i,"UI DEMO marker"],[/Sample dataset/i,"sample dataset"],[/deterministic demo/i,"deterministic demo"],[/Alex Morgan/i,"fake identity"],[/landing-dashboard\.jpg/i,"mock dashboard image"],[/Math\.random\s*\(/,"synthetic random ticking"]]){
    if(pattern.test(text))fail(`${required[name]} contains forbidden ${label}`);
  }
}
if(!/LivePublicLanding/.test(source.landing))fail("landing is not bound to LivePublicLanding");
if(!/LiveHomeDashboard/.test(source.home))fail("home is not bound to LiveHomeDashboard");
if(!/LiveRouteWorkspace/.test(source.catchAll))fail("catch-all routes are not bound to LiveRouteWorkspace");
if(/community\/users\//.test(source.catchAll)||/community\/thesis\//.test(source.catchAll))fail("catch-all still exports synthetic community identities/theses");
if(/businessRoutes|rwaRoutes|intelligence\/btc-|intelligence\/research-/.test(source.catchAll))fail("catch-all still exports synthetic registry/research fixture expansion");
if(!/https:\/\/api\.hyperliquid\.xyz\/info/.test(source.live))fail("live dashboard lacks authoritative public Hyperliquid source");
if(!/type:\s*["']metaAndAssetCtxs["']/.test(source.live))fail("live dashboard lacks metaAndAssetCtxs query");
if(!/setTickCount\(value\s*=>\s*value\s*\+\s*1\)/.test(source.live))fail("real tick counter is missing");
if(!/if\s*\(!response\.ok\)\s*throw/.test(source.live))fail("live venue failures are not fail-closed");
if(!/UNAVAILABLE/.test(source.live)||!/STALE/.test(source.live))fail("live dashboard lacks explicit unavailable/stale states");
if(!/data-live-only=["']true["']/.test(source.publicShell))fail("PublicShell lacks live-only marker");
if(!/data-ui-demo=["']false["']/.test(source.publicShell))fail("PublicShell does not explicitly disable demo mode");
if(!/data-live-only=["']true["']/.test(source.appShell))fail("AppShell lacks live-only marker");
if(!/data-ui-demo=["']false["']/.test(source.appShell))fail("AppShell does not explicitly disable demo mode");
if(!/background:#030812!important/.test(source.theme))fail("dark production background lock missing");
if(!/background-color:#07111f!important/.test(source.theme))fail("dark surface enforcement missing");
if(!/background-color:#0a64ff!important/.test(source.theme))fail("blue primary enforcement missing");
if(!/full_page=True/.test(source.everyPage))fail("every-page proof does not take full-page screenshots");
if(!/1672/.test(source.everyPage)||!/390/.test(source.everyPage))fail("every-page proof lacks desktop/mobile target viewports");
if(!/white_pixel_ratio/.test(source.everyPage))fail("every-page proof lacks screenshot color analysis");

if(failures.length){
  console.error("LIVE_ONLY_TRUTH_GATE=FAIL");
  for(const item of failures)console.error(`- ${item}`);
  process.exit(1);
}
console.log("LIVE_ONLY_TRUTH_GATE=PASS");
console.log(`ROUTE_ENTRYPOINTS_CHECKED=${routeFiles.length}`);
console.log("SYNTHETIC_REACHABLE_ROUTES=NONE");
console.log("REAL_PUBLIC_SOURCE=HYPERLIQUID_META_AND_ASSET_CTXS");
console.log("MISSING_DATA_POLICY=UNAVAILABLE_OR_LOCKED");
console.log("THEME=BLUE_BLACK_DARK_LOCKED");
console.log("EVERY_PAGE_SCREENSHOT_POLICY=FULL_DESKTOP_AND_MOBILE");
