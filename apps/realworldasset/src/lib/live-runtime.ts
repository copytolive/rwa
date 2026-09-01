"use client";

export type CommerceSession = {
  token: string;
  wallet: string;
  expires_at: number;
  apiBase: string;
};

export type RuntimeCapabilities = {
  walletProvider: boolean;
  walletConnected: boolean;
  authenticated: boolean;
  commerceReachable: boolean;
  checkoutReady: boolean;
  paymentConfigured: boolean;
  executionAvailable: boolean;
  mainnetReady: boolean;
  apiBase: string;
  blockers: string[];
};

type EthereumProvider = {
  request(args: { method: string; params?: unknown[] }): Promise<any>;
};

type CommerceConfig = {
  api_base?: string;
  candidate_api_base?: string;
  client_mode_default?: string;
  write_policy?: string;
};

type ExecutionApi = {
  health(testnet?: boolean): Promise<any>;
  production: { gate(options?: { force?: boolean }): Promise<any>; require(): Promise<any> };
  agent: { authorize(testnet?: boolean): Promise<any>; status(testnet?: boolean): any; verify(testnet?: boolean): Promise<any> };
  orders: {
    limit(args: Record<string, any>): Promise<any>;
    market(args: Record<string, any>): Promise<any>;
    bracket(args: Record<string, any>): Promise<any>;
    cancel(args: Record<string, any>): Promise<any>;
  };
};

declare global {
  interface Window {
    ethereum?: EthereumProvider;
    RWAProvider?: EthereumProvider;
    RWAExecutionAPI?: ExecutionApi;
  }
}

const COMMERCE_SESSION_KEY = "rwa_commerce_session_v1";
const EXECUTION_SESSION_KEY = "rwa_wallet_link_v1";
let resolvedBase: string | null | undefined;
let executionLoad: Promise<ExecutionApi> | null = null;
let walletAuthenticationInFlight: Promise<CommerceSession> | null = null;

function isBrowser() { return typeof window !== "undefined"; }
function basePath() { return isBrowser() && window.location.pathname.startsWith("/rwa") ? "/rwa" : ""; }
function staticUrl(path: string) { return `${basePath()}${path.startsWith("/") ? path : `/${path}`}`; }
function provider(): EthereumProvider | null { return isBrowser() ? (window.RWAProvider || window.ethereum || null) : null; }

function safeJson<T>(value: string | null): T | null {
  try { return value ? JSON.parse(value) as T : null; } catch { return null; }
}

export function currentCommerceSession(): CommerceSession | null {
  if (!isBrowser()) return null;
  const session = safeJson<CommerceSession>(localStorage.getItem(COMMERCE_SESSION_KEY));
  if (!session?.token || !/^0x[a-f0-9]{40}$/i.test(session.wallet || "") || !session.apiBase) return null;
  if (Number(session.expires_at || 0) <= Date.now()) {
    clearLocalSession();
    return null;
  }
  return session;
}

function clearLocalSession() {
  if (!isBrowser()) return;
  localStorage.removeItem(COMMERCE_SESSION_KEY);
  localStorage.removeItem(EXECUTION_SESSION_KEY);
  window.dispatchEvent(new CustomEvent("rwa:session-changed", { detail: { authenticated: false } }));
}

async function readCommerceConfig(): Promise<CommerceConfig> {
  const r = await fetch(staticUrl("/rwa-commerce-config.json"), { cache: "no-store" });
  if (!r.ok) throw new Error(`Commerce config HTTP ${r.status}`);
  return r.json();
}

async function probeBase(base: string) {
  const clean = String(base || "").replace(/\/$/, "");
  if (!/^https:\/\//i.test(clean) && !/^http:\/\/127\.0\.0\.1(?::\d+)?$/i.test(clean) && !/^http:\/\/localhost(?::\d+)?$/i.test(clean)) {
    throw new Error("Commerce API base must use HTTPS");
  }
  const [healthResponse, readyResponse] = await Promise.all([
    fetch(`${clean}/healthz`, { cache: "no-store" }),
    fetch(`${clean}/readyz`, { cache: "no-store" }),
  ]);
  if (!healthResponse.ok || !readyResponse.ok) throw new Error(`Commerce probe HTTP ${healthResponse.status}/${readyResponse.status}`);
  const [health, ready] = await Promise.all([healthResponse.json(), readyResponse.json()]);
  if (health?.ok !== true || ready?.service_ready !== true) throw new Error("Commerce service is not ready");
  return { base: clean, health, ready };
}

export async function resolveCommerceApiBase(force = false): Promise<string> {
  if (!force && resolvedBase !== undefined) {
    if (!resolvedBase) throw new Error("Commerce backend is not reachable");
    return resolvedBase;
  }
  const cfg = await readCommerceConfig();
  const candidates = [...new Set([cfg.api_base, cfg.candidate_api_base].map(x => String(x || "").trim()).filter(Boolean))];
  for (const candidate of candidates) {
    try {
      const p = await probeBase(candidate);
      resolvedBase = p.base;
      return p.base;
    } catch {
      // Candidate promotion is evidence-based. Try the next configured endpoint only.
    }
  }
  resolvedBase = null;
  throw new Error("Commerce backend is not reachable");
}

async function api<T = any>(path: string, init: RequestInit = {}, requireSession = false): Promise<T> {
  const session = currentCommerceSession();
  const base = requireSession && session?.apiBase ? session.apiBase : await resolveCommerceApiBase();
  const headers = new Headers(init.headers || {});
  if (init.body && !headers.has("content-type")) headers.set("content-type", "application/json");
  if (requireSession) {
    if (!session?.token) throw new Error("Wallet authentication required");
    headers.set("authorization", `Bearer ${session.token}`);
  }
  const response = await fetch(`${base}${path}`, { ...init, headers, cache: "no-store" });
  const payload = await response.json().catch(() => ({ ok: false, error: `HTTP_${response.status}` }));
  if (!response.ok || payload?.ok === false) throw new Error(String(payload?.detail || payload?.error || `HTTP ${response.status}`));
  return payload as T;
}

async function performWalletAuthentication(): Promise<CommerceSession> {
  const p = provider();
  if (!p?.request) throw new Error("No browser wallet provider found");
  const alreadyAuthorized = await p.request({ method: "eth_accounts" }).catch(() => []);
  const accounts = Array.isArray(alreadyAuthorized) && alreadyAuthorized.length
    ? alreadyAuthorized
    : await p.request({ method: "eth_requestAccounts" });
  const wallet = String(accounts?.[0] || "").toLowerCase();
  if (!/^0x[a-f0-9]{40}$/.test(wallet)) throw new Error("Wallet did not return a valid EVM address");
  const base = await resolveCommerceApiBase(true);
  const challengeResponse: any = await api("/v1/auth/challenge", {
    method: "POST",
    body: JSON.stringify({ wallet }),
  });
  const challenge = challengeResponse?.data;
  const message = String(challenge?.message || "");
  if (!message) throw new Error("Authentication challenge missing");
  let signature: string;
  try {
    signature = String(await p.request({ method: "personal_sign", params: [message, wallet] }));
  } catch (first) {
    try { signature = String(await p.request({ method: "personal_sign", params: [wallet, message] })); }
    catch { throw first; }
  }
  const verifyResponse: any = await api("/v1/auth/verify", {
    method: "POST",
    body: JSON.stringify({ wallet, signature }),
  });
  const verified = verifyResponse?.data;
  if (!verified?.token || String(verified.wallet || "").toLowerCase() !== wallet) throw new Error("Server did not issue a valid wallet session");
  const session: CommerceSession = {
    token: String(verified.token),
    wallet,
    expires_at: Number(verified.expires_at || 0),
    apiBase: base,
  };
  localStorage.setItem(COMMERCE_SESSION_KEY, JSON.stringify(session));
  localStorage.setItem(EXECUTION_SESSION_KEY, JSON.stringify({ wallet, authenticatedAt: Date.now(), source: "commerce-signature-v1" }));
  window.dispatchEvent(new CustomEvent("rwa:session-changed", { detail: { authenticated: true, wallet } }));
  return session;
}

export async function connectWalletAndAuthenticate(): Promise<CommerceSession> {
  if (walletAuthenticationInFlight) return walletAuthenticationInFlight;
  walletAuthenticationInFlight = performWalletAuthentication()
    .catch((error: any) => {
      const message = String(error?.message || error || "");
      if (/already pending|requestPermissions|request.*pending|pending.*request/i.test(message)) {
        throw new Error("Wallet approval is already pending. Finish or cancel the existing wallet popup, then retry.");
      }
      throw error;
    })
    .finally(() => { walletAuthenticationInFlight = null; });
  return walletAuthenticationInFlight;
}

export async function logoutRealSession() {
  const session = currentCommerceSession();
  try {
    if (session?.token && session.apiBase) {
      await fetch(`${session.apiBase}/v1/auth/logout`, {
        method: "POST",
        headers: { authorization: `Bearer ${session.token}` },
        cache: "no-store",
      });
    }
  } finally {
    clearLocalSession();
  }
}

export async function getRuntimeCapabilities(): Promise<RuntimeCapabilities> {
  const session = currentCommerceSession();
  let commerceReachable = false;
  let checkoutReady = false;
  let paymentConfigured = false;
  let apiBase = "";
  const blockers: string[] = [];
  try {
    apiBase = await resolveCommerceApiBase(true);
    const readyResponse = await fetch(`${apiBase}/readyz`, { cache: "no-store" });
    const ready = await readyResponse.json();
    commerceReachable = readyResponse.ok && ready?.service_ready === true;
    checkoutReady = commerceReachable && ready?.checkout_ready === true;
    paymentConfigured = ready?.payment_configured === true;
    if (Array.isArray(ready?.blockers)) blockers.push(...ready.blockers.map(String));
  } catch {
    blockers.push("commerce_backend_unreachable");
  }
  let executionAvailable = false;
  let mainnetReady = false;
  if (session) {
    try {
      const ex = await loadExecutionApi();
      const testnetHealth = await ex.health(true);
      executionAvailable = testnetHealth?.api === "ok" && !!testnetHealth?.walletProvider;
      const gate = await ex.production.gate({ force: true });
      mainnetReady = gate?.ready === true;
      if (!mainnetReady && gate?.reason) blockers.push(String(gate.reason));
    } catch {
      blockers.push("execution_runtime_unavailable");
    }
  }
  return {
    walletProvider: !!provider(),
    walletConnected: !!session?.wallet,
    authenticated: !!session,
    commerceReachable,
    checkoutReady,
    paymentConfigured,
    executionAvailable,
    mainnetReady,
    apiBase,
    blockers: [...new Set(blockers)],
  };
}

function idem(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return `${prefix}-${crypto.randomUUID()}`;
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export async function createRealCheckout(input: {
  items: Array<{ product_id: string; quantity: number }>;
  fulfillment?: string;
  destination?: Record<string, any>;
  contact?: Record<string, any>;
  notes?: string;
}) {
  if (!currentCommerceSession()) throw new Error("Authenticate with wallet before checkout");
  const quoteResponse: any = await api("/v1/quote", {
    method: "POST",
    body: JSON.stringify({
      items: input.items,
      fulfillment: input.fulfillment || "PICKUP",
      destination: input.destination || {},
    }),
  }, true);
  const quote = quoteResponse?.data;
  if (!quote?.id) throw new Error("Authoritative quote missing");
  const orderResponse: any = await api("/v1/orders", {
    method: "POST",
    headers: { "idempotency-key": idem("order") },
    body: JSON.stringify({ quote_id: quote.id, contact: input.contact || {}, notes: input.notes || "", payment_mode: "MIDTRANS" }),
  }, true);
  const order = orderResponse?.data;
  if (!order?.id) throw new Error("Order creation failed");
  const paymentResponse: any = await api(`/v1/orders/${encodeURIComponent(order.id)}/payment`, {
    method: "POST",
    headers: { "idempotency-key": idem("payment") },
    body: JSON.stringify({}),
  }, true);
  const payment = paymentResponse?.data;
  if (!payment?.token && !payment?.redirect_url) throw new Error("Payment provider did not issue a payment session");
  return { quote, order, payment };
}

export async function getRealOrder(orderId: string) {
  const response: any = await api(`/v1/orders/${encodeURIComponent(orderId)}`, {}, true);
  return response?.data;
}

export async function getRealPaymentStatus(orderId: string) {
  const response: any = await api(`/v1/orders/${encodeURIComponent(orderId)}/payment-status`, {}, true);
  return response?.data;
}

export async function loadExecutionApi(): Promise<ExecutionApi> {
  if (!isBrowser()) throw new Error("Execution runtime requires a browser");
  if (window.RWAExecutionAPI) return window.RWAExecutionAPI;
  if (executionLoad) return executionLoad;
  executionLoad = new Promise<ExecutionApi>((resolve, reject) => {
    const timeout = window.setTimeout(() => reject(new Error("Execution runtime load timeout")), 20_000);
    const done = () => {
      if (!window.RWAExecutionAPI) return;
      window.clearTimeout(timeout);
      window.removeEventListener("rwa:execution-api-ready", done);
      resolve(window.RWAExecutionAPI);
    };
    window.addEventListener("rwa:execution-api-ready", done);
    const script = document.createElement("script");
    script.src = staticUrl("/execution-api.js");
    script.async = true;
    script.onerror = () => {
      window.clearTimeout(timeout);
      reject(new Error("Execution runtime script unavailable"));
    };
    document.head.appendChild(script);
    done();
  });
  return executionLoad;
}

export async function authorizeTestnetExecutionAgent() {
  if (!currentCommerceSession()) throw new Error("Authenticate with wallet first");
  const ex = await loadExecutionApi();
  return ex.agent.authorize(true);
}

export async function submitRealExecutionOrder(input: {
  coin: string;
  side: "BUY" | "SELL";
  type: "MARKET" | "LIMIT";
  size: number;
  price?: number;
  leverage?: number;
  reduceOnly?: boolean;
  environment?: "testnet" | "mainnet";
}) {
  if (!currentCommerceSession()) throw new Error("Authenticate with wallet first");
  const ex = await loadExecutionApi();
  const testnet = input.environment !== "mainnet";
  if (!testnet) await ex.production.require();
  const agent = ex.agent.status(testnet);
  if (!agent) throw new Error(`${testnet ? "Testnet" : "Mainnet"} execution agent is not authorized`);
  if (input.type === "LIMIT") {
    if (!(Number(input.price) > 0)) throw new Error("Limit price is required");
    return ex.orders.limit({ coin: input.coin, side: input.side, price: input.price, size: input.size, leverage: input.leverage, reduceOnly: !!input.reduceOnly, testnet });
  }
  return ex.orders.market({ coin: input.coin, side: input.side, size: input.size, leverage: input.leverage, reduceOnly: !!input.reduceOnly, testnet });
}
