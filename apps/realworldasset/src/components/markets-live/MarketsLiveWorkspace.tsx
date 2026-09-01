"use client";

import * as React from "react";
import Link from "next/link";
import { AppShell } from "@/components/app";
import { Button } from "@/components/ui";
import { getRuntimeCapabilities, type RuntimeCapabilities } from "@/lib/live-runtime";
import "../program-workspaces/program-workspaces.css";
import "./markets-live.css";

type MarketRow = {
  symbol: string;
  mark: number | null;
  prevDay: number | null;
  changePct: number | null;
  volume: number | null;
  openInterest: number | null;
  funding: number | null;
};

function num(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function money(value: number | null) {
  if (value == null) return "—";
  if (Math.abs(value) >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`;
  if (Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (Math.abs(value) >= 1_000) return `$${(value / 1_000).toFixed(2)}K`;
  return `$${value.toLocaleString(undefined, { maximumFractionDigits: 4 })}`;
}

function price(value: number | null) {
  if (value == null) return "—";
  return `$${value.toLocaleString(undefined, { maximumFractionDigits: value >= 10 ? 2 : 6 })}`;
}

export function MarketsLiveWorkspace() {
  const [rows, setRows] = React.useState<MarketRow[]>([]);
  const [caps, setCaps] = React.useState<RuntimeCapabilities | null>(null);
  const [query, setQuery] = React.useState("");
  const [state, setState] = React.useState<"CONNECTING" | "LIVE" | "STALE">("CONNECTING");
  const [lastSuccess, setLastSuccess] = React.useState<Date | null>(null);
  const [error, setError] = React.useState("");
  const [ticks, setTicks] = React.useState(0);

  const load = React.useCallback(async () => {
    try {
      const response = await fetch("https://api.hyperliquid.xyz/info", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ type: "metaAndAssetCtxs" }),
        cache: "no-store",
      });
      if (!response.ok) throw new Error(`Hyperliquid market HTTP ${response.status}`);
      const payload = await response.json();
      const meta = payload?.[0];
      const contexts = payload?.[1];
      if (!Array.isArray(meta?.universe) || !Array.isArray(contexts)) throw new Error("Hyperliquid market response shape unavailable");
      const next: MarketRow[] = meta.universe.map((asset: any, index: number) => {
        const ctx = contexts[index] || {};
        const mark = num(ctx.markPx);
        const prevDay = num(ctx.prevDayPx);
        return {
          symbol: String(asset?.name || "").toUpperCase(),
          mark,
          prevDay,
          changePct: mark != null && prevDay != null && prevDay !== 0 ? ((mark - prevDay) / prevDay) * 100 : null,
          volume: num(ctx.dayNtlVlm),
          openInterest: num(ctx.openInterest),
          funding: num(ctx.funding),
        };
      }).filter((row: MarketRow) => row.symbol && row.mark != null);
      next.sort((a, b) => (b.volume || 0) - (a.volume || 0));
      setRows(next);
      setState("LIVE");
      setError("");
      setLastSuccess(new Date());
      setTicks(value => value + 1);
    } catch (err: any) {
      setState("STALE");
      setError(String(err?.message || err));
    }
  }, []);

  React.useEffect(() => {
    void getRuntimeCapabilities().then(setCaps).catch(() => setCaps(null));
    void load();
    const timer = window.setInterval(() => void load(), 5000);
    return () => window.clearInterval(timer);
  }, [load]);

  const filtered = rows.filter(row => row.symbol.includes(query.trim().toUpperCase())).slice(0, 40);
  const top = rows[0] || null;

  return <AppShell><main className="pw-page markets-live-page" data-live-source="hyperliquid-public">
    <header className="pw-hero markets-live-hero">
      <div><small>RWA.MS / HYPERLIQUID PUBLIC VENUE</small><h1>Markets Directory</h1><p>Prices, 24-hour venue volume, open interest and funding are rendered only from successful Hyperliquid <code>metaAndAssetCtxs</code> responses. No local market values are substituted.</p></div>
      <div className="pw-hero-actions"><span className="ml-live-badge" data-state={state}>{state === "LIVE" ? "LIVE VENUE DATA" : state}</span><Button variant="secondary" onClick={() => void load()}>Refresh Venue</Button></div>
    </header>

    <section className="ml-summary" aria-label="Markets live summary">
      <article><span>Venue markets loaded</span><strong>{rows.length || "—"}</strong><small>{state === "LIVE" ? `Successful responses: ${ticks}` : "Waiting for authoritative response"}</small></article>
      <article><span>Largest 24h venue volume</span><strong>{top ? top.symbol : "—"}</strong><small>{top ? money(top.volume) : "No venue response"}</small></article>
      <article><span>Execution environment</span><strong>TESTNET</strong><small>{caps?.executionAvailable ? "Execution adapter available" : "Signed execution remains gated"}</small></article>
      <article><span>Mainnet write gate</span><strong>{caps?.mainnetReady ? "READY" : "LOCKED"}</strong><small>{caps?.mainnetReady ? "Machine evidence gate passed" : "No browser override"}</small></article>
    </section>

    <section className="pw-panel ml-directory">
      <div className="ml-directory-head"><div><span className="ml-kicker">AUTHORITATIVE MARKET FEED</span><h2>Hyperliquid perpetual markets</h2><p>{lastSuccess ? `Last successful venue response: ${lastSuccess.toLocaleTimeString()}` : "No successful venue response yet."}</p></div><div className="ml-actions"><input aria-label="Filter live markets" value={query} onChange={e => setQuery(e.target.value)} placeholder="Filter symbol"/><Link href="/trade/btc-usdc">Open BTC / USDC Trade</Link><Link href="/rwa">RWA Registry</Link></div></div>
      {error ? <div className="pw-notice ml-inline-notice" role="status">{error}. Existing values are not replaced with synthetic data.</div> : null}
      {filtered.length ? <div className="ml-table" role="table" aria-label="Live Hyperliquid markets">
        <div className="ml-row ml-head" role="row"><span>Market</span><span>Mark</span><span>24h</span><span>24h volume</span><span>Open interest</span><span>Funding</span></div>
        {filtered.map(row => <div className="ml-row" role="row" key={row.symbol}>
          <strong>{row.symbol}<small>/ USDC</small></strong>
          <span>{price(row.mark)}</span>
          <span className={row.changePct != null && row.changePct >= 0 ? "ml-positive" : "ml-negative"}>{row.changePct == null ? "—" : `${row.changePct >= 0 ? "+" : ""}${row.changePct.toFixed(2)}%`}</span>
          <span>{money(row.volume)}</span>
          <span>{money(row.openInterest)}</span>
          <span>{row.funding == null ? "—" : `${(row.funding * 100).toFixed(4)}%`}</span>
        </div>)}
      </div> : <div className="ml-empty">{state === "CONNECTING" ? "Connecting to Hyperliquid public venue…" : "No authoritative market rows are available."}</div>}
    </section>
  </main></AppShell>;
}
