import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const appRoot = path.join(root, 'apps', 'realworldasset');
const srcRoot = path.join(appRoot, 'src');
const workflowsRoot = path.join(root, '.github', 'workflows');
const requireEngineering = process.argv.includes('--require-engineering');

function walk(dir, predicate = () => true) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full, predicate));
    else if (predicate(full)) out.push(full);
  }
  return out;
}
function read(p) { return fs.readFileSync(path.join(root, p), 'utf8'); }
function exists(p) { return fs.existsSync(path.join(root, p)); }

const engineeringFindings = [];
const warnings = [];
const checks = [];
function check(ok, id, detail) {
  checks.push({ id, ok: Boolean(ok), detail });
  if (!ok) engineeringFindings.push({ id, detail });
}

check(exists('apps/realworldasset/package.json'), 'canonical_app_present', 'apps/realworldasset/package.json');
check(exists('UI_SYNC_MANIFEST.json'), 'ui_sync_manifest_present', 'UI_SYNC_MANIFEST.json');
check(exists('REALWORLDASSET_MIGRATION_MANIFEST.json'), 'migration_manifest_present', 'REALWORLDASSET_MIGRATION_MANIFEST.json');
check(!exists('ui/realworldasset'), 'single_canonical_ui_tree', 'legacy ui/realworldasset mirror must stay absent');

const appShell = exists('apps/realworldasset/src/components/app/AppShell.tsx') ? read('apps/realworldasset/src/components/app/AppShell.tsx') : '';
const publicShell = exists('apps/realworldasset/src/components/public/PublicShell.tsx') ? read('apps/realworldasset/src/components/public/PublicShell.tsx') : '';
const liveDashboard = exists('apps/realworldasset/src/components/live-dashboard/LiveDashboard.tsx') ? read('apps/realworldasset/src/components/live-dashboard/LiveDashboard.tsx') : '';
const liveOnlyVerifier = exists('apps/realworldasset/scripts/verify-live-only.mjs') ? read('apps/realworldasset/scripts/verify-live-only.mjs') : '';

check(appShell.includes('getRuntimeCapabilities') && appShell.includes('data-backend-connected={capabilities.commerceReachable'), 'backend_capability_truth', 'Authenticated shell must derive backend status from runtime capability probes');
check(publicShell.includes('getRuntimeCapabilities') && publicShell.includes('data-backend-connected={capabilities.commerceReachable'), 'public_backend_capability_truth', 'Public shell must derive backend status from runtime capability probes');
check(publicShell.includes('data-live-only="true"'), 'public_live_only_marker', 'Public shell must explicitly identify the live-only production policy');
check(appShell.includes('data-live-only="true"'), 'app_live_only_marker', 'Authenticated shell must explicitly identify the live-only production policy');
check(liveDashboard.includes('https://api.hyperliquid.xyz/info') && liveDashboard.includes('metaAndAssetCtxs'), 'public_venue_truth', 'Public market observations must come from the authoritative Hyperliquid endpoint');
check(liveDashboard.includes('UNAVAILABLE') && liveDashboard.includes('LOCKED'), 'provider_fail_closed_truth', 'Missing provider capabilities must render unavailable or locked instead of fabricated values');
check(liveOnlyVerifier.includes('SYNTHETIC_REACHABLE_ROUTES=NONE') && liveOnlyVerifier.includes('EVERY_PAGE_SCREENSHOT_POLICY=FULL_DESKTOP_AND_MOBILE'), 'live_only_verifier_contract', 'Live-only verifier must forbid reachable synthetic routes and require desktop/mobile page proof');

const foundation = exists('apps/realworldasset/scripts/verify-foundation.mjs') ? read('apps/realworldasset/scripts/verify-foundation.mjs') : '';
check(!foundation.includes('CHAT 00A must not create a screenshot-derived route/page'), 'foundation_final_state_contract', 'foundation verifier must support the integrated final app');

const releaseWorkflow = exists('.github/workflows/release-candidate.yml') ? read('.github/workflows/release-candidate.yml') : '';
check(!releaseWorkflow.includes('curl --connect-timeout 5 --max-time 20 -fsSL "$base/superapp-v5.js'), 'release_gate_canonical_public_surface', 'release candidate must not require retired legacy public shell files');

let sync = null;
if (exists('UI_SYNC_MANIFEST.json')) {
  try { sync = JSON.parse(read('UI_SYNC_MANIFEST.json')); } catch {}
}
check(sync?.canonicalPath === 'apps/realworldasset', 'canonical_manifest_path', 'UI_SYNC_MANIFEST canonicalPath=apps/realworldasset');
check(sync?.compatibilityMirror == null, 'no_compatibility_mirror', 'UI_SYNC_MANIFEST compatibilityMirror=null');

const tsxFiles = walk(srcRoot, p => p.endsWith('.tsx'));
const routePages = walk(path.join(appRoot, 'src', 'app'), p => /\/page\.tsx$/.test(p));
const workflowFiles = walk(workflowsRoot, p => /\.ya?ml$/.test(p));
let rawButtons = 0;
let rawButtonsWithoutType = 0;
let nonSemanticClickTargets = 0;
let links = 0;
let inputs = 0;
for (const file of tsxFiles) {
  const text = fs.readFileSync(file, 'utf8');
  rawButtons += (text.match(/<button\b/g) || []).length;
  links += (text.match(/<Link\b/g) || []).length + (text.match(/<a\b/g) || []).length;
  inputs += (text.match(/<(?:input|select|textarea)\b/g) || []).length;
  for (const match of text.matchAll(/<button\b([^>]*)>/g)) {
    if (!/\btype\s*=/.test(match[1])) rawButtonsWithoutType += 1;
  }
  nonSemanticClickTargets += (text.match(/<(?:div|article|section|span)\b[^>]*\bonClick\s*=/g) || []).length;
}

if (!exists('apps/realworldasset/package-lock.json')) {
  warnings.push({ id: 'dependency_lock_missing', detail: 'No app package-lock.json; dependency resolution is not fully reproducible.' });
}
if (rawButtonsWithoutType > 0) {
  warnings.push({ id: 'raw_button_type_hygiene', detail: `${rawButtonsWithoutType} raw button tags omit explicit type; inspect form contexts or migrate to shared Button.` });
}
if (nonSemanticClickTargets > 0) {
  warnings.push({ id: 'nonsemantic_click_targets', detail: `${nonSemanticClickTargets} non-button elements have onClick; require keyboard semantics or native buttons.` });
}

let readiness = {};
if (exists('launch/readiness.json')) {
  try { readiness = JSON.parse(read('launch/readiness.json')); } catch {}
}
const productionBlockers = Array.isArray(readiness.blockers) ? readiness.blockers : [];
const externalOrPilot = productionBlockers.filter(x => /EXTERNAL_REQUIRED|PILOT_REQUIRED/.test(String(x.detail || '')));
const platformOrActivation = productionBlockers.filter(x => !/EXTERNAL_REQUIRED|PILOT_REQUIRED/.test(String(x.detail || '')));

const result = {
  schema: 'rwa-total-ready-screen-v2',
  generatedAt: new Date().toISOString(),
  repository: 'copytolive/rwa',
  canonicalApp: 'apps/realworldasset',
  engineeringStatus: engineeringFindings.length === 0 ? 'PASS' : 'FAIL',
  publicMode: 'LIVE_ONLY_PROVIDER_GATED',
  realMoneyMainnetStatus: readiness.mainnet_ready === true ? 'READY' : 'BLOCKED',
  counts: {
    canonicalTsxFiles: tsxFiles.length,
    routePages: routePages.length,
    workflowFiles: workflowFiles.length,
    rawButtons,
    links,
    formControls: inputs,
    rawButtonsWithoutType,
    nonSemanticClickTargets,
    productionBlockers: productionBlockers.length,
    externalOrPilotBlockers: externalOrPilot.length,
    platformOrActivationBlockers: platformOrActivation.length,
  },
  checks,
  engineeringFindings,
  warnings,
  productionBlockers,
  note: 'Public UI uses live venue/runtime truth. Provider-dependent and real-money capabilities stay unavailable or locked until their real evidence exists; mainnet remains fail-closed.',
};

console.log(JSON.stringify(result, null, 2));
if (requireEngineering && engineeringFindings.length) process.exit(1);
