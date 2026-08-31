# Security model

## Trust boundaries

### Master wallet
The master wallet is used only for:
- initial wallet connection;
- one-time delegated API wallet approval;
- delegated API wallet revoke/replacement;
- emergency risk-reducing operations if the delegated agent is unavailable;
- withdrawal.

Risk-increasing regular orders are never signed by the master-wallet fallback.

### Delegated API wallet
The delegated API wallet is used for:
- market/limit entry;
- leverage updates;
- atomic entry + TP/SL;
- normal order management while the agent is valid.

The app verifies the agent against Hyperliquid `extraAgents` before risk-increasing writes.

### Local agent-key storage
The delegated private key is encrypted with AES-GCM. The encryption key is a non-extractable WebCrypto `CryptoKey`, both persisted using IndexedDB.

This is safer than plaintext `localStorage`, but it is not a hardware-security boundary. Malicious JavaScript executing on the same origin could still invoke browser APIs and access the app's origin storage. Therefore keep dependencies pinned, review dependency updates, avoid analytics/tag managers, and use a dedicated trading wallet with bounded capital.

## Mainnet
`mainnetEnabled` is `false` by default. Do not change it until TESTNET funding, delegated API wallet, market/limit orders, atomic TP/SL, cancel/close, positions/fills/P&L, revoke and withdrawal flows have all been reviewed with venue-backed evidence.

## Withdrawal
Withdrawal requires the master wallet, destination validation, positive amount, browser confirmation, and typed phrase `WITHDRAW`. The delegated agent path is never used for withdrawal.
