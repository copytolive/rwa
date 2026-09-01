"use client";

import * as React from "react";
import Link from "next/link";
import { AppShell } from "@/components/app";
import { PublicShell } from "@/components/public";
import {
  currentCommerceSession,
  getRuntimeCapabilities,
  type RuntimeCapabilities,
} from "@/lib/live-runtime";
import "./live-dashboard.css";

type MarketRow = {
  symbol: string;
  price: number;
  prevDay: number | null;
  changePct: number | null;
  volume24h: number | null;
  openInterest: number | null;
  samples: number[];
};

type FeedState = "CONNECTING" | "LIVE" | "STALE" | "UNAVAILABLE";

const EMPTY_CAPS: RuntimeCapabilities = {
  walletProvider: false,
  walletConnected: false,
  authenticated: false,
  commerceReachable: false,
  checkoutReady: false,
  paymentConfigured: false,
  executionAvailable: false,
  mainnetReady: false,
  apiBase: "",
  blockers: [],
};

const PREFERRED_SYMBOLS = ["BTC", "ETH", "SOL", "HYPE"];
const INFO_URL = "https://api.hyperliquid.xyz/info";

function number(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatPrice(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: value < 10 ? 4 : 2,
    maximumFractionDigits: value < 10 ? 4 : 2,
  }).format(value);
}

function formatCompact(value: number | null) {
  if (value == null) return "—";
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 2 }).format(value);
}

function formatTime(value: number | null) {
  if (!value) return "No verified tick yet";
  return new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function Sparkline({ samples }: { samples: number[] }) {
  if (samples.length < 2) return <div className="live-spark live-spark--empty">Waiting for next real tick</div>;
  const width = 180;
  const height = 58;
  const min = Math.min(...samples);
  const max = Math.max(...samples);
  const range = max - min || 1;
  const points = samples.map((value, index) => {
    const x = (index / Math.max(samples.length - 1, 1)) * width;
    const y = height - 5 - ((value - min) / range) * (height - 10);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  return <svg className="live-spark" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Real in-session price observations"><polyline points={points} fill="none" stroke="currentColor" strokeWidth="2.2" vectorEffect="non-scaling-stroke" /></svg>;
}

function useLiveTruth() {
  const [feedState, setFeedState] = React.useState<FeedState>("CONNECTING");
  const [markets, setMarkets] = React.useState<MarketRow[]>([]);
  const [lastTickAt, setLastTickAt] = React.useState<number | null>(null);
  const [tickCount, setTickCount] = React.useState(0);
  const [feedError, setFeedError] = React.useState("");
  const [caps, setCaps] = React.useState<RuntimeCapabilities>(EMPTY_CAPS);
  const [deploymentSha, setDeploymentSha] = React.useState("");
  const histories = React.useRef<Record<string, number[]>>({});
  const lastSuccess = React.useRef<number | null>(null);

  const loadMarket = React.useCallback(async () => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 6500);
    try {
      const response = await fetch(INFO_URL, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ type: "metaAndAssetCtxs" }),
        cache: "no-store",
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`Hyperliquid HTTP ${response.status}`);
      const payload = await response.json();
      const meta = Array.isArray(payload) ? payload[0] : null;
      const contexts = Array.isArray(payload) ? payload[1] : null;
      const universe = Array.isArray(meta?.universe) ? meta.universe : [];
      if (!Array.isArray(contexts) || universe.length !== contexts.length) throw new Error("Unexpected Hyperliquid market payload");

      const parsed = universe.map((asset: any, index: number) => {
        const ctx = contexts[index] || {};
        const symbol = String(asset?.name || "").trim();
        const price = number(ctx.markPx) ?? number(ctx.midPx) ?? number(ctx.oraclePx);
        const prevDay = number(ctx.prevDayPx);
        const volume24h = number(ctx.dayNtlVlm);
        const openInterest = number(ctx.openInterest);
        if (!symbol || price == null || price <= 0) return null;
        const history = [...(histories.current[symbol] || []), price].slice(-28);
        histories.current[symbol] = history;
        return {
          symbol,
          price,
          prevDay,
          changePct: prevDay && prevDay > 0 ? ((price - prevDay) / prevDay) * 100 : null,
          volume24h,
          openInterest,
          samples: history,
        } satisfies MarketRow;
      }).filter(Boolean) as MarketRow[];

      const preferred = PREFERRED_SYMBOLS.map(symbol => parsed.find(row => row.symbol === symbol)).filter(Boolean) as MarketRow[];
      const extras = parsed.filter(row => !PREFERRED_SYMBOLS.includes(row.symbol)).sort((a, b) => (b.volume24h || 0) - (a.volume24h || 0));
      const selected = [...preferred, ...extras].slice(0, 6);
      if (!selected.length) throw new Error("No verified liquid markets returned");

      const now = Date.now();
      lastSuccess.current = now;
      setMarkets(selected);
      setLastTickAt(now);
      setTickCount(value => value + 1);
      setFeedError("");
      setFeedState("LIVE");
    } catch (error: any) {
      const now = Date.now();
      const age = lastSuccess.current ? now - lastSuccess.current : Infinity;
      setFeedState(lastSuccess.current && age < 20000 ? "STALE" : "UNAVAILABLE");
      setFeedError(String(error?.message || error));
    } finally {
      window.clearTimeout(timer);
    }
  }, []);

  const loadRuntime = React.useCallback(async () => {
    try { setCaps(await getRuntimeCapabilities()); }
    catch { setCaps(EMPTY_CAPS); }
  }, []);

  const loadDeployment = React.useCallback(async () => {
    try {
      const base = window.location.pathname === "/rwa" || window.location.pathname.startsWith("/rwa/") ? "/rwa" : "";
      const response = await fetch(`${base}/deployment-sha.txt?ts=${Date.now()}`, { cache: "no-store" });
      if (!response.ok) throw new Error(String(response.status));
      const value = (await response.text()).trim();
      setDeploymentSha(/^[0-9a-f]{7,40}$/i.test(value) ? value : "");
    } catch { setDeploymentSha(""); }
  }, []);

  React.useEffect(() => {
    void loadMarket();
    void loadRuntime();
    void loadDeployment();
    const marketTimer = window.setInterval(() => void loadMarket(), 4000);
    const runtimeTimer = window.setInterval(() => void loadRuntime(), 12000);
    const deploymentTimer = window.setInterval(() => void loadDeployment(), 30000);
    const onSession = () => void loadRuntime();
    window.addEventListener("rwa:session-changed", onSession);
    return () => {
      window.clearInterval(marketTimer);
      window.clearInterval(runtimeTimer);
      window.clearInterval(deploymentTimer);
      window.removeEventListener("rwa:session-changed", onSession);
    };
  }, [loadDeployment, loadMarket, loadRuntime]);

  return { feedState, markets, lastTickAt, tickCount, feedError, caps, deploymentSha };
}

function FeedBadge({ state }: { state: FeedState }) {
  return <span className="live-feed-badge" data-state={state}>{state === "LIVE" ? "● LIVE VENUE DATA" : state === "STALE" ? "● STALE — LAST REAL DATA HELD" : state === "CONNECTING" ? "● CONNECTING TO REAL VENUE" : "● REAL VENUE UNAVAILABLE"}</span>;
}

function MarketGrid({ markets }: { markets: MarketRow[] }) {
  if (!markets.length) return <div className="live-empty"><strong>No synthetic fallback.</strong><span>Waiting for a verified response from the public Hyperliquid venue endpoint.</span></div>;
  return <div className="live-market-grid">{markets.map(row => <article className="live-market-card" key={row.symbol}>
    <header><div><span className="live-symbol">{row.symbol}</span><small>Hyperliquid public venue</small></div><strong>{formatPrice(row.price)}</strong></header>
    <Sparkline samples={row.samples}/>
    <dl>
      <div><dt>24H</dt><dd data-sign={row.changePct == null ? "flat" : row.changePct >= 0 ? "up" : "down"}>{row.changePct == null ? "—" : `${row.changePct >= 0 ? "+" : ""}${row.changePct.toFixed(2)}%`}</dd></div>
      <div><dt>24H notional</dt><dd>{formatCompact(row.volume24h)}</dd></div>
      <div><dt>Open interest</dt><dd>{formatCompact(row.openInterest)}</dd></div>
      <div><dt>Real samples</dt><dd>{row.samples.length}</dd></div>
    </dl>
  </article>)}</div>;
}

function RuntimeTruth({ caps, deploymentSha }: { caps: RuntimeCapabilities; deploymentSha: string }) {
  const session = currentCommerceSession();
  const rows = [
    ["Commerce backend", caps.commerceReachable ? "REACHABLE" : "UNAVAILABLE"],
    ["Signed wallet session", session && caps.authenticated ? "AUTHENTICATED" : "NOT SIGNED"],
    ["Checkout", caps.checkoutReady ? "READY" : "LOCKED"],
    ["Execution adapter", caps.executionAvailable ? "AVAILABLE" : "LOCKED"],
    ["Mainnet machine gate", caps.mainnetReady ? "READY" : "LOCKED"],
    ["Deployment SHA", deploymentSha ? deploymentSha.slice(0, 12) : "UNAVAILABLE"],
  ];
  return <section className="live-truth-panel"><header><div><small>MACHINE TRUTH</small><h2>Runtime capability</h2></div><Link href="/status">Open status →</Link></header><div className="live-truth-grid">{rows.map(([label, value]) => <div key={label}><span>{label}</span><b>{value}</b></div>)}</div>{caps.blockers?.length ? <p className="live-blockers">{caps.blockers.join(" · ")}</p> : null}</section>;
}

function LiveContent({ title, subtitle, route }: { title: string; subtitle: string; route?: string }) {
  const truth = useLiveTruth();
  return <main className="live-dashboard" data-live-source="hyperliquid-public" data-live-only="true">
    <section className="live-hero">
      <div>
        <small>RWA.MS · LIVE ONLY · NO SYNTHETIC DATA</small>
        <h1>{title}</h1>
        <p>{subtitle}</p>
        {route ? <code>{route}</code> : null}
      </div>
      <div className="live-hero-state"><FeedBadge state={truth.feedState}/><span>Successful real ticks: <b>{truth.tickCount}</b></span><span>Last verified tick: <b>{formatTime(truth.lastTickAt)}</b></span>{truth.feedError && truth.feedState !== "LIVE" ? <span className="live-error">{truth.feedError}</span> : null}</div>
    </section>
    <section className="live-market-section"><header><div><small>PUBLIC VENUE</small><h2>Real market observations</h2></div><span>Poll interval: 4s · count advances only after a valid venue response</span></header><MarketGrid markets={truth.markets}/></section>
    <RuntimeTruth caps={truth.caps} deploymentSha={truth.deploymentSha}/>
    <section className="live-policy-panel"><h2>No mockup policy</h2><p>Missing provider, business, RWA registry, account, commerce, or execution data is shown as <b>UNAVAILABLE</b> or <b>LOCKED</b>. RWA.MS does not generate substitute prices, balances, users, orders, charts, fills, or business metrics.</p><div><Link className="rwa-link-button rwa-link-button--primary" href="/markets">Markets</Link><Link className="rwa-link-button" href="/account/activity">Account activity</Link><Link className="rwa-link-button" href="/account/orders">Orders</Link></div></section>
  </main>;
}

export function LivePublicLanding() {
  return <PublicShell><LiveContent title="Where Businesses Become Markets" subtitle="Live public market observations and machine-readable runtime readiness. No demo market cap, sample users, synthetic business values, or decorative fake charts."/></PublicShell>;
}

export function LiveHomeDashboard() {
  return <AppShell><LiveContent title="Live Control Dashboard" subtitle="This dashboard refreshes only from verified public venue responses and configured RWA.MS runtime services. Signed account data stays locked until a real wallet session exists."/></AppShell>;
}

export function LiveRouteWorkspace({ title, path }: { title: string; path: string }) {
  const privateRoute = /^\/(account|portfolio|merchant|settings|notifications|positions)(\/|$)/.test(path);
  const content = <LiveContent title={title} route={path} subtitle="No verified route-specific dataset is fabricated. This route exposes only live global venue/runtime truth until its authoritative provider or registry is connected."/>;
  return privateRoute ? <AppShell>{content}</AppShell> : <PublicShell>{content}</PublicShell>;
}
