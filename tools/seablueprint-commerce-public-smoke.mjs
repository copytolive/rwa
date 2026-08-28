import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';

const base = process.env.RWA_PUBLIC_URL || 'https://copytolive.github.io/rwa/';
const proof = process.env.RWA_PUBLIC_PROOF_DIR || 'proof/seablueprint-commerce-public';
await mkdir(proof, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1536, height: 1000 }, serviceWorkers: 'block' });
const page = await context.newPage();
const opened = [];
context.on('page', p => { if (p !== page) opened.push(p); });
const pageErrors = [];
page.on('pageerror', e => pageErrors.push(String(e.message || e)));

const cache = `public-smoke-${Date.now()}`;
const root = new URL(base);
root.searchParams.set('__rwa_public_smoke', cache);

try {
  await page.goto(root.href, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForFunction(() => window.RWASeablueprintCommerceBridge?.version === '1.2.4' && window.RWASuperApp?.version, { timeout: 30000 });
  await page.waitForSelector('#rwaSeablueprintCommerceLaunch', { state: 'visible', timeout: 20000 });

  const publicBytes = await page.evaluate(async nonce => {
    async function text(path) {
      const r = await fetch(`${path}?__public_verify=${encodeURIComponent(nonce)}`, { cache: 'no-store' });
      return { ok: r.ok, status: r.status, text: await r.text() };
    }
    const [bridge, chart, configRaw, deployed] = await Promise.all([
      text('rwa-seablueprint-commerce-bridge.js'),
      text('chart-core.js'),
      text('rwa-commerce-config.json'),
      text('deployment-sha.txt')
    ]);
    let config = null;
    try { config = JSON.parse(configRaw.text); } catch {}
    return { bridge, chart, configRaw, config, deployed };
  }, cache);

  if (!publicBytes.bridge.ok) throw Error(`public bridge HTTP ${publicBytes.bridge.status}`);
  if (!publicBytes.chart.ok) throw Error(`public chart-core HTTP ${publicBytes.chart.status}`);
  if (!publicBytes.configRaw.ok) throw Error(`public commerce config HTTP ${publicBytes.configRaw.status}`);
  if (!publicBytes.deployed.ok || !/^[0-9a-f]{40}\s*$/i.test(publicBytes.deployed.text)) throw Error(`public deployment SHA invalid: ${publicBytes.deployed.text}`);
  if (!/VERSION=['"]1\.2\.4['"]/.test(publicBytes.bridge.text)) throw Error('public bridge is not V1.2.4');
  if (!publicBytes.bridge.text.includes('hardCloseShell') || !publicBytes.bridge.text.includes("window.addEventListener('click',captureClick,true)")) throw Error('public bridge missing deterministic earliest-capture overlay close');
  if (!publicBytes.chart.text.includes('rwa-seablueprint-commerce-bridge.js?v=1.2.4')) throw Error('public chart-core is not loading bridge V1.2.4');
  const cfg = publicBytes.config || {};
  if (cfg.shell_mode !== 'SINGLE_MAIN_DOCUMENT') throw Error(`public shell_mode mismatch: ${cfg.shell_mode}`);
  if (cfg.navigation_policy !== 'NO_TOP_LEVEL_ECOMMERCE_NAVIGATION') throw Error(`public navigation policy mismatch: ${cfg.navigation_policy}`);
  if (cfg.source !== 'SEABLUEPRINT_COMMERCE') throw Error(`public commerce source mismatch: ${cfg.source}`);
  if (cfg.api_base !== '') throw Error('public commerce api_base must remain fail-closed');

  const rootPath = await page.evaluate(() => location.pathname);
  if (rootPath !== '/rwa/') throw Error(`public root pathname mismatch: ${rootPath}`);

  await page.evaluate(() => window.RWASuperApp.navigate('asset/PENDLE'));
  await page.waitForFunction(() => location.hash === '#asset/PENDLE' && document.body.classList.contains('rwa-super-asset-workspace'), { timeout: 20000 });
  const before = await page.evaluate(() => ({ path: location.pathname, hash: location.hash }));

  await page.locator('#rwaSeablueprintCommerceLaunch').click();
  await page.waitForFunction(() => document.querySelector('#rwaShopScreen')?.classList.contains('open'), { timeout: 20000 });
  await page.waitForSelector('[data-seablueprint-source]', { state: 'visible', timeout: 15000 });

  const openedState = await page.evaluate(() => ({
    path: location.pathname,
    hash: location.hash,
    brand: document.querySelector('#rwaShopScreen .rwa-shop-brand b')?.textContent || '',
    source: document.querySelector('[data-seablueprint-source]')?.textContent || '',
    audit: window.RWASeablueprintCommerceBridge.audit(),
    overflow: Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth)
  }));
  if (openedState.path !== '/rwa/' || openedState.hash !== '#shop') throw Error(`public ecommerce escaped shell: ${JSON.stringify(openedState)}`);
  if (!/Seablueprint Ecommerce/i.test(openedState.brand)) throw Error(`public Seablueprint brand missing: ${openedState.brand}`);
  if (!/BACKEND LOCKED/.test(openedState.source)) throw Error('public fail-closed backend badge missing');
  if (!openedState.audit?.ok || openedState.audit?.apiBaseConfigured) throw Error(`public commerce audit failed: ${JSON.stringify(openedState.audit)}`);
  if (openedState.overflow > 4) throw Error(`public desktop horizontal overflow: ${openedState.overflow}`);

  const trade = page.locator('#rwaShopScreen [data-rwa-shop-trade]').first();
  if (!(await trade.count())) throw Error('public ecommerce has no canonical trade link');
  const tradeHref = await trade.getAttribute('href');
  if (!/^#trade\/[A-Za-z0-9]+$/.test(tradeHref || '')) throw Error(`public trade href is not canonical: ${tradeHref}`);
  await trade.click();
  try {
    await page.waitForFunction(() => location.pathname === '/rwa/' && location.hash.startsWith('#trade/') && !document.querySelector('#rwaShopScreen')?.classList.contains('open'), { timeout: 30000 });
  } catch (error) {
    const state = await page.evaluate(() => ({ path: location.pathname, hash: location.hash, route: document.documentElement.dataset.rwaRoute || '', shopOpen: document.querySelector('#rwaShopScreen')?.classList.contains('open'), commerce: window.RWASeablueprintCommerceBridge?.audit?.() }));
    await writeFile(`${proof}/trade-timeout-state.json`, JSON.stringify(state, null, 2));
    await page.screenshot({ path: `${proof}/trade-timeout.png`, fullPage: true });
    throw new Error(`public trade transition timeout: ${JSON.stringify(state)} :: ${error.message}`);
  }
  const afterTrade = await page.evaluate(() => ({ path: location.pathname, hash: location.hash, shopOpen: document.querySelector('#rwaShopScreen')?.classList.contains('open') }));
  if (afterTrade.path !== '/rwa/' || afterTrade.shopOpen) throw Error(`public trade handoff failed: ${JSON.stringify(afterTrade)}`);

  await page.evaluate(() => window.RWASuperApp.navigate('asset/PENDLE'));
  await page.waitForFunction(() => location.hash === '#asset/PENDLE' && document.body.classList.contains('rwa-super-asset-workspace'), { timeout: 20000 });
  await page.locator('#rwaSeablueprintCommerceLaunch').click();
  await page.waitForFunction(() => document.querySelector('#rwaShopScreen')?.classList.contains('open'), { timeout: 20000 });
  await page.locator('#rwaShopClose').click();
  await page.waitForFunction(() => !document.querySelector('#rwaShopScreen')?.classList.contains('open') && location.hash === '#asset/PENDLE', { timeout: 20000 });
  const restored = await page.evaluate(() => ({ path: location.pathname, hash: location.hash }));
  if (restored.path !== before.path || restored.hash !== before.hash) throw Error(`public asset context was not restored: ${JSON.stringify({ before, restored })}`);

  await page.screenshot({ path: `${proof}/01-public-desktop.png`, fullPage: true });
  if (opened.length) throw Error(`public ecommerce opened ${opened.length} extra top-level page(s)`);
  if (pageErrors.length) throw Error(`public desktop page errors: ${pageErrors.join(' | ')}`);

  const mobile = await context.newPage();
  const mobileErrors = [];
  mobile.on('pageerror', e => mobileErrors.push(String(e.message || e)));
  await mobile.setViewportSize({ width: 390, height: 844 });
  const mobileUrl = new URL(base); mobileUrl.searchParams.set('__rwa_public_mobile', cache);
  await mobile.goto(mobileUrl.href, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await mobile.waitForFunction(() => window.RWASeablueprintCommerceBridge?.version === '1.2.4' && window.RWASuperApp?.version, { timeout: 30000 });
  await mobile.waitForSelector('#rwaSeablueprintCommerceLaunch', { state: 'visible', timeout: 20000 });
  await mobile.locator('#rwaSeablueprintCommerceLaunch').click();
  await mobile.waitForFunction(() => document.querySelector('#rwaShopScreen')?.classList.contains('open'), { timeout: 20000 });
  const mobileState = await mobile.evaluate(() => ({
    path: location.pathname,
    audit: window.RWASeablueprintCommerceBridge.audit(),
    overflow: Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth)
  }));
  if (mobileState.path !== '/rwa/' || !mobileState.audit?.ok || mobileState.overflow > 4) throw Error(`public mobile single-shell failed: ${JSON.stringify(mobileState)}`);
  await mobile.screenshot({ path: `${proof}/02-public-mobile.png`, fullPage: true });
  await mobile.locator('#rwaShopClose').click();
  await mobile.waitForFunction(() => !document.querySelector('#rwaShopScreen')?.classList.contains('open'), { timeout: 20000 });
  if (mobileErrors.length) throw Error(`public mobile page errors: ${mobileErrors.join(' | ')}`);
  await mobile.close();

  const result = {
    ok: true,
    contract: 'seablueprint-commerce-public-sync-v1.2.4',
    publicUrl: base,
    deployedSha: publicBytes.deployed.text.trim(),
    version: '1.2.4',
    staticBytesVerified: true,
    configFailClosed: true,
    singleShellInteractionVerified: true,
    canonicalTradeVerified: true,
    deterministicOverlayCloseVerified: true,
    assetContextRestored: true,
    noPopups: opened.length === 0,
    desktop1536: true,
    mobile390: true
  };
  await writeFile(`${proof}/browser-result.json`, JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  try {
    const failure = await page.evaluate(() => ({ path: location.pathname, hash: location.hash, route: document.documentElement.dataset.rwaRoute || '', shopOpen: document.querySelector('#rwaShopScreen')?.classList.contains('open'), bridge: window.RWASeablueprintCommerceBridge?.version || '', commerce: window.RWASeablueprintCommerceBridge?.audit?.() || null }));
    await writeFile(`${proof}/failure-state.json`, JSON.stringify({ error: String(error.message || error), ...failure }, null, 2));
    await page.screenshot({ path: `${proof}/failure.png`, fullPage: true });
  } catch {}
  throw error;
} finally {
  await context.close();
  await browser.close();
}