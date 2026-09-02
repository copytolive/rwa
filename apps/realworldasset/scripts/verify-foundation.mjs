import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const mustExist = [
  "src/styles/tokens.css",
  "src/components/ui/Button.tsx",
  "src/components/ui/Input.tsx",
  "src/components/ui/Select.tsx",
  "src/components/ui/Choice.tsx",
  "src/components/ui/Card.tsx",
  "src/components/ui/Badge.tsx",
  "src/components/ui/Tabs.tsx",
  "src/components/ui/Table.tsx",
  "src/components/ui/Tooltip.tsx",
  "src/components/ui/Alert.tsx",
  "src/components/ui/Toast.tsx",
  "src/components/ui/Skeleton.tsx",
  "src/components/states/EmptyState.tsx",
  "src/components/states/LoadingState.tsx",
  "src/components/states/ErrorState.tsx",
  "src/components/states/PermissionState.tsx",
];
for (const file of mustExist) {
  if (!fs.existsSync(path.join(root, file))) throw new Error(`Missing ${file}`);
}
const tokens = fs.readFileSync(path.join(root, "src/styles/tokens.css"), "utf8");
for (const token of ["--rwa-primary", "--rwa-bg", "--rwa-surface", "--rwa-border", "--rwa-text", "--rwa-space-4", "--rwa-radius-md", "--rwa-container-max"]) {
  if (!tokens.includes(token)) throw new Error(`Missing token ${token}`);
}

const pagePath = path.join(root, "src/app/page.tsx");
const livePath = path.join(root, "src/components/live-dashboard/LiveDashboard.tsx");
if (!fs.existsSync(pagePath)) throw new Error("Integrated final app is missing src/app/page.tsx");
if (!fs.existsSync(livePath)) throw new Error("Integrated final app is missing LiveDashboard.tsx");
const page = fs.readFileSync(pagePath, "utf8");
const live = fs.readFileSync(livePath, "utf8");
if (!page.includes('LivePublicLanding')) throw new Error("Landing route must bind to LivePublicLanding");
if (!live.includes('return <PublicShell><LiveContent')) throw new Error("LivePublicLanding must compose the canonical PublicShell");
if (!live.includes('https://api.hyperliquid.xyz/info') || !live.includes('metaAndAssetCtxs')) throw new Error("Landing must use the verified public Hyperliquid market source");
if (!live.includes('No synthetic fallback.')) throw new Error("Landing must keep missing market data fail-closed without fabricated fallback");
if (/export\s+default\s+function\s+\w+\s*\(\s*\)\s*\{?\s*return\s*<img\b/i.test(page)) throw new Error("Screenshot-only landing route is prohibited");
if (page.includes('dangerouslySetInnerHTML') || live.includes('dangerouslySetInnerHTML')) throw new Error("Landing must not inject screenshot-derived HTML");

console.log(`Foundation verified: ${mustExist.length} required modules, centralized tokens, canonical live landing composition, and fail-closed data policy.`);
