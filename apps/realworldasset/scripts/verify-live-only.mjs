import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const files = {
  landing: "src/app/page.tsx",
  home: "src/app/home/page.tsx",
  catchAll: "src/app/[...slug]/page.tsx",
  publicShell: "src/components/public/PublicShell.tsx",
  appShell: "src/components/app/AppShell.tsx",
  live: "src/components/live-dashboard/LiveDashboard.tsx",
  theme: "src/app/live-only-dark-theme.css",
};

const source = Object.fromEntries(Object.entries(files).map(([key, file]) => [key, read(file)]));
const failures = [];
const fail = (message) => failures.push(message);

for (const [name, text] of Object.entries(source)) {
  const forbidden = [
    [/UI DEMO/i, "UI DEMO marker"],
    [/Sample dataset/i, "sample dataset"],
    [/deterministic demo/i, "deterministic demo"],
    [/Demo Market/i, "demo market"],
    [/Alex Morgan/i, "fake Alex Morgan identity"],
    [/landing-dashboard\.jpg/i, "mock dashboard image"],
    [/data-ui-demo=["']true["']/i, "demo=true production marker"],
    [/Math\.random\s*\(/, "synthetic random ticking"],
  ];
  for (const [pattern, label] of forbidden) if (pattern.test(text)) fail(`${files[name]} contains forbidden ${label}`);
}

if (!/LivePublicLanding/.test(source.landing)) fail("landing is not bound to LivePublicLanding");
if (!/LiveHomeDashboard/.test(source.home)) fail("home is not bound to LiveHomeDashboard");
if (!/LiveRouteWorkspace/.test(source.catchAll)) fail("catch-all routes are not bound to LiveRouteWorkspace");
for (const legacy of ["CommerceRoute", "CommunityRoute", "SettingsSupportRoute", "MerchantRoute", "MerchantGrowthRoute", "RoutePlaceholder"]) {
  if (new RegExp(`\\b${legacy}\\b`).test(source.catchAll)) fail(`catch-all still imports/routes synthetic surface ${legacy}`);
}
if (!/https:\/\/api\.hyperliquid\.xyz\/info/.test(source.live)) fail("live dashboard lacks real Hyperliquid public venue source");
if (!/type:\s*["']metaAndAssetCtxs["']/.test(source.live)) fail("live dashboard lacks metaAndAssetCtxs real market query");
if (!/setTickCount\(value\s*=>\s*value\s*\+\s*1\)/.test(source.live)) fail("real tick counter is missing");
if (!/if\s*\(!response\.ok\)\s*throw/.test(source.live)) fail("live venue failures are not fail-closed");
if (!/UNAVAILABLE/.test(source.live) || !/STALE/.test(source.live)) fail("live dashboard lacks explicit unavailable/stale states");
if (!/data-live-only=["']true["']/.test(source.publicShell)) fail("PublicShell lacks live-only marker");
if (!/data-ui-demo=["']false["']/.test(source.publicShell)) fail("PublicShell does not explicitly disable demo mode");
if (!/data-live-only=["']true["']/.test(source.appShell)) fail("AppShell lacks live-only marker");
if (!/data-ui-demo=["']false["']/.test(source.appShell)) fail("AppShell does not explicitly disable demo mode");
if (!/background:#030812!important/.test(source.theme)) fail("dark production background lock missing");
if (!/background-color:#07111f!important/.test(source.theme)) fail("dark surface enforcement missing");
if (!/background-color:#0a64ff!important/.test(source.theme)) fail("blue primary enforcement missing");

if (failures.length) {
  console.error("LIVE_ONLY_TRUTH_GATE=FAIL");
  for (const item of failures) console.error(`- ${item}`);
  process.exit(1);
}
console.log("LIVE_ONLY_TRUTH_GATE=PASS");
console.log(`ENTRYPOINTS_CHECKED=${Object.keys(source).length}`);
console.log("SYNTHETIC_MARKET_FALLBACK=NONE");
console.log("REAL_PUBLIC_SOURCE=HYPERLIQUID_META_AND_ASSET_CTXS");
console.log("MISSING_DATA_POLICY=UNAVAILABLE_OR_LOCKED");
console.log("THEME=BLUE_BLACK_DARK_LOCKED");
