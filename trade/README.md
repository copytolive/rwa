# RWA Trade — GitHub Pages Safe Terminal

A minimal, non-custodial Hyperliquid trading frontend designed for GitHub Pages.

## User flow

1. Connect wallet.
2. Fund the selected Hyperliquid environment if collateral is zero.
3. Click **Enable 1-click trading** once and approve the delegated API wallet.
4. Place BUY/SELL orders without a master-wallet popup for every order.
5. Entry + optional TP/SL are submitted as an atomic `normalTpsl` order group.
6. Withdrawals always use the master wallet and require the phrase `WITHDRAW`.

## Security defaults

- TESTNET is the default.
- MAINNET is hard-locked in `config.js` with `mainnetEnabled: false`.
- Risk-increasing orders never fall back to the master wallet.
- The delegated agent key is encrypted with AES-GCM and stored in IndexedDB.
- The AES key is a non-extractable WebCrypto key stored in IndexedDB.
- Agent expiry is enabled.
- Agent revoke is available.
- Cancel/close operations may use the master wallet only as an emergency risk-reducing fallback.
- Withdrawals always use the master wallet.
- Leverage and per-order notional are capped in `config.js`.
- No builder/platform trading fee is configured.
- No wallet seed phrase or master private key is ever requested.

## Production path

`https://narzulalistiqlal.github.io/rwa/trade/`

Do not enable mainnet until a real-wallet TESTNET E2E run has passed with venue-backed evidence.

## 24/7 copy trading

GitHub Pages is static. True 24/7 copy trading requires separate compute. The browser UI never claims that a closed tab remains a 24/7 worker.
