"use client";

import * as React from "react";
import {
  authorizeTestnetExecutionAgent,
  connectWalletAndAuthenticate,
  createRealCheckout,
  currentCommerceSession,
  getRealOrder,
  getRuntimeCapabilities,
  resolveCommerceApiBase,
  submitRealExecutionOrder,
  type RuntimeCapabilities,
} from "@/lib/live-runtime";
import "./live-action-center.css";

type LiveProduct = {
  id: string;
  name: string;
  store_token: string;
  currency: string;
  price_cents: number;
  available: number;
  pickup?: number;
  shipping?: number;
};

type OpenDetail = { kind?: "checkout" | "trade"; side?: "BUY" | "SELL" };

const emptyCapabilities: RuntimeCapabilities = {
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

function money(cents: number, currency: string) {
  try { return new Intl.NumberFormat(undefined, { style: "currency", currency: currency || "IDR" }).format(Number(cents || 0) / 100); }
  catch { return `${currency || "IDR"} ${(Number(cents || 0) / 100).toFixed(2)}`; }
}

export function LiveActionCenter({ capabilities = emptyCapabilities, onCapabilities }: { capabilities?: RuntimeCapabilities; onCapabilities?: (value: RuntimeCapabilities) => void }) {
  const [open, setOpen] = React.useState<"checkout" | "trade" | null>(null);
  const [side, setSide] = React.useState<"BUY" | "SELL">("BUY");
  const [products, setProducts] = React.useState<LiveProduct[]>([]);
  const [productId, setProductId] = React.useState("");
  const [quantity, setQuantity] = React.useState(1);
  const [fulfillment, setFulfillment] = React.useState("pickup");
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [address, setAddress] = React.useState("");
  const [city, setCity] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [status, setStatus] = React.useState("");
  const [orderId, setOrderId] = React.useState("");
  const [coin, setCoin] = React.useState("BTC");
  const [orderType, setOrderType] = React.useState<"MARKET" | "LIMIT">("MARKET");
  const [size, setSize] = React.useState("0.001");
  const [price, setPrice] = React.useState("");
  const [environment, setEnvironment] = React.useState<"testnet" | "mainnet">("testnet");
  const [agentReady, setAgentReady] = React.useState(false);

  const selected = products.find(p => p.id === productId) || null;

  const refreshCapabilities = React.useCallback(async () => {
    const next = await getRuntimeCapabilities().catch(() => emptyCapabilities);
    onCapabilities?.(next);
    return next;
  }, [onCapabilities]);

  const ensureAuth = React.useCallback(async () => {
    const existing = currentCommerceSession();
    if (existing) return existing;
    setStatus("Requesting wallet signature…");
    const session = await connectWalletAndAuthenticate();
    setStatus(`Authenticated wallet ${session.wallet.slice(0, 8)}…${session.wallet.slice(-4)}.`);
    await refreshCapabilities();
    return session;
  }, [refreshCapabilities]);

  const loadProducts = React.useCallback(async () => {
    const base = await resolveCommerceApiBase(true);
    const response = await fetch(`${base}/v1/products`, { cache: "no-store" });
    const payload = await response.json().catch(() => ({ ok: false }));
    if (!response.ok || payload?.ok !== true) throw new Error(String(payload?.error || `Catalog HTTP ${response.status}`));
    const rows = Array.isArray(payload.data) ? payload.data.filter((p: LiveProduct) => Number(p.available) > 0) : [];
    setProducts(rows);
    setProductId(value => value && rows.some((p: LiveProduct) => p.id === value) ? value : String(rows[0]?.id || ""));
    if (!rows.length) throw new Error("No authoritative verified products are currently available");
    return rows;
  }, []);

  React.useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<OpenDetail>).detail || {};
      if (detail.kind === "checkout") {
        setOpen("checkout");
        setStatus("");
        void loadProducts().catch(e => setStatus(String(e?.message || e)));
      } else if (detail.kind === "trade") {
        setOpen("trade");
        setSide(detail.side === "SELL" ? "SELL" : "BUY");
        setStatus("");
      }
    };
    window.addEventListener("rwa:open-live-action", handler as EventListener);
    return () => window.removeEventListener("rwa:open-live-action", handler as EventListener);
  }, [loadProducts]);

  React.useEffect(() => {
    if (!open) return;
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(null); };
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, [open]);

  async function startCheckout() {
    if (!selected) return;
    setBusy(true);
    setStatus("Preparing authoritative checkout…");
    try {
      await ensureAuth();
      const latest = await refreshCapabilities();
      if (!latest.checkoutReady) throw new Error(`Checkout is still machine-gated${latest.blockers.length ? `: ${latest.blockers.join(", ")}` : ""}`);
      if (fulfillment === "shipping" && (!address.trim() || !city.trim())) throw new Error("Shipping address and city are required");
      const result = await createRealCheckout({
        items: [{ product_id: selected.id, quantity }],
        fulfillment,
        destination: fulfillment === "shipping" ? { address: address.trim(), city: city.trim() } : {},
        contact: { name: name.trim(), email: email.trim(), phone: phone.trim() },
      });
      setOrderId(String(result.order.id));
      sessionStorage.setItem("rwa_live_pending_order_v1", String(result.order.id));
      setStatus(`Order ${result.order.id} created. Payment is NOT marked paid until the provider webhook is verified.`);
      const redirect = String(result.payment.redirect_url || "");
      if (redirect) window.location.assign(redirect);
    } catch (error: any) {
      setStatus(String(error?.message || error));
    } finally {
      setBusy(false);
    }
  }

  async function checkSettlement() {
    const id = orderId || sessionStorage.getItem("rwa_live_pending_order_v1") || "";
    if (!id) { setStatus("No pending live order is recorded in this browser session."); return; }
    setBusy(true);
    try {
      await ensureAuth();
      const order = await getRealOrder(id);
      setOrderId(id);
      setStatus(`Authoritative order ${id}: ${String(order?.status || "UNKNOWN")}. Paid is accepted only after signed provider settlement evidence.`);
      if (["PAID", "COMPLETED", "REFUNDED", "CANCELLED"].includes(String(order?.status || "").toUpperCase())) sessionStorage.removeItem("rwa_live_pending_order_v1");
    } catch (error: any) { setStatus(String(error?.message || error)); }
    finally { setBusy(false); }
  }

  async function authorizeAgent() {
    setBusy(true);
    setStatus("Authenticating wallet and requesting Hyperliquid TESTNET agent approval…");
    try {
      await ensureAuth();
      const result = await authorizeTestnetExecutionAgent();
      setAgentReady(true);
      setStatus(`TESTNET agent authorized: ${String(result?.address || "approved")}. No mainnet permission was granted.`);
      await refreshCapabilities();
    } catch (error: any) { setStatus(String(error?.message || error)); }
    finally { setBusy(false); }
  }

  async function executeOrder() {
    const numericSize = Number(size);
    const numericPrice = Number(price);
    if (!(numericSize > 0)) { setStatus("Enter a positive order size."); return; }
    if (orderType === "LIMIT" && !(numericPrice > 0)) { setStatus("Enter a positive limit price."); return; }
    setBusy(true);
    setStatus(`Submitting real ${environment.toUpperCase()} ${side} order to Hyperliquid…`);
    try {
      await ensureAuth();
      const latest = await refreshCapabilities();
      if (environment === "mainnet" && !latest.mainnetReady) throw new Error(`MAINNET remains machine-locked${latest.blockers.length ? `: ${latest.blockers.join(", ")}` : ""}`);
      const result = await submitRealExecutionOrder({
        coin: coin.trim().toUpperCase(),
        side,
        type: orderType,
        size: numericSize,
        price: orderType === "LIMIT" ? numericPrice : undefined,
        environment,
      });
      setStatus(`${environment.toUpperCase()} venue accepted the order. Write mode: ${String(result?.mode || "venue")}.`);
    } catch (error: any) { setStatus(String(error?.message || error)); }
    finally { setBusy(false); }
  }

  if (!open) return null;
  return <div className="live-action-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setOpen(null); }}>
    <section className="live-action-panel" role="dialog" aria-modal="true" aria-label={open === "checkout" ? "Live checkout" : "Live execution"}>
      <header className="live-action-head">
        <div><small>RWA.MS VERIFIED LIVE PATH</small><h2>{open === "checkout" ? "Authoritative Checkout" : "Hyperliquid Execution"}</h2></div>
        <button type="button" aria-label="Close live action" onClick={() => setOpen(null)}>×</button>
      </header>
      <div className="live-action-truth">
        <b>{capabilities.authenticated ? "Wallet session authenticated" : "Wallet signature required"}</b>
        <span>Commerce: {capabilities.checkoutReady ? "READY" : "GATED"}</span>
        <span>Execution testnet: {capabilities.executionAvailable ? "AVAILABLE" : "VERIFY ON CONNECT"}</span>
        <span>Mainnet: {capabilities.mainnetReady ? "READY" : "LOCKED"}</span>
      </div>
      {open === "checkout" ? <div className="live-action-body">
        <p>Only products returned by the verified commerce backend can be purchased here. Prices, inventory, quote and order totals are server-authoritative.</p>
        <label>Verified product<select value={productId} onChange={e => setProductId(e.target.value)}>{products.map(p => <option key={p.id} value={p.id}>{p.name} · {p.store_token} · {money(p.price_cents, p.currency)} · stock {p.available}</option>)}</select></label>
        <label>Quantity<input type="number" min={1} max={Math.max(1, Number(selected?.available || 1))} value={quantity} onChange={e => setQuantity(Math.max(1, Math.min(Number(selected?.available || 1), Number(e.target.value || 1))))}/></label>
        <label>Fulfillment<select value={fulfillment} onChange={e => setFulfillment(e.target.value)}><option value="pickup">Store pickup</option><option value="shipping">Shipping</option></select></label>
        <div className="live-action-grid"><label>Name<input value={name} onChange={e => setName(e.target.value)}/></label><label>Email<input type="email" value={email} onChange={e => setEmail(e.target.value)}/></label><label>Phone<input value={phone} onChange={e => setPhone(e.target.value)}/></label></div>
        {fulfillment === "shipping" && <div className="live-action-grid"><label>Address<input value={address} onChange={e => setAddress(e.target.value)}/></label><label>City<input value={city} onChange={e => setCity(e.target.value)}/></label></div>}
        <div className="live-action-actions"><button type="button" onClick={() => void loadProducts().catch(e => setStatus(String(e?.message || e)))} disabled={busy}>Refresh authoritative catalog</button><button type="button" data-live-financial-action="true" data-live-environment="commerce" onClick={startCheckout} disabled={busy || !selected}>Pay with Verified Checkout</button><button type="button" onClick={checkSettlement} disabled={busy}>Check Settlement</button></div>
      </div> : <div className="live-action-body">
        <p>TESTNET is the default real execution environment. MAINNET stays disabled until the machine launch gate and this wallet&apos;s E2E evidence are both verified.</p>
        <div className="live-action-grid"><label>Environment<select value={environment} onChange={e => setEnvironment(e.target.value as "testnet" | "mainnet")}><option value="testnet">Hyperliquid TESTNET</option><option value="mainnet" disabled={!capabilities.mainnetReady}>Hyperliquid MAINNET {capabilities.mainnetReady ? "" : "(locked)"}</option></select></label><label>Coin<input value={coin} onChange={e => setCoin(e.target.value.toUpperCase())} placeholder="BTC"/></label><label>Side<select value={side} onChange={e => setSide(e.target.value as "BUY" | "SELL")}><option>BUY</option><option>SELL</option></select></label><label>Order type<select value={orderType} onChange={e => setOrderType(e.target.value as "MARKET" | "LIMIT")}><option>MARKET</option><option>LIMIT</option></select></label><label>Size<input inputMode="decimal" value={size} onChange={e => setSize(e.target.value)}/></label>{orderType === "LIMIT" && <label>Limit price<input inputMode="decimal" value={price} onChange={e => setPrice(e.target.value)}/></label>}</div>
        <div className="live-action-actions"><button type="button" onClick={authorizeAgent} disabled={busy || environment !== "testnet"}>{agentReady ? "Re-authorize TESTNET Agent" : "Authorize TESTNET Agent"}</button><button type="button" data-live-financial-action="true" data-live-environment={environment} onClick={executeOrder} disabled={busy || (environment === "mainnet" && !capabilities.mainnetReady)}>Execute {environment === "testnet" ? "TESTNET" : "MAINNET"} Order</button></div>
      </div>}
      {status && <div className="live-action-status" role="status">{status}</div>}
      {capabilities.blockers.length > 0 && <details><summary>Current machine blockers</summary><code>{capabilities.blockers.join(" · ")}</code></details>}
    </section>
  </div>;
}
