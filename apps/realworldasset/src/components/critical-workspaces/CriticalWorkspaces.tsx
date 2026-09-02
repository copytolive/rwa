"use client";

import * as React from "react";
import Link from "next/link";
import { AppShell } from "@/components/app";
import { Button } from "@/components/ui";
import {
  authorizeTestnetExecutionAgent,
  connectWalletAndAuthenticate,
  createRealCheckout,
  currentCommerceSession,
  getRuntimeCapabilities,
  logoutRealSession,
  submitRealExecutionOrder,
  type RuntimeCapabilities,
} from "@/lib/live-runtime";
import {
  getRealExecutionAccountSnapshot,
  listRealCommerceOrders,
  listRealSellerOrders,
} from "@/lib/live-ops";
import "../program-workspaces/program-workspaces.css";
import "./critical-workspaces.css";

type Kind = "merchant" | "checkout" | "businesses" | "rwa" | "portfolio" | "trade" | "account" | "wallet";
type AnyRow = Record<string, any>;

const META: Record<Kind,{title:string;subtitle:string;kicker:string}> = {
  merchant:{title:"Merchant Control",subtitle:"Seller operations are read from the authenticated commerce service. Revenue, customers and order counts are never invented when that service is unavailable.",kicker:"SELLER OPERATIONS"},
  checkout:{title:"Authoritative Checkout",subtitle:"Quote, idempotent order creation and provider payment-session issuance run only when the real commerce readiness gate is active.",kicker:"COMMERCE WRITE PATH"},
  businesses:{title:"Business Registry",subtitle:"Business discovery stays provider-gated. No storefront or company is fabricated when a verified registry feed is not available.",kicker:"VERIFIED DIRECTORY"},
  rwa:{title:"RWA Registry",subtitle:"Asset publication is evidence-gated. Unverified tokenized assets are not promoted into the public directory.",kicker:"VERIFIED ASSET CONTROL"},
  portfolio:{title:"Portfolio Evidence",subtitle:"Wallet portfolio evidence is loaded from the signed Hyperliquid TESTNET account path; absent venue data stays unavailable.",kicker:"VENUE ACCOUNT"},
  trade:{title:"BTC / USDC Trading",subtitle:"Live public price comes from Hyperliquid mainnet market data. Order writes are isolated to Hyperliquid TESTNET until the machine mainnet gate passes.",kicker:"LIVE PRICE · TESTNET EXECUTION"},
  account:{title:"Account Control",subtitle:"Signed-wallet session, execution capability and commerce capability are shown from runtime truth rather than local persona data.",kicker:"SIGNED SESSION"},
  wallet:{title:"Wallet & Venue",subtitle:"Connect a real browser wallet, sign the backend session, then read its Hyperliquid TESTNET account evidence.",kicker:"WALLET CONTROL"},
};

function shortWallet(wallet?:string){return wallet?`${wallet.slice(0,8)}…${wallet.slice(-6)}`:"Not authenticated"}
function jsonText(value:any,max=1800){try{return JSON.stringify(value,null,2).slice(0,max)}catch{return String(value)}}

function useTruth(){
  const [caps,setCaps]=React.useState<RuntimeCapabilities|null>(null);
  const [loading,setLoading]=React.useState(true);
  const refresh=React.useCallback(async()=>{setLoading(true);try{setCaps(await getRuntimeCapabilities())}finally{setLoading(false)}},[]);
  React.useEffect(()=>{void refresh();const on=()=>void refresh();window.addEventListener("rwa:session-changed",on);return()=>window.removeEventListener("rwa:session-changed",on)},[refresh]);
  return {caps,loading,refresh};
}

function StatusGrid({caps}:{caps:RuntimeCapabilities|null}){
  const rows:[[string,boolean|undefined],...Array<[string,boolean|undefined]>]=[
    ["Wallet provider",caps?.walletProvider],["Signed session",caps?.authenticated],["Commerce API",caps?.commerceReachable],
    ["Checkout",caps?.checkoutReady],["TESTNET execution",caps?.executionAvailable],["Mainnet gate",caps?.mainnetReady],
  ];
  return <div className="pw-status-grid">{rows.map(([label,ok])=><div key={label}><span>{label}</span><b data-ok={ok===true?"true":"false"}>{ok===true?"READY":"LOCKED"}</b></div>)}</div>
}

function SessionControl({refresh,onMessage}:{refresh:()=>Promise<void>;onMessage:(s:string)=>void}){
  const session=currentCommerceSession();
  if(session)return <div className="cw-toolbar"><span className="pw-wallet">Signed wallet: <b>{shortWallet(session.wallet)}</b></span><Button variant="secondary" onClick={async()=>{try{await logoutRealSession();onMessage("Wallet session revoked.");await refresh()}catch(e:any){onMessage(String(e?.message||e))}}}>Log Out</Button></div>;
  return <Button onClick={async()=>{try{const s=await connectWalletAndAuthenticate();onMessage(`Signed wallet session active: ${shortWallet(s.wallet)}`);await refresh()}catch(e:any){onMessage(String(e?.message||e))}}}>Connect & Sign Wallet</Button>
}

function Hero({kind,caps,loading,refresh,onMessage}:{kind:Kind;caps:RuntimeCapabilities|null;loading:boolean;refresh:()=>Promise<void>;onMessage:(s:string)=>void}){
  const m=META[kind];
  return <><header className="pw-hero"><div><small>RWA.MS / {m.kicker}</small><h1>{m.title}</h1><p>{m.subtitle}</p></div><div className="pw-hero-actions"><SessionControl refresh={refresh} onMessage={onMessage}/><Button variant="secondary" onClick={()=>void refresh()}>{loading?"Checking…":"Refresh truth"}</Button></div></header><StatusGrid caps={caps}/>{caps?.blockers?.length?<section className="pw-panel pw-blockers"><h2>Current blockers</h2><p>{caps.blockers.join(" · ")}</p></section>:null}</>
}

function MerchantSystem({caps,onMessage}:{caps:RuntimeCapabilities|null;onMessage:(s:string)=>void}){
  const [rows,setRows]=React.useState<AnyRow[]|null>(null);const [busy,setBusy]=React.useState(false);const session=currentCommerceSession();
  const load=async()=>{if(!session){onMessage("Signed wallet session required.");return}setBusy(true);try{const r=await listRealSellerOrders();setRows(r);onMessage(`Loaded ${r.length} seller order(s) from the commerce backend.`)}catch(e:any){setRows(null);onMessage(String(e?.message||e))}finally{setBusy(false)}};
  return <><section className="pw-grid"><article className="pw-panel"><span className="cw-kicker">Seller queue</span><div className="cw-metric">{rows===null?"—":rows.length}</div><p>{rows===null?"No authoritative seller response loaded yet.":"Count returned by the authenticated seller endpoint."}</p><Button disabled={!session||!caps?.commerceReachable||busy} onClick={load}>{busy?"Loading…":"Load Seller Orders"}</Button></article><article className="pw-panel"><span className="cw-kicker">Checkout service</span><div className="cw-metric">{caps?.checkoutReady?"READY":"LOCKED"}</div><p>Provider settlement is accepted only after the backend reports checkout readiness.</p><Link className="cw-link" href="/checkout">Open Checkout</Link></article><article className="pw-panel"><span className="cw-kicker">Merchant programs</span><h2>Operate verified flows</h2><p>Product, tokenization and compliance surfaces stay separate from seller fulfillment.</p><div className="cw-links"><Link className="cw-link" href="/merchant/orders">Fulfillment</Link><Link className="cw-link" href="/merchant/tokenization">Tokenization</Link><Link className="cw-link" href="/merchant/kyb">KYB</Link><Link className="cw-link" href="/merchant/products">Products</Link></div></article></section>{rows&&rows.length?<section className="pw-panel"><div className="cw-section-title"><div><span className="cw-kicker">Authoritative response</span><h2>Seller orders</h2></div><span className="cw-status" data-ok="true">BACKEND DATA</span></div><div className="cw-list">{rows.slice(0,12).map((r,i)=><div className="cw-list-row" key={String(r.id||i)}><b>{String(r.id||"Order")}</b><span>{String(r.status||"STATUS UNAVAILABLE")}</span><span>{String(r.fulfillment_status||r.payment_status||"")}</span></div>)}</div></section>:null}</>
}

function CheckoutSystem({caps,onMessage}:{caps:RuntimeCapabilities|null;onMessage:(s:string)=>void}){
  const session=currentCommerceSession();const [product,setProduct]=React.useState("");const [qty,setQty]=React.useState("1");const [busy,setBusy]=React.useState(false);const [result,setResult]=React.useState<any>(null);const [orders,setOrders]=React.useState<AnyRow[]|null>(null);
  const create=async()=>{if(!product.trim()){onMessage("Enter a real product ID from the configured commerce inventory.");return}setBusy(true);setResult(null);try{const r=await createRealCheckout({items:[{product_id:product.trim(),quantity:Math.max(1,Number(qty)||1)}],fulfillment:"PICKUP"});setResult(r);onMessage(`Authoritative order created: ${String(r?.order?.id||"provider response received")}`)}catch(e:any){onMessage(String(e?.message||e))}finally{setBusy(false)}};
  const loadOrders=async()=>{try{const r=await listRealCommerceOrders();setOrders(r);onMessage(`Loaded ${r.length} commerce order(s).`)}catch(e:any){setOrders(null);onMessage(String(e?.message||e))}};
  const redirect=String(result?.payment?.redirect_url||"");
  return <><section className="pw-grid"><article className="pw-panel"><span className="cw-kicker">Readiness</span><div className="cw-metric">{caps?.checkoutReady?"READY":"LOCKED"}</div><p>Commerce API: <b>{caps?.commerceReachable?"REACHABLE":"UNAVAILABLE"}</b><br/>Payment provider: <b>{caps?.paymentConfigured?"CONFIGURED":"LOCKED"}</b></p></article><article className="pw-panel"><span className="cw-kicker">Order history</span><div className="cw-metric">{orders===null?"—":orders.length}</div><p>Read only from the signed-wallet commerce session.</p><Button disabled={!session||!caps?.commerceReachable} onClick={loadOrders}>Load My Orders</Button></article><article className="pw-panel"><span className="cw-kicker">Payment authority</span><h2>Provider-owned status</h2><p>Paid state is never created by the browser. The backend and provider webhook remain authoritative.</p><Link className="cw-link" href="/account/orders">Orders & refunds</Link></article></section><section className="pw-panel"><div className="cw-section-title"><div><span className="cw-kicker">Create real transaction</span><h2>Quote → Order → Payment Session</h2></div><span className="cw-status" data-ok={caps?.checkoutReady?"true":"false"}>{caps?.checkoutReady?"WRITE PATH READY":"WRITE PATH LOCKED"}</span></div><div className="cw-form"><label className="cw-wide">Product ID<input value={product} onChange={e=>setProduct(e.target.value)} placeholder="Use a real inventory product ID"/></label><label>Quantity<input type="number" min="1" step="1" value={qty} onChange={e=>setQty(e.target.value)}/></label><label>Fulfillment<input value="PICKUP" readOnly/></label></div><Button disabled={!session||!caps?.checkoutReady||busy} onClick={create}>{busy?"Creating…":"Create Authoritative Checkout"}</Button>{result?<div className="cw-result"><pre>{jsonText({quote:result.quote,order:result.order,payment:{...result.payment,token:result.payment?.token?"ISSUED":undefined}},2200)}</pre>{/^https:\/\//i.test(redirect)?<a href={redirect} target="_blank" rel="noreferrer">Open provider payment session</a>:null}</div>:null}</section></>
}

function PortfolioSystem({kind,onMessage}:{kind:"portfolio"|"wallet";onMessage:(s:string)=>void}){
  const session=currentCommerceSession();const [snapshot,setSnapshot]=React.useState<any>(null);const [busy,setBusy]=React.useState(false);
  const load=async()=>{if(!session){onMessage("Signed wallet session required.");return}setBusy(true);try{const r=await getRealExecutionAccountSnapshot(true);setSnapshot(r);onMessage(`Hyperliquid TESTNET returned ${r.fills.length} fill(s).`)}catch(e:any){setSnapshot(null);onMessage(String(e?.message||e))}finally{setBusy(false)}};
  return <><section className="pw-grid"><article className="pw-panel"><span className="cw-kicker">Signed wallet</span><div className="cw-metric" style={{fontSize:18}}>{shortWallet(session?.wallet)}</div><p>Backend bearer session is bound to this wallet.</p></article><article className="pw-panel"><span className="cw-kicker">Venue fills</span><div className="cw-metric">{snapshot?snapshot.fills.length:"—"}</div><p>{snapshot?"Hyperliquid TESTNET userFills response loaded.":"No venue response loaded."}</p><Button disabled={!session||busy} onClick={load}>{busy?"Loading…":"Load TESTNET Account"}</Button></article><article className="pw-panel"><span className="cw-kicker">Funds</span><h2>Mainnet machine gate</h2><p>Deposit and withdrawal writes remain locked unless machine readiness passes.</p><div className="cw-links"><Link className="cw-link" href="/account/deposit">Deposit</Link><Link className="cw-link" href="/account/withdraw">Withdraw</Link></div></article></section><section className="pw-panel"><div className="cw-section-title"><div><span className="cw-kicker">Venue evidence</span><h2>{kind==="portfolio"?"Portfolio account state":"Wallet account state"}</h2></div><span className="cw-status" data-ok={snapshot?"true":"false"}>{snapshot?"TESTNET RESPONSE":"NOT LOADED"}</span></div><pre>{snapshot?jsonText(snapshot.state,3000):"No authoritative account state loaded."}</pre></section></>
}

function TradeSystem({asset,onMessage}:{asset:string;onMessage:(s:string)=>void}){
  const coin=(asset.split("-")[0]||"BTC").toUpperCase();const session=currentCommerceSession();const [mark,setMark]=React.useState<number|null>(null);const [side,setSide]=React.useState<"BUY"|"SELL">("BUY");const [type,setType]=React.useState<"MARKET"|"LIMIT">("MARKET");const [size,setSize]=React.useState("");const [price,setPrice]=React.useState("");const [lev,setLev]=React.useState("1");const [agent,setAgent]=React.useState(false);const [busy,setBusy]=React.useState(false);const [result,setResult]=React.useState<any>(null);
  const loadMark=React.useCallback(async()=>{try{const r=await fetch("https://api.hyperliquid.xyz/info",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({type:"metaAndAssetCtxs"}),cache:"no-store"});if(!r.ok)throw new Error(`Hyperliquid market HTTP ${r.status}`);const payload=await r.json();const meta=payload?.[0],ctx=payload?.[1];const i=Array.isArray(meta?.universe)?meta.universe.findIndex((x:any)=>String(x?.name||"").toUpperCase()===coin):-1;const px=Number(i>=0?ctx?.[i]?.markPx:NaN);if(!(px>0))throw new Error(`${coin} mark price unavailable`);setMark(px)}catch(e:any){setMark(null);onMessage(String(e?.message||e))}},[coin,onMessage]);
  React.useEffect(()=>{void loadMark()},[loadMark]);
  const authorize=async()=>{setBusy(true);try{const r=await authorizeTestnetExecutionAgent();setAgent(true);setResult(r);onMessage("Hyperliquid TESTNET execution agent authorized.")}catch(e:any){setAgent(false);onMessage(String(e?.message||e))}finally{setBusy(false)}};
  const submit=async()=>{const n=Number(size);if(!(n>0)){onMessage("Enter a positive order size.");return}setBusy(true);setResult(null);try{const r=await submitRealExecutionOrder({coin,side,type,size:n,price:type==="LIMIT"?Number(price):undefined,leverage:Math.max(1,Number(lev)||1),environment:"testnet"});setResult(r);onMessage("Hyperliquid TESTNET returned an order response.")}catch(e:any){onMessage(String(e?.message||e))}finally{setBusy(false)}};
  return <><section className="pw-grid"><article className="pw-panel"><span className="cw-kicker">Hyperliquid mark price</span><div className="cw-metric">{mark?`$${mark.toLocaleString(undefined,{maximumFractionDigits:2})}`:"—"}</div><p>Public mark price fetched from Hyperliquid <code>metaAndAssetCtxs</code>.</p><Button variant="secondary" onClick={()=>void loadMark()}>Refresh Price</Button></article><article className="pw-panel"><span className="cw-kicker">Execution environment</span><div className="cw-metric">TESTNET</div><p>Mainnet is not selectable from this order entry. Production remains machine-gated.</p><Button disabled={!session||busy} onClick={authorize}>{agent?"TESTNET Agent Ready":"Enable TESTNET Trading"}</Button></article><article className="pw-panel"><span className="cw-kicker">Account</span><h2>{shortWallet(session?.wallet)}</h2><p>Order signing requires the real signed-wallet session plus execution-agent authorization.</p><Link className="cw-link" href="/account/wallet">Wallet Control</Link></article></section><section className="pw-panel"><div className="cw-section-title"><div><span className="cw-kicker">Order entry</span><h2>{coin} TESTNET order</h2></div><span className="cw-status" data-warn="true">NO MAINNET WRITE</span></div><div className="cw-form"><label>Side<select value={side} onChange={e=>setSide(e.target.value as "BUY"|"SELL")}><option>BUY</option><option>SELL</option></select></label><label>Type<select value={type} onChange={e=>setType(e.target.value as "MARKET"|"LIMIT")}><option>MARKET</option><option>LIMIT</option></select></label><label>Size<input inputMode="decimal" value={size} onChange={e=>setSize(e.target.value)} placeholder="0.001"/></label><label>Leverage<input type="number" min="1" value={lev} onChange={e=>setLev(e.target.value)}/></label>{type==="LIMIT"?<label className="cw-wide">Limit price<input inputMode="decimal" value={price} onChange={e=>setPrice(e.target.value)} placeholder={mark?String(mark):"Required"}/></label>:null}</div><Button disabled={!session||!agent||busy} onClick={submit}>{busy?"Submitting…":`Submit ${side} to TESTNET`}</Button>{result?<div className="cw-result"><pre>{jsonText(result,3000)}</pre></div>:null}</section></>
}

function RegistrySystem({kind}:{kind:"businesses"|"rwa"}){
  const isRwa=kind==="rwa";
  return <section className="pw-grid"><article className="pw-panel"><span className="cw-kicker">Verified feed</span><div className="cw-metric">UNAVAILABLE</div><p>{isRwa?"No verified asset-list provider is exposed to this public browser runtime.":"No verified business-registry provider is exposed to this public browser runtime."}</p><span className="cw-status" data-warn="true">PROVIDER REQUIRED</span></article><article className="pw-panel"><span className="cw-kicker">Submission path</span><h2>{isRwa?"Asset evidence":"Business verification"}</h2><p>{isRwa?"Tokenization remains evidence-gated until verified registry and testnet receipts exist.":"A business must complete its real listing and KYB flow before it may appear as verified."}</p><div className="cw-links">{isRwa?<><Link className="cw-link" href="/merchant/tokenization">Tokenization</Link><Link className="cw-link" href="/risk-disclosure">Risk Disclosure</Link></>:<><Link className="cw-link" href="/listing-request">Listing Request</Link><Link className="cw-link" href="/compliance/kyb">KYB</Link></>}</div></article><article className="pw-panel"><span className="cw-kicker">Publication policy</span><h2>No synthetic listings</h2><p>Empty provider state remains visibly unavailable; this directory never substitutes sample companies, assets, prices, or volume.</p><Link className="cw-link" href="/docs">Evidence Requirements</Link></article></section>
}

function AccountSystem({caps}:{caps:RuntimeCapabilities|null}){
  const s=currentCommerceSession();return <section className="pw-grid"><article className="pw-panel"><span className="cw-kicker">Session</span><div className="cw-metric" style={{fontSize:18}}>{shortWallet(s?.wallet)}</div><p>{s?"Revocable bearer session is active for this wallet.":"No signed-wallet backend session is active."}</p></article><article className="pw-panel"><span className="cw-kicker">Runtime access</span><h2>{caps?.executionAvailable?"TESTNET execution ready":"Execution locked"}</h2><p>Commerce: {caps?.commerceReachable?"reachable":"unavailable"} · Checkout: {caps?.checkoutReady?"ready":"locked"}.</p></article><article className="pw-panel"><span className="cw-kicker">Controls</span><h2>Account operations</h2><div className="cw-links"><Link className="cw-link" href="/account/wallet">Wallet</Link><Link className="cw-link" href="/account/activity">Activity</Link><Link className="cw-link" href="/account/orders">Orders</Link><Link className="cw-link" href="/account/deposit">Deposit</Link><Link className="cw-link" href="/account/withdraw">Withdraw</Link><Link className="cw-link" href="/account/api">API</Link><Link className="cw-link" href="/account/billing">Billing</Link></div></article></section>
}

export function CriticalLiveWorkspace({kind,asset="btc-usdc"}:{kind:Kind;asset?:string}){
  const {caps,loading,refresh}=useTruth();const [message,setMessage]=React.useState("");
  const onMessage=React.useCallback((s:string)=>setMessage(s),[]);
  return <AppShell><main className="pw-page" data-critical-live-workspace={kind}><Hero kind={kind} caps={caps} loading={loading} refresh={refresh} onMessage={onMessage}/>{kind==="merchant"?<MerchantSystem caps={caps} onMessage={onMessage}/>:null}{kind==="checkout"?<CheckoutSystem caps={caps} onMessage={onMessage}/>:null}{kind==="portfolio"||kind==="wallet"?<PortfolioSystem kind={kind} onMessage={onMessage}/>:null}{kind==="trade"?<TradeSystem asset={asset} onMessage={onMessage}/>:null}{kind==="businesses"||kind==="rwa"?<RegistrySystem kind={kind}/>:null}{kind==="account"?<AccountSystem caps={caps}/>:null}{message?<div className="pw-notice" role="status">{message}</div>:null}</main></AppShell>
}
