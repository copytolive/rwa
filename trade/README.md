# RWA Trade — GitHub Pages Safe Terminal

A minimal non-custodial trading frontend deployed on GitHub Pages. The normal user flow is RWA-branded; venue and signer internals stay inside Advanced diagnostics.

## User flow

1. Connect wallet.
2. Click **Get test balance** when TESTNET equity is zero. The RWA modal requests the TESTNET allocation directly and never embeds or navigates to a third-party funding page.
3. Click **Enable trading** once. The master wallet authorizes a delegated trade-only agent.
4. Place BUY/SELL orders without a master-wallet popup for every order.
5. Entry + optional TP/SL are submitted as an atomic `normalTpsl` order group.
6. Positions, open orders, fills and P&L refresh from the venue.
7. Use **Advanced safety diagnostics → Run full TESTNET verification** to exercise modify, cancel, protected entry, position observation, close, history and P&L, then publish a signed venue-backed proof.

## Execution and security defaults

- TESTNET is the default and MAINNET remains hard-locked.
- Browser writes have one owner: root `execution-api.js`.
- Signed exchange writes use a reusable WebSocket transport.
- Risk-increasing writes are delegated-agent-only and fail closed. They never fall back to the master wallet.
- Reduce-only/cancel emergency exits may use the master wallet only as a risk-reducing fallback.
- The delegated agent secret is encrypted with AES-GCM. The WebCrypto AES key is non-extractable and stored through IndexedDB.
- The master private key or seed phrase is never requested or stored.
- Agent expiry and revoke are supported.
- Leverage, order notional, total exposure, per-asset exposure and daily-loss controls remain enforced.
- Builder/platform trading fees remain disabled.
- The dedicated `/trade/` TESTNET build intentionally keeps withdrawal disabled. Production withdrawal must remain master-wallet-only with explicit high-security confirmation and cannot be enabled until the global launch gate permits mainnet.

## Release verification

The in-app TESTNET verifier refuses to run if the account already has open positions or open orders. It uses a small test notional, verifies a resting order modify/cancel cycle, submits a delegated atomic TP/SL entry, observes and closes the position, validates fills/P&L, and attempts cleanup if a verification step fails.

The final signed proof is still checked independently by `tools/e2e-proof.mjs` against TESTNET venue data before it can enter `launch/e2e-registry.json`. Do not mark a wallet as verified manually.

## Production path

`https://narzulalistiqlal.github.io/rwa/trade/`

Do not enable mainnet until a real-wallet TESTNET E2E run has passed with venue-backed evidence and the global launch gate is `READY_FOR_MAINNET`.

## 24/7 copy trading

GitHub Pages is static. True 24/7 copy trading requires separate compute. The worker source remains isolated from the browser and must not receive a master private key. The browser UI must never claim that a closed tab is a 24/7 worker.
