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
const appDir = path.join(root, "src/app");
const prohibited = fs.readdirSync(appDir).filter(name => name === "page.tsx" || name === "page.jsx" || name === "page.js");
if (prohibited.length) throw new Error("CHAT 00A must not create a screenshot-derived route/page");
console.log(`Foundation verified: ${mustExist.length} required modules, centralized tokens, no page route.`);
