"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import { ConnectWalletModal } from "@/components/overlays";
import "./app-shell.css";
import "./launch-responsive-fix.css";

const nav = [
  ["Home", "/home"],
  ["Discover", "/discover"],
  ["Markets", "/markets"],
  ["Businesses", "/businesses"],
  ["Intelligence", "/intelligence"],
  ["Portfolio", "/portfolio"],
] as const;

const BACKEND_CONNECTED = false;
const UNSAFE_ACTION = /(confirm purchase|confirm (buy|sell)|execute (trade|order)|submit order|settle|withdraw|redeem|mint now|pay now)/i;

export function AppBrand() {
  return <Link href="/home" className="app-brand" aria-label="RWA.MS authenticated home"><span className="app-brand__mark">◇</span><span>RWA.<b>MS</b></span></Link>;
}

export function AppShell({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const [pro, setPro] = React.useState(true);
  const [walletOpen, setWalletOpen] = React.useState(false);
  const [wallet, setWallet] = React.useState("Connect Wallet · Demo");
  const [softTheme, setSoftTheme] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [interactionStatus, setInteractionStatus] = React.useState("");
  const [safetyNotice, setSafetyNotice] = React.useState("");

  function submitSearch(event: React.FormEvent) {
    event.preventDefault();
    const q = query.trim();
    router.push(q ? `/search?q=${encodeURIComponent(q)}` : "/search");
  }

  function handleButtonCapture(event: React.MouseEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement;
    const button = target.closest("button");
    if (!button || button.disabled) return;
    const label = button.getAttribute("aria-label") || button.textContent?.trim().replace(/\s+/g, " ") || "Control";
    if (!BACKEND_CONNECTED && UNSAFE_ACTION.test(label)) {
      event.preventDefault();
      event.stopPropagation();
      const message = `${label.slice(0, 64)} locked — backend/wallet execution is not connected.`;
      setSafetyNotice(message);
      setInteractionStatus(message);
      window.setTimeout(() => setSafetyNotice(""), 4200);
      return;
    }
    setInteractionStatus(`${label.slice(0, 80)} activated in UI demo`);
  }

  return <div className={`app-shell ${softTheme ? "soft-theme" : ""} ${className}`.trim()} onClickCapture={handleButtonCapture} data-ui-demo="true" data-backend-connected={BACKEND_CONNECTED ? "true" : "false"}>
    <div className="app-demo-badge" role="status">UI DEMO · BACKEND OFFLINE</div>
    <header className="app-header">
      <AppBrand/>
      <nav className="app-nav" aria-label="Authenticated primary navigation">
        {nav.map(([label, href]) => <Link key={href} href={href} data-active={pathname === href ? "true" : undefined}>{label}</Link>)}
      </nav>
      <form className="app-header-search" onSubmit={submitSearch} role="search">
        <input aria-label="Search RWA.MS" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search" />
      </form>
      <div className="app-header-actions">
        <div className="mode-toggle" aria-label="Interface mode"><button type="button" aria-pressed={!pro} onClick={() => setPro(false)}>Simple</button><button type="button" aria-pressed={pro} onClick={() => { setPro(true); router.push("/pro"); }}>PRO</button></div>
        <Button size="sm" onClick={() => router.push("/community/compose")}>＋ Post Thesis</Button>
        <button className="icon-button" type="button" aria-label="Notifications" onClick={() => router.push("/notifications")}>♢<span>3</span></button>
        <button className="icon-button" type="button" aria-label="Toggle theme" onClick={() => setSoftTheme(v => !v)}>{softTheme ? "☀" : "☾"}</button>
        <button className="profile-button" type="button" onClick={() => router.push("/account")}><span className="profile-avatar">AM</span><span>Alex Morgan<small>Level 3 · Demo</small></span></button>
        <Button size="sm" onClick={() => setWalletOpen(true)}>{wallet}</Button>
      </div>
    </header>
    {children}
    {safetyNotice && <div className="app-safety-notice" role="alert">{safetyNotice}</div>}
    <span className="sr-only" role="status" aria-live="polite">{interactionStatus}</span>
    <footer className="app-footer"><span className="status-dot">● UI Demo · Backend Offline</span><nav><Link href="/about">About RWA.MS</Link><Link href="/docs">Docs</Link><Link href="/api">API</Link><Link href="/help">Support</Link><Link href="/terms">Terms</Link><Link href="/privacy">Privacy</Link></nav><span>© 2026 RWA.MS</span></footer>
    <ConnectWalletModal open={walletOpen} onOpenChange={setWalletOpen} wallets={["MetaMask","Rabby Wallet","WalletConnect","Coinbase Wallet","Trust Wallet","OKX Wallet"]} onConnect={name => { setWallet(`${name} · Demo`); setWalletOpen(false); setSafetyNotice(`${name} selected for UI preview only — no wallet session was created.`); }}/>
  </div>;
}
