"use client";

import { currentCommerceSession, getRuntimeCapabilities, loadExecutionApi } from "./live-runtime";

type RequestInitJson = Omit<RequestInit, "body"> & { body?: unknown };

function sessionOrThrow() {
  const session = currentCommerceSession();
  if (!session?.token || !session.apiBase) throw new Error("Wallet authentication required");
  return session;
}

async function authApi(path: string, init: RequestInitJson = {}) {
  const session = sessionOrThrow();
  const headers = new Headers(init.headers || {});
  headers.set("authorization", `Bearer ${session.token}`);
  if (init.body !== undefined) headers.set("content-type", "application/json");
  const response = await fetch(`${session.apiBase}${path}`, {
    ...init,
    headers,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    cache: "no-store",
  });
  const payload = await response.json().catch(() => ({ ok: false, error: `HTTP_${response.status}` }));
  if (!response.ok || payload?.ok === false) {
    throw new Error(String(payload?.detail || payload?.error || `HTTP ${response.status}`));
  }
  return payload?.data;
}

export async function listRealCommerceOrders() {
  const data = await authApi("/v1/orders");
  return Array.isArray(data) ? data : [];
}

export async function cancelRealCommerceOrder(orderId: string) {
  if (!orderId) throw new Error("Order ID is required");
  return authApi(`/v1/orders/${encodeURIComponent(orderId)}/cancel`, { method: "POST", body: {} });
}

export async function requestRealCommerceRefund(orderId: string, reason: string, amountCents?: number | null) {
  if (!orderId) throw new Error("Order ID is required");
  if (String(reason || "").trim().length < 4) throw new Error("Refund reason is required");
  return authApi(`/v1/orders/${encodeURIComponent(orderId)}/refund-request`, {
    method: "POST",
    body: {
      reason: String(reason).trim(),
      ...(Number.isFinite(Number(amountCents)) && Number(amountCents) > 0 ? { amount_cents: Math.round(Number(amountCents)) } : {}),
    },
  });
}

export async function listRealSellerOrders() {
  const data = await authApi("/v1/seller/orders");
  return Array.isArray(data) ? data : [];
}

export async function updateRealSellerOrderStatus(
  orderId: string,
  status: "FULFILLING" | "READY_FOR_PICKUP" | "SHIPPED" | "COMPLETED",
) {
  if (!orderId) throw new Error("Order ID is required");
  return authApi(`/v1/seller/orders/${encodeURIComponent(orderId)}/status`, {
    method: "PUT",
    body: { status },
  });
}

export async function getRealExecutionAccountSnapshot(testnet = true) {
  if (!currentCommerceSession()) throw new Error("Wallet authentication required");
  const execution: any = await loadExecutionApi();
  const [state, fills] = await Promise.all([
    execution.account.state(testnet),
    execution.account.fills(testnet),
  ]);
  return {
    environment: testnet ? "testnet" : "mainnet",
    state,
    fills: Array.isArray(fills) ? fills : [],
  };
}

export async function depositRealMainnetFunds(amount: number, confirmText: string) {
  const capabilities = await getRuntimeCapabilities();
  if (!capabilities.mainnetReady) throw new Error("MAINNET remains locked by launch evidence");
  const execution: any = await loadExecutionApi();
  return execution.funds.depositMainnet({ amount, confirmText });
}

export async function withdrawRealMainnetFunds(destination: string, amount: number, confirmText: string) {
  const capabilities = await getRuntimeCapabilities();
  if (!capabilities.mainnetReady) throw new Error("MAINNET remains locked by launch evidence");
  const execution: any = await loadExecutionApi();
  return execution.funds.withdrawMainnet({ destination, amount, confirmText });
}
