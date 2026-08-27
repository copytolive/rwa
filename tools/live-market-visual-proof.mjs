import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';

const BASE = process.env.RWA_TEST_URL || 'https://copytolive.github.io/rwa/';
const OUT = path.resolve(process.env.RWA_PROOF_OUT || 'artifacts/live-market-visual-proof');
await fs.mkdir(OUT, { recursive: true });

const routes = ['intelligence','assets','research','portfolio','institutional'];
const report = { generatedAt: new Date().toISOString(), base: BASE, desktop: [], mobile: [], status: 'RUNNING' };

function slim(r){
  if(!r) return r;
  return {
    route:r.route, path:r.path, hash:r.hash, sameChartNode:r.sameChartNode,
    layoutDisplay:r.layoutDisplay, chartDisplay:r.chartDisplay,
    chartRect:r.chartRect, workspaceRect:r.workspaceRect, workspacePosition:r.workspacePosition,
    superOpen:r.superOpen, suiteOpen:r.suiteOpen
  };
}

async function ready(page){
  await page.waitForFunction(() => window.RWASuperApp?.version === '5.0.0', { timeout: 30000 });
  await page.waitForFunction(() => window.RWAMarketPerformanceGuard?.persistent_market_workspaces === 'css-core-router-v3', { timeout: 30000 });
  await page.waitForSelector('.chart-wrap', { state:'visible', timeout:30000 });
  await page.waitForTimeout(700);
}

async function state(page, route){
  return page.evaluate((route) => {
    const layout = document.querySelector('.layout');
    const chart = document.querySelector('.chart-wrap');
    const workspace = document.getElementById('rwaSuperWorkspace');
    const suite = document.getElementById('suite');
    const visible = (el) => !!el && getComputedStyle(el).display !== 'none' && el.getBoundingClientRect().width > 0 && el.getBoundingClientRect().height > 0;
    const active = visible(workspace) ? workspace : (visible(suite) ? suite : null);
    const rect = el => el ? (() => { const r=el.getBoundingClientRect(); return {x:r.x,y:r.y,w:r.width,h:r.height}; })() : null;
    return {
      route,
      path: location.pathname,
      hash: location.hash,
      sameChartNode: chart === window.__rwaProofChartNode,
      layoutDisplay: layout ? getComputedStyle(layout).display : null,
      chartDisplay: chart ? getComputedStyle(chart).display : null,
      chartRect: rect(chart),
      workspaceRect: rect(active),
      workspacePosition: active ? getComputedStyle(active).position : null,
      superOpen: document.body.classList.contains('rwa-super-workspace-open'),
      suiteOpen: document.body.classList.contains('rwa-super-suite-open')
    };
  }, route);
}

function assertMarketStillVisible(s, mobile=false){
  assert.equal(s.path, '/rwa/', `${s.route}: escaped /rwa/`);
  assert.equal(s.sameChartNode, true, `${s.route}: chart node replaced`);
  assert.notEqual(s.layoutDisplay, 'none', `${s.route}: .layout hidden`);
  assert.notEqual(s.chartDisplay, 'none', `${s.route}: chart hidden`);
  assert.ok(s.chartRect && s.chartRect.w > (mobile ? 250 : 450), `${s.route}: chart width collapsed ${JSON.stringify(s.chartRect)}`);
  assert.ok(s.chartRect && s.chartRect.h > 180, `${s.route}: chart height collapsed ${JSON.stringify(s.chartRect)}`);
  if (s.route !== 'markets') {
    assert.ok(s.workspaceRect && s.workspaceRect.w > 250 && s.workspaceRect.h > 180, `${s.route}: dock/sheet missing`);
    assert.equal(s.workspacePosition, 'fixed', `${s.route}: workspace is not dock/sheet`);
  }
}

async function screenshot(page, label){
  const file = path.join(OUT, `${label}.png`);
  await page.screenshot({ path:file, fullPage:false });
  return file;
}

const browser = await chromium.launch({ headless:true });
try {
  const desktop = await browser.newContext({ viewport:{width:1600,height:1000}, serviceWorkers:'block' });
  const p = await desktop.newPage();
  const pageErrors=[];
  p.on('pageerror', e => pageErrors.push(String(e?.message || e)));
  await p.goto(`${BASE}?visualProof=${Date.now()}`, { waitUntil:'domcontentloaded', timeout:45000 });
  await ready(p);
  await p.evaluate(() => { window.__rwaProofChartNode = document.querySelector('.chart-wrap'); });

  let s = await state(p, 'markets');
  assertMarketStillVisible(s, false);
  await screenshot(p, 'desktop-00-markets');
  report.desktop.push(slim(s));

  for (let i=0;i<routes.length;i++) {
    const route = routes[i];
    const nav = p.locator(`[data-v5-route="${route}"]:visible`).first();
    assert.ok(await nav.count(), `${route}: visible physical nav button missing`);
    await nav.click();
    await p.waitForFunction(r => location.hash === `#${r}`, route, { timeout:10000 });
    await p.waitForTimeout(route === 'portfolio' ? 900 : 450);
    s = await state(p, route);
    assertMarketStillVisible(s, false);
    await screenshot(p, `desktop-${String(i+1).padStart(2,'0')}-${route}`);
    report.desktop.push(slim(s));
  }

  await p.evaluate(() => window.RWASuperApp.navigate('asset/ONDO'));
  await p.waitForTimeout(600);
  s = await state(p, 'asset-ONDO');
  assertMarketStillVisible(s, false);
  await screenshot(p, 'desktop-06-asset-ONDO');
  report.desktop.push(slim(s));

  assert.equal(pageErrors.length, 0, `desktop page errors: ${pageErrors.join(' | ')}`);
  await desktop.close();

  const mobile = await browser.newContext({ viewport:{width:390,height:844}, isMobile:true, hasTouch:true, serviceWorkers:'block' });
  const m = await mobile.newPage();
  const mobileErrors=[];
  m.on('pageerror', e => mobileErrors.push(String(e?.message || e)));
  await m.goto(`${BASE}?visualProofMobile=${Date.now()}`, { waitUntil:'domcontentloaded', timeout:45000 });
  await ready(m);
  await m.evaluate(() => { window.__rwaProofChartNode = document.querySelector('.chart-wrap'); });

  s = await state(m, 'markets');
  assertMarketStillVisible(s, true);
  await screenshot(m, 'mobile-00-markets');
  report.mobile.push(slim(s));

  for (let i=0;i<routes.length;i++) {
    const route = routes[i];
    await m.evaluate(r => window.RWASuperApp.navigate(r), route);
    await m.waitForFunction(r => location.hash === `#${r}`, route, { timeout:10000 });
    await m.waitForTimeout(route === 'portfolio' ? 900 : 450);
    s = await state(m, route);
    assertMarketStillVisible(s, true);
    assert.ok(s.workspaceRect.y > 30 && s.workspaceRect.y < 720, `${route}: mobile sheet geometry invalid ${JSON.stringify(s.workspaceRect)}`);
    await screenshot(m, `mobile-${String(i+1).padStart(2,'0')}-${route}`);
    report.mobile.push(slim(s));
  }

  assert.equal(mobileErrors.length, 0, `mobile page errors: ${mobileErrors.join(' | ')}`);
  await mobile.close();

  report.status='PASS';
  await fs.writeFile(path.join(OUT,'report.json'), JSON.stringify(report,null,2));
  console.log('LIVE_MARKET_VISUAL_PROOF=PASS');
  console.log('LIVE_MARKET_DESKTOP_ALL_ROUTES=PASS');
  console.log('LIVE_MARKET_MOBILE_ALL_ROUTES=PASS');
  console.log('LIVE_MARKET_REPORT', JSON.stringify(report));
} catch (e) {
  report.status='FAIL';
  report.error=String(e?.stack || e);
  await fs.writeFile(path.join(OUT,'report.json'), JSON.stringify(report,null,2));
  console.error('LIVE_MARKET_VISUAL_PROOF=FAIL');
  throw e;
} finally {
  await browser.close();
}
