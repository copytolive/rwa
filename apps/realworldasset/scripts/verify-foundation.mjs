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

// CHAT 00A originally prohibited routes while the foundation-only slice was being built.
// In the integrated final application a real landing route is mandatory. Keep the
// anti-screenshot intent by requiring composed UI source and explicit demo truth.
const pagePath = path.join(root, "src/app/page.tsx");
if (!fs.existsSync(pagePath)) throw new Error("Integrated final app is missing src/app/page.tsx");
const page = fs.readFileSync(pagePath, "utf8");
if (!page.includes('PublicShell')) throw new Error("Landing page must compose the canonical PublicShell");
if (!page.includes('Market figures shown in this public preview are deterministic demo data')) throw new Error("Landing page must preserve explicit demo-data disclosure");
if (/export\s+default\s+function\s+\w+\s*\(\s*\)\s*\{?\s*return\s*<img\b/i.test(page)) throw new Error("Screenshot-only landing route is prohibited");
if (page.includes('dangerouslySetInnerHTML')) throw new Error("Landing page must not inject screenshot-derived HTML");

console.log(`Foundation verified: ${mustExist.length} required modules, centralized tokens, composed final landing route, demo truth preserved.`);
