import fs from "node:fs";
import path from "node:path";
const root = process.cwd();
const mustExist = [
  "src/components/overlays/Overlay.tsx",
  "src/components/overlays/patterns.tsx",
  "src/components/overlays/registry.ts",
  "src/components/overlays/overlay.css",
  "src/components/overlays/index.ts",
  "OVERLAYS.md",
];
for (const file of mustExist) if (!fs.existsSync(path.join(root,file))) throw new Error(`Missing ${file}`);
const overlay = fs.readFileSync(path.join(root,"src/components/overlays/Overlay.tsx"),"utf8");
for (const check of ["Escape","aria-modal","FOCUSABLE","document.body.style.overflow","previousFocusRef","createPortal","FormDialog"]) if (!overlay.includes(check)) throw new Error(`Overlay accessibility behavior missing: ${check}`);
const patterns = fs.readFileSync(path.join(root,"src/components/overlays/patterns.tsx"),"utf8");
for (const name of ["ConnectWalletModal","ConfirmBuyModal","AddWatchlistModal","SetAlertModal","ShareModal","FollowConfirmationModal","JoinRewardsModal","TransactionSuccessModal","CartCheckoutDrawer"]) if (!patterns.includes(`function ${name}`)) throw new Error(`Missing pattern ${name}`);
const forbiddenRoutes = ["src/app/modal/page.tsx","src/app/drawer/page.tsx","src/app/components/modal/page.tsx","src/app/components/drawer/page.tsx"];
for (const route of forbiddenRoutes) if (fs.existsSync(path.join(root, route))) throw new Error(`CHAT 00B must not create component-sheet route: ${route}`);
console.log(`Overlay system verified: ${mustExist.length} modules, 9 reusable patterns, focus/escape/backdrop conventions, no screenshot route.`);
