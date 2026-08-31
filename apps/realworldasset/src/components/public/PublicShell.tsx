"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import { ConnectWalletModal } from "@/components/overlays";
import "./public.css";

export function Brand({ compact = false }: { compact?: boolean }) {
  return <Link href="/" className="rwa-brand" aria-label="RWA.MS home"><span className="rwa-brand__mark" aria-hidden="true"><i/><i/><i/></span>{!compact && <span className="rwa-brand__name">RWA.<b>MS</b></span>}</Link>;
}

const publicNav = [["Markets","/markets"],["Businesses","/businesses"],["RWA","/rwa"],["Intelligence","/intelligence"],["About","/about"],["Docs","/docs"]] as const;

export function PublicHeader({ authenticated = false }: { authenticated?: boolean }) {
  const router=useRouter(); const [walletOpen,setWalletOpen]=React.useState(false); const [connectedWallet,setConnectedWallet]=React.useState<string|null>(null); const [notice,setNotice]=React.useState("");
  return <><header className="rwa-public-header"><Brand/><nav className="rwa-public-nav" aria-label="Primary navigation">{publicNav.map(([label,href])=><Link key={href} href={href}>{label}</Link>)}</nav><div className="rwa-public-actions">{authenticated?<Button variant="secondary" onClick={()=>router.push("/home")}>Home</Button>:<><Button variant="ghost" onClick={()=>router.push("/login")}>Log In</Button><Button variant="secondary" onClick={()=>router.push("/signup")}>Sign Up</Button></>}<Button onClick={()=>setWalletOpen(true)}>{connectedWallet||"Connect Wallet · Demo"}</Button></div></header><div className="rwa-demo-badge" role="status">UI DEMO · BACKEND OFFLINE</div>{notice&&<div className="rwa-demo-notice" role="alert">{notice}</div>}<ConnectWalletModal open={walletOpen} onOpenChange={setWalletOpen} wallets={["MetaMask","Rabby Wallet","WalletConnect","Coinbase Wallet","Trust Wallet","OKX Wallet"]} onConnect={wallet=>{setConnectedWallet(`${wallet} · Demo`);setWalletOpen(false);setNotice(`${wallet} selected for UI preview only — no wallet session was created.`);window.setTimeout(()=>setNotice(""),4200)}}/></>;
}

export function PublicShell({children,authenticated=false}:{children:React.ReactNode;authenticated?:boolean}){return <div className="rwa-public-shell" data-ui-demo="true" data-backend-connected="false"><PublicHeader authenticated={authenticated}/>{children}</div>}

const demoRows=[
  ["KOPI / USDC","$2.48","+8.72%","$24.8M"],
  ["Marina Bay Residences","$1.0234","+1.32%","$18.4M"],
  ["Private Credit Fund","$1.0821","+0.46%","$12.8M"],
  ["Blue Ocean Shipping","$1.35","+3.20%","$8.6M"],
] as const;

export function RoutePlaceholder({title,path}:{title:string;path:string}){
  const [tab,setTab]=React.useState("Overview"); const section=(path.split("/").filter(Boolean)[0]||"workspace").replace(/-/g," ");
  return <PublicShell authenticated><main className="rwa-workspace"><header className="rwa-workspace__head"><div><span className="rwa-workspace__eyebrow">RWA.MS · {section}</span><h1>{title}</h1><p>Production-style interface preview with deterministic demo data. Read-only navigation is active; backend writes and financial execution remain fail-closed until live services are connected.</p></div><div className="rwa-workspace__actions"><Link className="rwa-link-button rwa-link-button--primary" href="/discover">Discover Assets</Link><Link className="rwa-link-button" href="/home">Dashboard</Link></div></header><section className="rwa-workspace__kpis"><article><small>Total Value</small><strong>$1.28B</strong><em>+6.42% this month</em></article><article><small>24H Volume</small><strong>$64.7M</strong><em>+18.3% vs yesterday</em></article><article><small>Verified Assets</small><strong>1,248</strong><em>93 jurisdictions</em></article><article><small>Environment</small><strong>Demo</strong><em>Backend offline · safe mode</em></article></section><section className="rwa-workspace__panel"><nav className="rwa-workspace__tabs" aria-label="Workspace views">{["Overview","Activity","Analytics","Details"].map(x=><button type="button" key={x} data-active={tab===x?"true":undefined} onClick={()=>setTab(x)}>{x}</button>)}</nav><div className="rwa-workspace__chart"><div><small>{tab} · 30D</small><strong>$1.28B <em>+6.42%</em></strong></div><svg viewBox="0 0 900 220" preserveAspectRatio="none" aria-label={`${title} demo trend`}><defs><linearGradient id="workspace-fill" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#2978ff" stopOpacity=".34"/><stop offset="1" stopColor="#2978ff" stopOpacity="0"/></linearGradient></defs><path d="M0 190 L65 176 120 184 185 145 240 151 300 118 365 128 430 86 495 103 560 70 625 82 690 48 760 62 825 31 900 42 L900 220 L0 220Z" fill="url(#workspace-fill)"/><polyline points="0,190 65,176 120,184 185,145 240,151 300,118 365,128 430,86 495,103 560,70 625,82 690,48 760,62 825,31 900,42" fill="none" stroke="#4290ff" strokeWidth="3"/></svg></div></section><section className="rwa-workspace__lower"><article className="rwa-workspace__panel"><header><div><small>MARKET SNAPSHOT</small><h2>Leading opportunities</h2></div><Link href="/markets">View markets →</Link></header><div className="rwa-workspace__table"><div className="head"><span>Asset</span><span>Price</span><span>24H</span><span>Volume</span></div>{demoRows.map(([name,price,change,volume])=><div key={name}><b>{name}</b><span>{price}</span><em>{change}</em><span>{volume}</span></div>)}</div></article><aside className="rwa-workspace__panel"><small>WORKSPACE STATUS</small><h2>Interface ready</h2><dl><div><dt>Route</dt><dd>{path}</dd></div><div><dt>Navigation</dt><dd>Active</dd></div><div><dt>Images</dt><dd>Verified</dd></div><div><dt>Backend</dt><dd className="warn">Offline</dd></div></dl><Link className="rwa-link-button" href="/businesses">Browse Businesses</Link><Link className="rwa-link-button" href="/rwa">Browse RWA</Link></aside></section></main></PublicShell>;
}
