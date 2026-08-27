import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';

const URL=process.env.RWA_TEST_URL||'http://127.0.0.1:4173/rwa/';
const OUT=process.env.RWA_PROOF_DIR||'proof/multichain-v1';
await mkdir(OUT,{recursive:true});
const browser=await chromium.launch({headless:true});
const report={contract:'rwa-multichain-browser-v1',url:URL,ok:true,viewports:[],errors:[]};

async function runViewport(width,height,label){
  const context=await browser.newContext({viewport:{width,height}});
  const page=await context.newPage();
  const pageErrors=[];const directWrites=[];
  page.on('pageerror',e=>pageErrors.push(String(e?.message||e)));
  page.on('request',r=>{try{const u=new URL(r.url());if(/\/exchange(?:$|[/?#])/.test(u.pathname))directWrites.push({method:r.method(),url:r.url()})}catch{}});
  await page.goto(URL,{waitUntil:'domcontentloaded',timeout:45000});
  await page.waitForFunction(()=>window.RWAMultiChain?.version==='1.0.0',{timeout:20000});
  await page.waitForSelector('#rwaMultiChainLaunch',{state:'visible',timeout:10000});

  const baseHash=await page.evaluate(()=>location.hash);
  const chartToken='mc-'+Date.now()+'-'+label;
  await page.evaluate(token=>{const c=document.querySelector('.chart-wrap');if(c)c.dataset.multichainProof=token},chartToken);
  const launcherText=(await page.locator('#rwaMultiChainLaunch').innerText()).trim();
  if(!launcherText.includes('MULTI CHAIN'))throw Error(`${label}: launcher text missing`);

  await page.locator('#rwaMultiChainLaunch').click();
  await page.waitForSelector('#rwaMultiChainPanel',{state:'visible'});
  const status=await page.evaluate(()=>window.RWAMultiChain.status());
  if(status.policy!=='chain-abstraction-fail-closed-v1')throw Error(`${label}: policy mismatch`);
  if(status.networks.length<8)throw Error(`${label}: expected >=8 networks, got ${status.networks.length}`);
  const cards=await page.locator('[data-rwa-chain]').count();
  if(cards<8)throw Error(`${label}: expected >=8 visible network cards, got ${cards}`);

  const chartSurvived=await page.evaluate(token=>document.querySelector('.chart-wrap')?.dataset.multichainProof===token,chartToken);
  if(!chartSurvived)throw Error(`${label}: market chart DOM was remounted while opening MULTI CHAIN`);
  const panelBox=await page.locator('#rwaMultiChainPanel').boundingBox();
  if(!panelBox)throw Error(`${label}: panel has no geometry`);
  if(width>900&&Math.abs(panelBox.width-440)>2)throw Error(`${label}: desktop panel width ${panelBox.width}, expected 440`);
  if(width<=680&&Math.abs(panelBox.width-width)>2)throw Error(`${label}: mobile panel width ${panelBox.width}, expected viewport ${width}`);

  await page.locator('[data-rwa-chain="solana"]').click();
  const solStatus=await page.evaluate(()=>window.RWAMultiChain.status());
  if(solStatus.selected!=='solana')throw Error(`${label}: Solana selection did not persist in runtime state`);
  const solBadge=(await page.locator('.rwa-mc-badge').innerText()).trim();
  if(solBadge!=='ADAPTER GATED')throw Error(`${label}: Solana must be ADAPTER GATED, got ${solBadge}`);
  const solContinue=page.locator('[data-rwa-mc-continue]');
  if(!(await solContinue.isDisabled()))throw Error(`${label}: unvalidated Solana adapter is not fail-closed`);
  if((await page.evaluate(()=>location.hash))!==baseHash)throw Error(`${label}: gated-chain selection navigated unexpectedly`);
  if(directWrites.length)throw Error(`${label}: network selector emitted direct exchange write request`);

  await page.locator('[data-rwa-chain="hyperliquid"]').click();
  const hyperBadge=(await page.locator('.rwa-mc-badge').innerText()).trim();
  if(hyperBadge!=='PROTECTED EXECUTION')throw Error(`${label}: Hyperliquid gate label mismatch`);
  const hyperAction=(await page.locator('[data-rwa-mc-continue]').innerText()).trim();
  if(!/protected trade/i.test(hyperAction))throw Error(`${label}: Hyperliquid protected trade action missing`);

  await page.screenshot({path:path.join(OUT,`${label}-multichain-open.png`),fullPage:true});
  await page.locator('.rwa-mc-close').click();
  await page.waitForFunction(()=>document.getElementById('rwaMultiChainPanel')?.hidden===true);
  const closedChart=await page.evaluate(token=>document.querySelector('.chart-wrap')?.dataset.multichainProof===token,chartToken);
  if(!closedChart)throw Error(`${label}: market chart DOM changed after closing MULTI CHAIN`);
  if(directWrites.length)throw Error(`${label}: direct exchange write observed: ${JSON.stringify(directWrites)}`);

  report.viewports.push({label,width,height,cards,panelWidth:panelBox.width,policy:status.policy,selectedAfterSolana:solStatus.selected,hyperAction,pageErrors,directWrites,chartSurvived:true});
  if(pageErrors.length)report.errors.push(...pageErrors.map(x=>`${label}: ${x}`));
  await context.close();
}

try{
  await runViewport(1600,1000,'desktop-1600x1000');
  await runViewport(390,844,'mobile-390x844');
  if(report.errors.length)throw Error(`browser page errors: ${report.errors.join(' | ')}`);
}catch(e){report.ok=false;report.failure=String(e?.stack||e);}
await writeFile(path.join(OUT,'report.json'),JSON.stringify(report,null,2)+'\n');
await browser.close();
console.log(JSON.stringify(report,null,2));
if(!report.ok)process.exit(1);
