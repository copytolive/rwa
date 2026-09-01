"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/app";
import { Button } from "@/components/ui";
import { connectWalletAndAuthenticate, currentCommerceSession, getRuntimeCapabilities, type RuntimeCapabilities } from "@/lib/live-runtime";
import {
  cancelRealCommerceOrder,
  depositRealMainnetFunds,
  getRealExecutionAccountSnapshot,
  listRealCommerceOrders,
  listRealSellerOrders,
  requestRealCommerceRefund,
  updateRealSellerOrderStatus,
  withdrawRealMainnetFunds,
} from "@/lib/live-ops";
import "./program-workspaces.css";

type AnyRow = Record<string, any>;
type WorkspaceKind = "markets" | "intelligence" | "tokenization" | "api" | "billing" | "activity";

const LABELS: Record<WorkspaceKind, { title: string; subtitle: string }> = {
  markets: { title: "Markets Directory", subtitle: "Live-capability-aware market entry points. Execution remains TESTNET-first until the machine mainnet gate passes." },
  intelligence: { title: "Intelligence Workspace", subtitle: "Research and launch evidence are separated from live execution. Unverified provider data is never promoted to live." },
  tokenization: { title: "Merchant Tokenization", subtitle: "Tokenization launch controls are evidence-gated. Mint and transfer stay locked until verified asset and testnet receipts exist." },
  api: { title: "API Access", subtitle: "Runtime connectivity and session state are shown here. API credentials are not fabricated when no issuance service is configured." },
  billing: { title: "Billing & Settlement", subtitle: "Checkout capability reflects the authoritative commerce readiness endpoint and payment-provider configuration." },
  activity: { title: "Account Activity", subtitle: "Authenticated wallet activity can be read from Hyperliquid TESTNET. Synthetic account history is not generated." },
};

function shortWallet(wallet?: string) {
  return wallet ? `${wallet.slice(0, 8)}…${wallet.slice(-6)}` : "Not authenticated";
}

function StatusGrid({ caps }: { caps: RuntimeCapabilities | null }) {
  const rows = [
    ["Wallet provider", caps?.walletProvider],
    ["Signed session", caps?.authenticated],
    ["Commerce API", caps?.commerceReachable],
    ["Checkout", caps?.checkoutReady],
    ["Execution", caps?.executionAvailable],
    ["Mainnet gate", caps?.mainnetReady],
  ] as const;
  return <div className="pw-status-grid">{rows.map(([label, ok]) =>
    <div key={label}><span>{label}</span><b data-ok={ok === true ? "true" : "false"}>{ok === true ? "READY" : "LOCKED"}</b></div>
  )}</div>;
}

function ShellNotice({ message }: { message: string }) {
  return message ? <div className="pw-notice" role="status">{message}</div> : null;
}

function useCapabilities() {
  const [caps, setCaps] = React.useState<RuntimeCapabilities | null>(null);
  const [loading, setLoading] = React.useState(true);
  const refresh = React.useCallback(async () => {
    setLoading(true);
    try { setCaps(await getRuntimeCapabilities()); } finally { setLoading(false); }
  }, []);
  React.useEffect(() => { void refresh(); }, [refresh]);
  return { caps, loading, refresh };
}

function ConnectControl({ refresh, onMessage }: { refresh: () => Promise<void>; onMessage: (s: string) => void }) {
  const session = currentCommerceSession();
  return session
    ? <span className="pw-wallet">Signed wallet: <b>{shortWallet(session.wallet)}</b></span>
    : <Button onClick={async () => {
        try {
          const s = await connectWalletAndAuthenticate();
          onMessage(`Signed wallet session active: ${shortWallet(s.wallet)}`);
          await refresh();
        } catch (e: any) { onMessage(String(e?.message || e)); }
      }}>Connect & Sign Wallet</Button>;
}

export function ProgramWorkspace({ kind }: { kind: WorkspaceKind }) {
  const router = useRouter();
  const { caps, loading, refresh } = useCapabilities();
  const [message, setMessage] = React.useState("");
  const [snapshot, setSnapshot] = React.useState<any>(null);
  const session = currentCommerceSession();
  const meta = LABELS[kind];

  const loadActivity = async () => {
    try {
      const value = await getRealExecutionAccountSnapshot(true);
      setSnapshot(value);
      setMessage(`TESTNET account loaded with ${value.fills.length} venue fill(s).`);
    } catch (e: any) { setMessage(String(e?.message || e)); }
  };

  return <AppShell><main className="pw-page">
    <header className="pw-hero">
      <div><small>RWA.MS / LIVE PROGRAM</small><h1>{meta.title}</h1><p>{meta.subtitle}</p></div>
      <div className="pw-hero-actions"><ConnectControl refresh={refresh} onMessage={setMessage}/><Button variant="secondary" onClick={() => void refresh()}>{loading ? "Checking…" : "Refresh truth"}</Button></div>
    </header>
    <StatusGrid caps={caps}/>
    {caps?.blockers?.length ? <section className="pw-panel pw-blockers"><h2>Current blockers</h2><p>{caps.blockers.join(" · ")}</p></section> : null}

    {kind === "markets" && <section className="pw-grid">
      <article className="pw-panel"><h2>Hyperliquid execution</h2><p>Order submission is routed through the signed execution owner. TESTNET is the default environment.</p><Button onClick={() => router.push("/trade/btc-usdc")}>Open BTC / USDC Trade</Button></article>
      <article className="pw-panel"><h2>RWA markets</h2><p>Browse tokenized-asset surfaces without treating static market content as an execution receipt.</p><Button variant="secondary" onClick={() => router.push("/rwa")}>Open RWA Directory</Button></article>
      <article className="pw-panel"><h2>Account evidence</h2><p>{session ? "Signed wallet can query venue state." : "Sign a wallet session before querying venue state."}</p><Button variant="secondary" disabled={!session} onClick={loadActivity}>Read TESTNET Account</Button></article>
    </section>}

    {kind === "intelligence" && <section className="pw-grid">
      <article className="pw-panel"><h2>Research</h2><p>Research routes remain informational. They do not unlock payment, tokenization, or mainnet execution.</p><Button onClick={() => router.push("/discover")}>Open Discover Hub</Button></article>
      <article className="pw-panel"><h2>Launch truth</h2><p>Mainnet status is derived from machine-readable launch evidence, not a UI toggle.</p><strong>{caps?.mainnetReady ? "MAINNET READY" : "MAINNET BLOCKED"}</strong></article>
      <article className="pw-panel"><h2>Operational truth</h2><p>Commerce: {caps?.commerceReachable ? "reachable" : "offline"} · Checkout: {caps?.checkoutReady ? "ready" : "locked"}.</p><Button variant="secondary" onClick={() => router.push("/status")}>System Status</Button></article>
    </section>}

    {kind === "tokenization" && <section className="pw-grid">
      <article className="pw-panel"><h2>Verified-asset gate</h2><p>Minting remains fail-closed until the external asset registry and Product RWA testnet evidence satisfy launch policy.</p><strong>{caps?.mainnetReady ? "Launch gate ready" : "No production mint permission"}</strong></article>
      <article className="pw-panel"><h2>Merchant RWA</h2><p>Continue the merchant workflow without pretending an on-chain receipt exists.</p><Button onClick={() => router.push("/merchant/rwa")}>Open Merchant RWA</Button></article>
      <article className="pw-panel"><h2>Compliance</h2><p>KYC/KYB and legal review require real provider/reviewer evidence.</p><Button variant="secondary" onClick={() => router.push("/merchant/kyb")}>Open KYB</Button></article>
    </section>}

    {kind === "api" && <section className="pw-grid">
      <article className="pw-panel"><h2>Runtime API</h2><p>{caps?.apiBase ? `Commerce base: ${caps.apiBase}` : "No verified commerce API base is currently active."}</p><strong>{caps?.commerceReachable ? "HEALTHY" : "UNAVAILABLE"}</strong></article>
      <article className="pw-panel"><h2>Credential issuance</h2><p>No verified API-key issuance service is configured, so this screen does not generate fake keys.</p><button type="button" disabled>Generate API Key — unavailable</button></article>
      <article className="pw-panel"><h2>Session</h2><p>{session ? `Bearer session bound to ${shortWallet(session.wallet)}` : "No signed backend session."}</p></article>
    </section>}

    {kind === "billing" && <section className="pw-grid">
      <article className="pw-panel"><h2>Payment provider</h2><p>Provider configured: <b>{caps?.paymentConfigured ? "YES" : "NO"}</b></p><p>Checkout ready: <b>{caps?.checkoutReady ? "YES" : "NO"}</b></p></article>
      <article className="pw-panel"><h2>Authoritative checkout</h2><p>Browser checkout can create a payment session only after `/readyz.checkout_ready=true`. Paid status remains webhook-authoritative.</p><Button disabled={!caps?.checkoutReady} onClick={() => router.push("/checkout")}>Open Checkout</Button></article>
      <article className="pw-panel"><h2>Orders & refunds</h2><p>Authenticated orders and refund requests use the commerce backend.</p><Button variant="secondary" onClick={() => router.push("/account/orders")}>Open Live Orders</Button></article>
    </section>}

    {kind === "activity" && <section className="pw-grid">
      <article className="pw-panel"><h2>Signed session</h2><p>{session ? shortWallet(session.wallet) : "No authenticated wallet session."}</p><Button disabled={!session} onClick={loadActivity}>Load TESTNET Venue Activity</Button></article>
      <article className="pw-panel"><h2>Venue fills</h2><strong>{snapshot ? snapshot.fills.length : "—"}</strong><p>{snapshot ? "Authoritative userFills response from Hyperliquid TESTNET." : "No live venue response loaded."}</p></article>
      <article className="pw-panel"><h2>Account state</h2><pre>{snapshot ? JSON.stringify(snapshot.state, null, 2).slice(0, 1400) : "No live account state loaded."}</pre></article>
    </section>}

    {snapshot && kind === "markets" ? <section className="pw-panel"><h2>TESTNET venue proof</h2><pre>{JSON.stringify(snapshot.state, null, 2).slice(0, 1800)}</pre></section> : null}
    <ShellNotice message={message}/>
  </main></AppShell>;
}

export function LiveOrdersWorkspace({ dispute = false }: { dispute?: boolean }) {
  const router = useRouter();
  const { caps, refresh } = useCapabilities();
  const [orders, setOrders] = React.useState<AnyRow[]>([]);
  const [selected, setSelected] = React.useState("");
  const [reason, setReason] = React.useState("");
  const [amount, setAmount] = React.useState("");
  const [message, setMessage] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const session = currentCommerceSession();

  const load = React.useCallback(async () => {
    if (!currentCommerceSession()) { setOrders([]); return; }
    setLoading(true);
    try {
      const rows = await listRealCommerceOrders();
      setOrders(rows);
      if (!selected && rows[0]?.id) setSelected(String(rows[0].id));
      setMessage(`Loaded ${rows.length} authoritative commerce order(s).`);
    } catch (e: any) { setMessage(String(e?.message || e)); }
    finally { setLoading(false); }
  }, [selected]);

  React.useEffect(() => { void load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const refund = async () => {
    try {
      const cents = amount.trim() ? Math.round(Number(amount) * 100) : null;
      const row = await requestRealCommerceRefund(selected, reason, cents);
      setMessage(`Refund request recorded: ${String(row?.id || row?.status || "REQUESTED")}`);
      await load();
    } catch (e: any) { setMessage(String(e?.message || e)); }
  };

  return <AppShell><main className="pw-page">
    <header className="pw-hero"><div><small>RWA.MS / COMMERCE</small><h1>{dispute ? "Refund & Dispute" : "Live Orders"}</h1><p>Every status below comes from the authenticated commerce backend. No browser-generated “Paid” or “Delivered” state is accepted.</p></div><div className="pw-hero-actions"><ConnectControl refresh={refresh} onMessage={setMessage}/><Button variant="secondary" disabled={!session} onClick={load}>{loading ? "Loading…" : "Refresh Orders"}</Button></div></header>
    <StatusGrid caps={caps}/>
    {!session ? <section className="pw-panel"><h2>Signed session required</h2><p>Connect and sign your wallet to read orders owned by that wallet.</p></section> : null}
    {!dispute && <section className="pw-panel">
      <h2>Authoritative order ledger</h2>
      <div className="pw-table"><div className="pw-row head"><b>Order</b><b>Status</b><b>Total</b><b>Payment</b><b>Actions</b></div>
      {orders.length ? orders.map((o) => <div className="pw-row" key={String(o.id)}>
        <span>{String(o.id)}</span><b>{String(o.status || "UNKNOWN")}</b><span>{o.total_cents != null ? `${(Number(o.total_cents)/100).toFixed(2)} ${String(o.currency || "")}` : "—"}</span><span>{String(o.payment_mode || o.payment_reference || "—")}</span>
        <span><button type="button" onClick={() => { setSelected(String(o.id)); setReason("Customer requested refund"); }}>Select refund</button>{String(o.status) === "AWAITING_PAYMENT" ? <button type="button" onClick={async () => { try { await cancelRealCommerceOrder(String(o.id)); setMessage(`Order ${o.id} cancelled by backend.`); await load(); } catch (e: any) { setMessage(String(e?.message || e)); } }}>Cancel unpaid</button> : null}</span>
      </div>) : <p>No live orders returned.</p>}</div>
    </section>}
    <section className="pw-panel">
      <h2>Refund request</h2><p>This creates a backend refund request only. Provider settlement is processed by the authorized server/admin flow.</p>
      <div className="pw-form"><label>Order ID<input value={selected} onChange={e => setSelected(e.target.value)} placeholder="Authoritative order ID"/></label><label>Reason<input value={reason} onChange={e => setReason(e.target.value)} placeholder="Reason"/></label><label>Amount (optional, order currency)<input inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value.replace(/[^0-9.]/g, ""))} placeholder="Full refund when blank"/></label></div>
      <Button disabled={!session || !selected || reason.trim().length < 4} onClick={refund}>Request Refund</Button>
      <Button variant="secondary" onClick={() => router.push("/account/billing")}>Billing Status</Button>
    </section>
    <ShellNotice message={message}/>
  </main></AppShell>;
}

export function SellerOrdersWorkspace() {
  const { caps, refresh } = useCapabilities();
  const [orders, setOrders] = React.useState<AnyRow[]>([]);
  const [message, setMessage] = React.useState("");
  const session = currentCommerceSession();

  const load = async () => {
    if (!currentCommerceSession()) return;
    try {
      const rows = await listRealSellerOrders();
      setOrders(rows);
      setMessage(`Loaded ${rows.length} seller-owned order(s).`);
    } catch (e: any) { setMessage(String(e?.message || e)); }
  };
  React.useEffect(() => { if (session) void load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const transition = async (id: string, status: "FULFILLING" | "READY_FOR_PICKUP" | "SHIPPED" | "COMPLETED") => {
    try {
      await updateRealSellerOrderStatus(id, status);
      setMessage(`${id} transitioned to ${status} by backend policy.`);
      await load();
    } catch (e: any) { setMessage(String(e?.message || e)); }
  };

  return <AppShell><main className="pw-page">
    <header className="pw-hero"><div><small>RWA.MS / MERCHANT</small><h1>Seller Fulfillment</h1><p>Only verified store owners can read or transition seller orders. State transitions are enforced server-side.</p></div><div className="pw-hero-actions"><ConnectControl refresh={refresh} onMessage={setMessage}/><Button variant="secondary" disabled={!session} onClick={load}>Refresh Seller Orders</Button></div></header>
    <StatusGrid caps={caps}/>
    <section className="pw-panel"><h2>Seller-owned orders</h2>
      {orders.length ? orders.map(o => <article className="pw-seller-order" key={String(o.id)}><div><b>{String(o.id)}</b><span>{String(o.status || "UNKNOWN")}</span></div><div className="pw-order-actions">
        {(["FULFILLING","READY_FOR_PICKUP","SHIPPED","COMPLETED"] as const).map(s => <button type="button" key={s} onClick={() => void transition(String(o.id), s)}>{s.replaceAll("_"," ")}</button>)}
      </div></article>) : <p>{session ? "No seller-owned orders returned, or this wallet is not an authorized store owner." : "Sign the seller wallet to query seller-owned orders."}</p>}
    </section><ShellNotice message={message}/>
  </main></AppShell>;
}

export function LiveFundsWorkspace({ mode }: { mode: "deposit" | "withdraw" }) {
  const { caps, refresh } = useCapabilities();
  const [amount, setAmount] = React.useState("");
  const [destination, setDestination] = React.useState("");
  const [confirmText, setConfirmText] = React.useState("");
  const [message, setMessage] = React.useState("");
  const session = currentCommerceSession();
  const expected = mode === "deposit" ? "DEPOSIT" : "WITHDRAW";

  const submit = async () => {
    try {
      if (mode === "deposit") {
        const out = await depositRealMainnetFunds(Number(amount), confirmText);
        setMessage(`Deposit submitted to wallet/venue flow: ${String(out?.hash || out?.status || "submitted")}`);
      } else {
        const out = await withdrawRealMainnetFunds(destination, Number(amount), confirmText);
        setMessage(`Withdrawal submitted by venue flow: ${String(out?.status || "submitted")}`);
      }
    } catch (e: any) { setMessage(String(e?.message || e)); }
  };

  return <AppShell><main className="pw-page">
    <header className="pw-hero"><div><small>RWA.MS / FUNDS</small><h1>{mode === "deposit" ? "Mainnet Deposit" : "Mainnet Withdrawal"}</h1><p>This is a real write adapter, hard-locked until the machine launch gate is READY and the signed wallet is eligible.</p></div><div className="pw-hero-actions"><ConnectControl refresh={refresh} onMessage={setMessage}/><Button variant="secondary" onClick={() => void refresh()}>Refresh Gate</Button></div></header>
    <StatusGrid caps={caps}/>
    <section className="pw-panel"><h2>{caps?.mainnetReady ? "Mainnet write enabled by evidence" : "Mainnet write locked"}</h2>
      <p>{caps?.mainnetReady ? "The execution API will still re-check the production gate at write time." : "No funds can move until launch readiness + wallet E2E evidence pass."}</p>
      <div className="pw-form"><label>Amount USDC<input inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}/></label>
      {mode === "withdraw" ? <label>Destination<input value={destination} onChange={e => setDestination(e.target.value)} placeholder="0x…"/></label> : null}
      <label>Type {expected} to confirm<input value={confirmText} onChange={e => setConfirmText(e.target.value)} placeholder={expected}/></label></div>
      <button type="button" data-live-financial-action="true" data-live-environment="mainnet" disabled={!session || !caps?.mainnetReady || confirmText !== expected || !(Number(amount) > 0)} onClick={() => void submit()}>{mode === "deposit" ? "Submit Mainnet Deposit" : "Submit Mainnet Withdrawal"}</button>
    </section><ShellNotice message={message}/>
  </main></AppShell>;
}
