import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';

const base = process.env.RWA_UI_URL || 'http://127.0.0.1:4173/rwa/';
const proof = process.env.RWA_UI_PROOF_DIR || 'proof/launch-ui-final';
const publicMode = /^https:\/\//i.test(base);
const VERSION = '1.2.4';
await mkdir(proof, { recursive: true });

const browser = await chromium.launch({ headless: true });
const failures = [];
const results = [];
const fail = (scope, message, detail = null) => failures.push({ scope, message, detail });
const slug = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

const desktop = [
  ['desktop-2048x1129', 2048, 1129],
  ['desktop-1600x1000', 1600, 1000],
  ['desktop-1440x900', 1440, 900],
  ['desktop-1366x768', 1366, 768]
];
const mobile = [
  ['mobile-320x700', 320, 700],
  ['mobile-360x800', 360, 800],
  ['mobile-375x812', 375, 812],
  ['mobile-390x844', 390, 844],
  ['mobile-393x852', 393, 852],
  ['mobile-412x915', 412, 915],
  ['mobile-430x932', 430, 932]
];

async function pageFor(label, width, height) {
  const context = await browser.newContext({ viewport: { width, height }, serviceWorkers: 'block' });
  const page = await context.newPage();
  const errors = [];
  const popups = [];
  page.on('pageerror', e => errors.push(String(e?.message || e)));
  context.on('page', p => { if (p !== page) popups.push(p); });
  const url = new URL(base); url.searchParams.set('__launch_ui_final', `${label}-${Date.now()}`);
  const started = Date.now();
  await page.goto(url.href, { waitUntil: 'domcontentloaded', timeout: publicMode ? 50000 : 30000 });
  try {
    await page.waitForFunction(v => window.RWASuperApp?.version && window.RWASeablueprintCommerceBridge?.version === v, VERSION, { timeout: publicMode ? 30000 : 20000 });
  } catch (e) {
    fail(label, 'app/commerce bridge did not become ready', e.message);
  }
  const readyMs = Date.now() - started;
  return { context, page, errors, popups, readyMs };
}

async function metrics(page) {
  return page.evaluate(() => ({
    path: location.pathname,
    hash: location.hash,
    route: document.documentElement.dataset.rwaRoute || '',
    width: innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
    overflow: Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth),
    bridge: window.RWASeablueprintCommerceBridge?.version || '',
    layout: window.RWAUILayoutIntegrity?.audit?.() || null,
    commerce: window.RWASeablueprintCommerceBridge?.audit?.() || null,
    chart: !!document.querySelector('#priceChart'),
    chartVisible: !!document.querySelector('#priceChart') && getComputedStyle(document.querySelector('#priceChart')).display !== 'none',
    mobileTabs: !!document.querySelector('.mobile-tabs') && getComputedStyle(document.querySelector('.mobile-tabs')).display !== 'none',
    topnav: !!document.querySelector('.topnav') && getComputedStyle(document.querySelector('.topnav')).display !== 'none',
    ecommerceLauncher: !!document.querySelector('#rwaSeablueprintCommerceLaunch') && getComputedStyle(document.querySelector('#rwaSeablueprintCommerceLaunch')).display !== 'none'
  }));
}

async function checkRoot(label, page, isMobile, readyMs) {
  const m = await metrics(page);
  if (m.path !== '/rwa/') fail(label, 'top-level path escaped /rwa/', m);
  if (m.bridge !== VERSION) fail(label, `bridge version is not ${VERSION}`, m.bridge);
  if (m.overflow > 4) fail(label, `horizontal overflow ${m.overflow}px`, m);
  if (!m.chart || !m.chartVisible) fail(label, 'chart is not immediately usable/visible', m);
  if (!m.ecommerceLauncher) fail(label, 'Ecommerce launcher not visible', m);
  if (isMobile && !m.mobileTabs) fail(label, 'mobile navigation not visible', m);
  if (!isMobile && !m.topnav) fail(label, 'desktop navigation not visible', m);
  if (m.layout && !m.layout.ok) fail(label, 'layout integrity audit failed', m.layout);
  const maxReady = publicMode ? 15000 : 10000;
  if (readyMs > maxReady) fail(label, `interactive shell ready too slow: ${readyMs}ms > ${maxReady}ms`);
  return m;
}

async function ecommerceRoundTrip(label, page, screenshot = false) {
  const launch = page.locator('#rwaSeablueprintCommerceLaunch');
  if (!(await launch.count()) || !(await launch.isVisible().catch(() => false))) { fail(label, 'Ecommerce launch button unavailable'); return; }
  await launch.click();
  try { await page.waitForFunction(() => document.querySelector('#rwaShopScreen')?.classList.contains('open'), { timeout: 15000 }); }
  catch (e) { fail(label, 'Ecommerce did not open', e.message); return; }
  const opened = await page.evaluate(() => ({
    path: location.pathname,
    hash: location.hash,
    overflow: Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth),
    source: document.querySelector('[data-seablueprint-source]')?.textContent || '',
    commerce: window.RWASeablueprintCommerceBridge?.audit?.() || null
  }));
  if (opened.path !== '/rwa/' || opened.hash !== '#shop') fail(label, 'Ecommerce escaped main document', opened);
  if (opened.overflow > 4) fail(label, 'Ecommerce caused horizontal overflow', opened);
  if (!/BACKEND LOCKED/.test(opened.source)) fail(label, 'fail-closed BACKEND LOCKED indicator missing', opened.source);
  if (!opened.commerce?.ok || opened.commerce?.apiBaseConfigured) fail(label, 'commerce fail-closed audit failed', opened.commerce);
  if (screenshot) await page.screenshot({ path: `${proof}/${slug(label)}-ecommerce.png`, fullPage: true });

  const trade = page.locator('#rwaShopScreen [data-rwa-shop-trade]').first();
  if (!(await trade.count())) { fail(label, 'canonical Ecommerce Trade token link missing'); return; }
  const href = await trade.getAttribute('href');
  if (!/^#trade\/[A-Za-z0-9]+$/.test(href || '')) fail(label, 'Trade token href is not canonical hash route', href);
  await trade.click();
  try {
    await page.waitForFunction(() => location.pathname === '/rwa/' && location.hash.startsWith('#trade/') && !document.querySelector('#rwaShopScreen')?.classList.contains('open'), { timeout: 20000 });
  } catch (e) {
    const s = await page.evaluate(() => ({ path: location.pathname, hash: location.hash, route: document.documentElement.dataset.rwaRoute || '', shopOpen: document.querySelector('#rwaShopScreen')?.classList.contains('open'), commerce: window.RWASeablueprintCommerceBridge?.audit?.() || null }));
    fail(label, 'Ecommerce → Trade race/overlay close failed', s);
    return;
  }
  const after = await metrics(page);
  if (after.path !== '/rwa/' || after.overflow > 4) fail(label, 'Trade handoff changed document or overflowed', after);
}

async function assetRestore(label, page) {
  await page.evaluate(() => window.RWASuperApp.navigate('asset/PENDLE'));
  try { await page.waitForFunction(() => location.hash === '#asset/PENDLE' && document.body.classList.contains('rwa-super-asset-workspace'), { timeout: 15000 }); }
  catch (e) { fail(label, 'asset context did not open', e.message); return; }
  await page.locator('#rwaSeablueprintCommerceLaunch').click();
  await page.waitForFunction(() => document.querySelector('#rwaShopScreen')?.classList.contains('open'), { timeout: 15000 }).catch(e => fail(label, 'shop did not reopen from asset', e.message));
  const close = page.locator('#rwaShopClose');
  if (await close.count()) await close.click();
  try { await page.waitForFunction(() => location.pathname === '/rwa/' && location.hash === '#asset/PENDLE' && !document.querySelector('#rwaShopScreen')?.classList.contains('open'), { timeout: 15000 }); }
  catch (e) { fail(label, 'asset context not restored after Ecommerce close', e.message); }
}

async function stress(label, page) {
  const routes = ['markets', 'assets', 'research', 'asset/PENDLE', 'trade/BTC', 'markets'];
  for (let round = 0; round < 3; round++) {
    for (const route of routes) {
      await page.evaluate(r => window.RWASuperApp.navigate(r, { replace: true }), route);
      await page.waitForTimeout(90);
      const m = await metrics(page);
      if (m.path !== '/rwa/' || m.overflow > 4) fail(label, `stress route failed: ${route}`, m);
    }
    await page.evaluate(() => window.RWASuperApp.navigate('asset/PENDLE', { replace: true }));
    await page.locator('#rwaSeablueprintCommerceLaunch').click();
    await page.waitForFunction(() => document.querySelector('#rwaShopScreen')?.classList.contains('open'), { timeout: 10000 }).catch(e => fail(label, `stress Ecommerce open ${round + 1} failed`, e.message));
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.querySelector('#rwaShopScreen')?.classList.contains('open'), { timeout: 10000 }).catch(e => fail(label, `stress Ecommerce close ${round + 1} failed`, e.message));
  }
}

for (const [label, width, height] of [...desktop, ...mobile]) {
  const isMobile = label.startsWith('mobile');
  let session;
  try {
    session = await pageFor(label, width, height);
    await checkRoot(label, session.page, isMobile, session.readyMs);
    const keyShot = ['desktop-2048x1129', 'desktop-1600x1000', 'mobile-320x700', 'mobile-390x844', 'mobile-430x932'].includes(label);
    if (keyShot) await session.page.screenshot({ path: `${proof}/${slug(label)}-root.png`, fullPage: true });
    await ecommerceRoundTrip(label, session.page, keyShot);
    await assetRestore(label, session.page);
    if (['desktop-1600x1000', 'mobile-390x844'].includes(label)) await stress(label, session.page);
    const final = await metrics(session.page);
    if (final.path !== '/rwa/' || final.overflow > 4) fail(label, 'final viewport state invalid', final);
    if (session.errors.length) fail(label, 'uncaught page errors', session.errors);
    if (session.popups.length) fail(label, `opened ${session.popups.length} extra top-level page(s)`);
    results.push({ label, width, height, readyMs: session.readyMs, ok: !failures.some(x => x.scope === label), final });
  } catch (e) {
    fail(label, 'unexpected browser failure', e.message);
    if (session?.page) await session.page.screenshot({ path: `${proof}/${slug(label)}-failure.png`, fullPage: true }).catch(() => {});
  } finally {
    if (session?.context) await session.context.close();
  }
}

await browser.close();
const summary = {
  ok: failures.length === 0,
  contract: 'rwa-launch-ui-final-v1',
  publicMode,
  base,
  bridgeVersion: VERSION,
  desktop: desktop.map(([label, width, height]) => ({ label, width, height })),
  mobile: mobile.map(([label, width, height]) => ({ label, width, height })),
  stress: ['desktop-1600x1000', 'mobile-390x844'],
  assertions: ['single /rwa/ document', 'no horizontal overflow', 'no popup', 'desktop/mobile navigation', 'chart visible at startup', 'Ecommerce fail-closed', 'canonical #trade route', 'deterministic overlay close', 'asset context restore', 'route/open-close stress', 'bounded shell readiness'],
  results,
  failures
};
await writeFile(`${proof}/browser-result.json`, JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));
if (!summary.ok) process.exit(1);
