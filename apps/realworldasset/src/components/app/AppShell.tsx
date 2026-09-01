"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import { LiveActionCenter } from "@/components/live/LiveActionCenter";
import {
  connectWalletAndAuthenticate,
  currentCommerceSession,
  getRuntimeCapabilities,
  logoutRealSession,
  type RuntimeCapabilities,
} from "@/lib/live-runtime";
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

const UNSAFE_ACTION = /(confirm purchase|confirm (buy|sell)|execute (trade|order)|submit order|settle|withdraw|redeem|mint now|pay now)/i;
const initialCapabilities: RuntimeCapabilities = {walletProvider:false,walletConnected:false,authenticated:false,commerceReachable:false,checkoutReady:false,paymentConfigured:false,executionAvailable:false,mainnetReady:false,apiBase:"",blockers:[]};

export function AppBrand() {
  return <Link href="/home" className="app-brand" aria-label="RWA.MS authenticated home"><span className="app-brand__mark">◇</span><span>RWA.<b>MS</b></span></Link>;
}

export function AppShell({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const [pro, setPro] = React.useState(true);
  const [softTheme, setSoftTheme] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [interactionStatus, setInteractionStatus] = React.useState("");
  const [safetyNotice, setSafetyNotice] = React.useState("");
  const [capabilities, setCapabilities] = React.useState<RuntimeCapabilities>(initialCapabilities);
  const [wallet, setWallet] = React.useState("");
  const [authBusy, setAuthBusy] = React.useState(false);

  const refreshRuntime = React.useCallback(async () => {
    const session = currentCommerceSession();
    setWallet(session?.wallet || "");
    const next = await getRuntimeCapabilities().catch(() => ({...initialCapabilities,walletProvider:typeof window!=="undefined"&&!!(window.RWAProvider||window.ethereum)}));
    setCapabilities(next);
    return next;
  }, []);

  React.useEffect(() => {
    void refreshRuntime();
    const changed = () => void refreshRuntime();
    window.addEventListener("rwa:session-changed", changed);
    return () => window.removeEventListener("rwa:session-changed", changed);
  }, [refreshRuntime]);

  function submitSearch(event: React.FormEvent) {
    event.preventDefault();
    const q = query.trim();
    router.push(q ? `/search?q=${encodeURIComponent(q)}` : "/search");
  }

  async function connectLiveWallet() {
    setAuthBusy(true);
    setSafetyNotice("Requesting wallet signature for server-authenticated session…");
    try {
      const session = await connectWalletAndAuthenticate();
      setWallet(session.wallet);
      setSafetyNotice(`Wallet authenticated: ${session.wallet.slice(0,8)}…${session.wallet.slice(-4)}. No private key was shared.`);
      await refreshRuntime();
    } catch (error: any) {
      setSafetyNotice(`Live wallet authentication blocked: ${String(error?.message || error)}`);
    } finally {
      setAuthBusy(false);
      window.setTimeout(() => setSafetyNotice(""), 5200);
    }
  }

  async function logout() {
    setAuthBusy(true);
    try {
      await logoutRealSession();
      setWallet("");
      setSafetyNotice("Wallet session revoked and local session cleared.");
      await refreshRuntime();
      router.push("/");
    } catch (error: any) {
      setSafetyNotice(`Logout completed locally; server response: ${String(error?.message || error)}`);
    } finally {
      setAuthBusy(false);
      window.setTimeout(() => setSafetyNotice(""), 4200);
    }
  }

  function openLive(kind: "checkout" | "trade", side?: "BUY" | "SELL") {
    window.dispatchEvent(new CustomEvent("rwa:open-live-action", {detail:{kind,side}}));
  }

  function lock(label: string, reason: string) {
    const message = `${label.slice(0,64)} locked — ${reason}`;
    setSafetyNotice(message);
    setInteractionStatus(message);
    window.setTimeout(() => setSafetyNotice(""), 4200);
  }

  function handleButtonCapture(event: React.MouseEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement;
    const button = target.closest("button") as HTMLButtonElement | null;
    if (!button || button.disabled) return;
    const label = button.getAttribute("aria-label") || button.textContent?.trim().replace(/\s+/g, " ") || "Control";
    const liveWrite = button.dataset.liveFinancialAction === "true";
    const liveEnvironment = button.dataset.liveEnvironment || "";
    if (liveWrite) {
      if (liveEnvironment === "mainnet" && !capabilities.mainnetReady) {
        event.preventDefault(); event.stopPropagation();
        lock(label, "MAINNET machine gate is not ready for this wallet.");
        return;
      }
      setInteractionStatus(`${label.slice(0,80)} submitted through verified live adapter`);
      return;
    }
    if (UNSAFE_ACTION.test(label)) {
      event.preventDefault();
      event.stopPropagation();
      if (/confirm purchase/i.test(label) && capabilities.checkoutReady) {
        openLive("checkout");
        setInteractionStatus("Confirm Purchase redirected to authoritative backend checkout");
        return;
      }
      if (/(confirm (buy|sell)|execute (trade|order)|submit order)/i.test(label) && capabilities.commerceReachable && capabilities.walletProvider) {
        openLive("trade", /sell/i.test(label) ? "SELL" : "BUY");
        setInteractionStatus(`${label.slice(0,80)} redirected to gated Hyperliquid execution`);
        return;
      }
      const reason = /withdraw|redeem|settle|mint|pay now/i.test(label)
        ? "real-money action requires the machine mainnet gate and a dedicated verified adapter."
        : "live backend capability is not currently verified.";
      lock(label, reason);
      return;
    }
    setInteractionStatus(`${label.slice(0,80)} activated`);
  }

  const badge = capabilities.mainnetReady
    ? "LIVE BACKEND · MAINNET GATE READY"
    : capabilities.authenticated && capabilities.checkoutReady
      ? "LIVE WALLET AUTH · CHECKOUT READY · MAINNET LOCKED"
      : capabilities.commerceReachable
        ? "LIVE BACKEND · WALLET AUTH AVAILABLE · WRITES GATED"
        : "UI DEMO · BACKEND OFFLINE";
  const footerStatus = capabilities.commerceReachable ? `● ${badge}` : "● UI Demo · Backend Offline";
  const walletLabel = wallet ? `${wallet.slice(0,6)}…${wallet.slice(-4)}` : "Connect Wallet · Live";

  return <div className={`app-shell ${softTheme ? "soft-theme" : ""} ${className}`.trim()} onClickCapture={handleButtonCapture} data-ui-demo="true" data-backend-connected={capabilities.commerceReachable ? "true" : "false"} data-mainnet-ready={capabilities.mainnetReady ? "true" : "false"}>
    <div className="app-demo-badge" role="status">{badge}</div>
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
        <button className="profile-button" type="button" onClick={() => router.push("/account")}><span className="profile-avatar">{wallet ? "W" : "AM"}</span><span>{wallet ? "Authenticated Wallet" : "Alex Morgan"}<small>{wallet ? `${wallet.slice(0,8)}…${wallet.slice(-4)}` : "Level 3 · Demo"}</small></span></button>
        <Button size="sm" onClick={connectLiveWallet} disabled={authBusy}>{walletLabel}</Button>
        {wallet && <Button size="sm" variant="ghost" onClick={logout} disabled={authBusy}>Log Out</Button>}
      </div>
    </header>
    {children}
    {safetyNotice && <div className="app-safety-notice" role="alert">{safetyNotice}</div>}
    <span className="sr-only" role="status" aria-live="polite">{interactionStatus}</span>
    <footer className="app-footer"><span className="status-dot">{footerStatus}</span><nav><Link href="/about">About RWA.MS</Link><Link href="/docs">Docs</Link><Link href="/api">API</Link><Link href="/help">Support</Link><Link href="/terms">Terms</Link><Link href="/privacy">Privacy</Link></nav><span>© 2026 RWA.MS</span></footer>
    <LiveActionCenter capabilities={capabilities} onCapabilities={setCapabilities}/>
  </div>;
}