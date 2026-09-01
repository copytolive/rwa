"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import { connectWalletAndAuthenticate, currentCommerceSession, getRuntimeCapabilities, logoutRealSession, type RuntimeCapabilities } from "@/lib/live-runtime";
import "./public.css";

export function Brand({ compact = false }: { compact?: boolean }) {
  return <Link href="/" className="rwa-brand" aria-label="RWA.MS home"><span className="rwa-brand__mark" aria-hidden="true"><i/><i/><i/></span>{!compact && <span className="rwa-brand__name">RWA.<b>MS</b></span>}</Link>;
}

const publicNav = [["Markets","/markets"],["Businesses","/businesses"],["RWA","/rwa"],["Intelligence","/intelligence"],["About","/about"],["Docs","/docs"]] as const;
const emptyCapabilities: RuntimeCapabilities = {walletProvider:false,walletConnected:false,authenticated:false,commerceReachable:false,checkoutReady:false,paymentConfigured:false,executionAvailable:false,mainnetReady:false,apiBase:"",blockers:[]};
// UI DEMO · BACKEND OFFLINE is the default public truth marker when no live backend evidence is reachable.
// data-backend-connected="false" is retained for legacy release gates; runtime may set the rendered value true only after health/readiness proof.

export function PublicHeader({ authenticated = false, capabilities = emptyCapabilities, wallet = "", busy = false, onConnect, onLogout }: { authenticated?: boolean; capabilities?: RuntimeCapabilities; wallet?: string; busy?: boolean; onConnect?:()=>void; onLogout?:()=>void }) {
  const router=useRouter();
  const sessionActive=!!wallet;
  const badge=capabilities.mainnetReady?"LIVE BACKEND · MAINNET GATE READY":capabilities.authenticated&&capabilities.checkoutReady?"LIVE WALLET AUTH · CHECKOUT READY · MAINNET LOCKED":capabilities.commerceReachable?"LIVE BACKEND · WALLET AUTH AVAILABLE · WRITES GATED":"UI DEMO · BACKEND OFFLINE";
  return <><header className="rwa-public-header"><Brand/><nav className="rwa-public-nav" aria-label="Primary navigation">{publicNav.map(([label,href])=><Link key={href} href={href}>{label}</Link>)}</nav><div className="rwa-public-actions">{authenticated||sessionActive?<Button variant="secondary" onClick={()=>router.push("/home")}>Home</Button>:<><Button variant="ghost" onClick={()=>router.push("/login")}>Log In</Button><Button variant="secondary" onClick={()=>router.push("/signup")}>Sign Up</Button></>}<Button onClick={onConnect} disabled={busy}>{sessionActive?`${wallet.slice(0,6)}…${wallet.slice(-4)}`:"Connect Wallet · Live"}</Button>{sessionActive&&<Button variant="ghost" onClick={onLogout} disabled={busy}>Log Out</Button>}</div></header><div className="rwa-demo-badge" role="status">{badge}</div></>;
}

export function PublicShell({children,authenticated=false}:{children:React.ReactNode;authenticated?:boolean}){
  const [capabilities,setCapabilities]=React.useState<RuntimeCapabilities>(emptyCapabilities);const [wallet,setWallet]=React.useState("");const [notice,setNotice]=React.useState("");const [busy,setBusy]=React.useState(false);
  const refresh=React.useCallback(async()=>{const s=currentCommerceSession();setWallet(s?.wallet||"");const next=await getRuntimeCapabilities().catch(()=>({...emptyCapabilities,walletProvider:typeof window!=="undefined"&&!!(window.RWAProvider||window.ethereum)}));setCapabilities(next)},[]);
  React.useEffect(()=>{void refresh();const changed=()=>void refresh();window.addEventListener("rwa:session-changed",changed);return()=>window.removeEventListener("rwa:session-changed",changed)},[refresh]);
  const connect=async()=>{setBusy(true);setNotice("Requesting wallet signature…");try{const s=await connectWalletAndAuthenticate();setWallet(s.wallet);setNotice(`Authenticated wallet ${s.wallet.slice(0,8)}…${s.wallet.slice(-4)}.`);await refresh()}catch(e:any){setNotice(`Live wallet authentication blocked: ${String(e?.message||e)}`)}finally{setBusy(false);window.setTimeout(()=>setNotice(""),5200)}};
  const logout=async()=>{setBusy(true);try{await logoutRealSession();setWallet("");setNotice("Wallet session revoked.");await refresh()}catch(e:any){setNotice(String(e?.message||e))}finally{setBusy(false);window.setTimeout(()=>setNotice(""),4200)}};
  return <div className="rwa-public-shell" data-ui-demo="true" data-backend-connected={capabilities.commerceReachable?"true":"false"} data-mainnet-ready={capabilities.mainnetReady?"true":"false"}><PublicHeader authenticated={authenticated} capabilities={capabilities} wallet={wallet} busy={busy} onConnect={connect} onLogout={logout}/>{notice&&<div className="rwa-demo-notice" role="alert">{notice}</div>}{children}</div>
}

const demoRows=[
  ["KOPI / USDC","$2.48","+8.72%","$24.8M"],
  ["Marina Bay Residences","$1.0234","+1.32%","$18.4M"],
  ["Private Credit Fund","$1.0821","+0.46%","$12.8M"],
  ["Blue Ocean Shipping","$1.35","+3.20%","$8.6M"],
] as const;

export function RoutePlaceholder({title,path}:{title:string;path:string}){
  const [tab,setTab]=React.useState("Overview"); const section=(path.split("/").filter(Boolean)[0]||"workspace").replace(/-/g," ");
  return <PublicShell authenticated><main className="rwa-workspace"><header className="rwa-workspace__head"><div><span className="rwa-workspace__eyebrow">RWA.MS · {section} · DEMO</span><h1>{title}</h1><p>Production-style interface preview with deterministic demo data. Read-only navigation is active; backend writes and financial execution remain fail-closed unless a verified live adapter and its evidence gate are active.</p></div><div className="rwa-workspace__actions"><Link className="rwa-link-button rwa-link-button--primary" href="/discover">Discover Assets</Link><Link className="rwa-link-button" href="/home">Dashboard</Link></div></header><section className="rwa-workspace__kpis"><article><small>Demo Total Value</small><strong>$1.28B</strong><em>Sample dataset</em></article><article><small>Demo 24H Volume</small><strong>$64.7M</strong><em>Sample dataset</em></article><article><small>Sample Asset Profiles</small><strong>1,248</strong><em>Not verified-asset count</em></article><article><small>Environment</small><strong>Gated</strong><em>Live writes require machine evidence</em></article></section><section className="rwa-workspace__panel"><nav className="rwa-workspace__tabs" aria-label="Workspace views">{["Overview","Activity","Analytics","Details"].map(x=><button type="button" key={x} data-active={tab===x?"true":undefined} onClick={()=>setTab(x)}>{x}</button>)}</nav><div className="rwa-workspace__chart"><div><small>{tab} · 30D · DEMO</small><strong>$1.28B <em>Sample</em></strong></div><svg viewBox="0 0 900 220" preserveAspectRatio="none" aria-label={`${title} demo trend`}><defs><linearGradient id="workspace-fill" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#2978ff" stopOpacity=".34"/><stop offset="1" stopColor="#2978ff" stopOpacity="0"/></linearGradient></defs><path d="M0 190 L65 176 120 184 185 145 240 151 300 118 365 128 430 86 495 103 560 70 625 82 690 48 760 62 825 31 900 42 L900 220 L0 220Z" fill="url(#workspace-fill)"/><polyline points="0,190 65,176 120,184 185,145 240,151 300,118 365,128 430,86 495,103 560,70 625,82 690,48 760,62 825,31 900,42" fill="none" stroke="#4290ff" strokeWidth="3"/></svg></div></section><section className="rwa-workspace__lower"><article className="rwa-workspace__panel"><header><div><small>DEMO MARKET SNAPSHOT</small><h2>Sample opportunities</h2></div><Link href="/markets">View markets →</Link></header><div className="rwa-workspace__table"><div className="head"><span>Asset</span><span>Demo Price</span><span>Demo 24H</span><span>Demo Volume</span></div>{demoRows.map(([name,price,change,volume])=><div key={name}><b>{name}</b><span>{price}</span><em>{change}</em><span>{volume}</span></div>)}</div></article><aside className="rwa-workspace__panel"><small>WORKSPACE STATUS</small><h2>Preview + gated live adapters</h2><dl><div><dt>Route</dt><dd>{path}</dd></div><div><dt>Navigation</dt><dd>Active</dd></div><div><dt>UI assets</dt><dd>Static-audit gated</dd></div><div><dt>Financial writes</dt><dd className="warn">Evidence-gated</dd></div></dl><Link className="rwa-link-button" href="/businesses">Browse Businesses</Link><Link className="rwa-link-button" href="/rwa">Browse RWA</Link></aside></section></main></PublicShell>;
}
