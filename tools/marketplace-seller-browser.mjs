import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
const url=process.env.RWA_SELLER_URL||'http://127.0.0.1:4173/rwa/marketplace-seller.html';
const proof=process.env.RWA_PROOF_DIR||'proof/marketplace-v7';
await mkdir(proof,{recursive:true});
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1000}});
const errors=[];page.on('pageerror',e=>errors.push(String(e.message||e)));
await page.goto(url,{waitUntil:'networkidle'});
const state=await page.evaluate(()=>({
  backend:document.getElementById('backendState')?.textContent,
  session:document.getElementById('sellerSession')?.textContent,
  saveDisabled:document.getElementById('saveProduct')?.disabled,
  gate:document.getElementById('sellerGate')?.textContent,
  hasWalletProvider:!!window.ethereum
}));
if(state.backend!=='BACKEND LOCKED')throw Error('seller console must show backend locked while api_base is blank');
if(state.session!=='LOCKED')throw Error('seller session must start locked');
if(state.saveDisabled!==true)throw Error('seller product write must start disabled');
if(!/read-only/i.test(state.gate||''))throw Error('seller fail-closed disclosure missing');
await page.screenshot({path:`${proof}/seller-desktop.png`,fullPage:true});
const result={contract:'rwa-marketplace-seller-browser-v1',ok:errors.length===0,url,state,errors};
await writeFile(`${proof}/seller-result.json`,JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result,null,2));
await browser.close();
if(errors.length)process.exit(1);
