# RWA Execution API

RWA uses a Hyperliquid-style execution architecture.

## Identity

The user's **master EVM wallet is the only login identity**. Login is proven with a wallet signature. RWA never asks for or stores the master wallet private key.

## Fast API wallet / agent wallet

After login, the user may authorize a dedicated Hyperliquid API/agent wallet once. The agent key is generated inside the browser, encrypted with AES-GCM using a non-extractable WebCrypto key stored in IndexedDB, and the encrypted payload is stored locally per master wallet and per environment.

The agent is only for delegated trading signatures. It is not the account used for portfolio queries. Portfolio, open orders and P&L are always queried with the master account address.

The UI supports revocation/rotation. Revocation replaces the named Hyperliquid agent authorization and deletes the locally encrypted agent record.

## Browser execution namespace

`window.RWAExecutionAPI`

### Auth

- `RWAExecutionAPI.auth.master()`
- `RWAExecutionAPI.auth.provider()`

### Agent

- `await RWAExecutionAPI.agent.authorize(testnet)`
- `await RWAExecutionAPI.agent.revoke(testnet)`
- `RWAExecutionAPI.agent.status(testnet)`

### Orders

- `await RWAExecutionAPI.orders.limit({ coin, side, price, size, leverage, reduceOnly, testnet })`
- `await RWAExecutionAPI.orders.market({ coin, side, size, leverage, reduceOnly, slippageBps, testnet })`
- `await RWAExecutionAPI.orders.cancel({ coin, oid, testnet })`
- `await RWAExecutionAPI.orders.modify({ coin, oid, side, price, size, testnet })`
- `await RWAExecutionAPI.orders.cancelAll({ testnet })`
- `await RWAExecutionAPI.orders.trigger({ coin, side, size, triggerPx, tpsl, testnet })` after the order-management bridge is loaded.

The API prefers the authorized agent wallet. If no agent is authorized, it falls back to the logged-in master wallet and the user signs the trading action.

### Account / read API

- `await RWAExecutionAPI.account.state(testnet)`
- `await RWAExecutionAPI.account.fills(testnet)`
- `await RWAExecutionAPI.orders.open(testnet)`
- `await RWAExecutionAPI.orders.history(testnet)`
- `await RWAExecutionAPI.info(type, data, testnet)`

### Risk

- `await RWAExecutionAPI.risk.setLeverage({ coin, leverage, testnet })`

Existing RWA global risk checks are also executed before new orders.

## Builder fee / platform revenue

The execution config contains an optional Hyperliquid builder-code configuration. It is disabled until an official RWA builder wallet address is configured.

When enabled:

1. the master wallet explicitly approves the maximum builder fee;
2. RWA includes the builder code on applicable orders;
3. Hyperliquid processes the builder fee onchain.

No fee is silently enabled.

## Security boundaries

- Master private key: never stored by RWA.
- Agent private key: generated client-side; encrypted at rest in the browser.
- Agent wallet: intended for trading delegation, not withdrawals/transfers.
- Mainnet trading: still requires the explicit mainnet confirmation control.
- Kill Switch and RWA risk limits remain active before execution.
- Testnet is the default execution environment.

## Venue

The current execution venue is Hyperliquid. `rwa-execution-config.json` defines mainnet/testnet API locations and future builder configuration. The UI calls the RWA Execution API; the API is responsible for the underlying venue client.

This is currently a browser-side non-custodial execution API, not a custodial RWA server that holds user keys or funds.
