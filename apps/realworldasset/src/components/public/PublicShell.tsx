"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import {
  connectWalletAndAuthenticate,
  currentCommerceSession,
  getRuntimeCapabilities,
  logoutRealSession,
  type RuntimeCapabilities,
} from "@/lib/live-runtime";
import "./public.css";

export function Brand({ compact = false }: { compact?: boolean }) {
  return <Link href="/" className="rwa-brand" aria-label="RWA.MS home"><span className="rwa-brand__mark" aria-hidden="true"><i/><i/><i/></span>{!compact && <span className="rwa-brand__name">RWA.<b>MS</b></span>}</Link>;
}

const publicNav = [["Markets","/markets"],["Businesses","/businesses"],["RWA","/rwa"],["Intelligence","/intelligence"],["About","/about"],["Docs","/docs"]] as const;
const emptyCapabilities: RuntimeCapabilities = {walletProvider:false,walletConnected:false,authenticated:false,commerceReachable:false,checkoutReady:false,paymentConfigured:false,executionAvailable:false,mainnetReady:false,apiBase:"",blockers:[]};

export function PublicHeader({ authenticated = false, capabilities = emptyCapabilities, wallet = "", busy = false, onConnect, onLogout }: { authenticated?: boolean; capabilities?: RuntimeCapabilities; wallet?: string; busy?: boolean; onConnect?:()=>void; onLogout?:()=>void }) {
  const router=useRouter();
  const sessionActive=!!wallet;
  const badge=capabilities.mainnetReady
    ? "LIVE DATA · MAINNET GATE READY"
    : capabilities.authenticated&&capabilities.checkoutReady
      ? "LIVE DATA · WALLET AUTH · CHECKOUT READY · MAINNET LOCKED"
      : capabilities.commerceReachable
        ? "LIVE DATA · COMMERCE BACKEND REACHABLE · WRITES GATED"
        : "LIVE ONLY · COMMERCE BACKEND UNAVAILABLE · WRITES LOCKED";
  return <><header className="rwa-public-header"><Brand/><nav className="rwa-public-nav" aria-label="Primary navigation">{publicNav.map(([label,href])=><Link key={href} href={href}>{label}</Link>)}</nav><div className="rwa-public-actions">{authenticated||sessionActive?<Button variant="secondary" onClick={()=>router.push("/home")}>Home</Button>:<><Button variant="ghost" onClick={()=>router.push("/login")}>Log In</Button><Button variant="secondary" onClick={()=>router.push("/signup")}>Sign Up</Button></>}<Button onClick={onConnect} disabled={busy}>{sessionActive?`${wallet.slice(0,6)}…${wallet.slice(-4)}`:"Connect Wallet · Live"}</Button>{sessionActive&&<Button variant="ghost" onClick={onLogout} disabled={busy}>Log Out</Button>}</div></header><div className="rwa-demo-badge" role="status">{badge}</div></>;
}

export function PublicShell({children,authenticated=false}:{children:React.ReactNode;authenticated?:boolean}){
  const [capabilities,setCapabilities]=React.useState<RuntimeCapabilities>(emptyCapabilities);
  const [wallet,setWallet]=React.useState("");
  const [notice,setNotice]=React.useState("");
  const [busy,setBusy]=React.useState(false);
  const refresh=React.useCallback(async()=>{const s=currentCommerceSession();setWallet(s?.wallet||"");const next=await getRuntimeCapabilities().catch(()=>({...emptyCapabilities,walletProvider:typeof window!=="undefined"&&!!(window.RWAProvider||window.ethereum)}));setCapabilities(next)},[]);
  React.useEffect(()=>{void refresh();const changed=()=>void refresh();window.addEventListener("rwa:session-changed",changed);return()=>window.removeEventListener("rwa:session-changed",changed)},[refresh]);
  const connect=async()=>{setBusy(true);setNotice("Requesting wallet signature…");try{const s=await connectWalletAndAuthenticate();setWallet(s.wallet);setNotice(`Authenticated wallet ${s.wallet.slice(0,8)}…${s.wallet.slice(-4)}.`);await refresh()}catch(e:any){setNotice(`Live wallet authentication blocked: ${String(e?.message||e)}`)}finally{setBusy(false);window.setTimeout(()=>setNotice(""),5200)}};
  const logout=async()=>{setBusy(true);try{await logoutRealSession();setWallet("");setNotice("Wallet session revoked.");await refresh()}catch(e:any){setNotice(String(e?.message||e))}finally{setBusy(false);window.setTimeout(()=>setNotice(""),4200)}};
  return <div className="rwa-public-shell" data-live-only="true" data-ui-demo="false" data-backend-connected={capabilities.commerceReachable?"true":"false"} data-mainnet-ready={capabilities.mainnetReady?"true":"false"}><PublicHeader authenticated={authenticated} capabilities={capabilities} wallet={wallet} busy={busy} onConnect={connect} onLogout={logout}/>{notice&&<div className="rwa-demo-notice" role="alert">{notice}</div>}{children}</div>;
}
