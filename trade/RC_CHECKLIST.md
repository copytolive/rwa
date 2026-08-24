# RWA Trade — Real-Trading Release Candidate Checklist

This file separates **code-ready** gates from **external/live evidence** gates so the project never claims production readiness by editing a flag.

## Code-ready gates

- [x] RWA-only normal trading UX.
- [x] Searchable market picker and live professional candlestick chart.
- [x] Live mark price, depth, tape, 24h metrics, open interest and funding.
- [x] MARKET and LIMIT entry controls.
- [x] BUY/LONG and SELL/SHORT.
- [x] Quick USD sizing and equity sizing.
- [x] Leverage controls plus ISOLATED/CROSS margin selection; isolated-only markets fail safely to isolated.
- [x] Atomic entry + TP/SL (`normalTpsl`).
- [x] Post-entry reduce-only TP/SL triggers.
- [x] Position and open-order levels surfaced on the chart.
- [x] Open-order modify and cancel.
- [x] Partial position close (25/50/100%) and full close.
- [x] Position/order/fill/P&L venue refresh.
- [x] Emergency exit: kill switch + cancel all + reduce-only close all + residual verification.
- [x] Safe trade deep links for market/side/type/USD/leverage/TP/SL/price prefill.
- [x] EIP-6963 injected-wallet provider discovery with legacy injected fallback.
- [x] Delegated one-click trading authorization.
- [x] Single browser write owner: `execution-api.js`.
- [x] Risk-increasing writes fail closed without delegated signer.
- [x] Reduce-only/cancel emergency path remains available.
- [x] Internal risk gate: daily loss, leverage, total exposure, per-asset exposure.
- [x] User-configurable stricter risk limits and kill switch.
- [x] Master seed/private key never requested/stored.
- [x] Agent secret encrypted browser-side.
- [x] Real-wallet venue-backed TESTNET lifecycle PASS and independently registered.
- [x] Machine-gated MAINNET switch requires fresh global `READY_FOR_MAINNET` plus this wallet's verified E2E registry entry.
- [x] Dedicated 24/7 worker package exists separately from browser frontend.
- [x] Cloudflare Free + Durable Object worker bundle builds successfully and has a TESTNET-only deployment workflow.
- [x] Mobile-responsive trading controls and fixed mobile BUY/SELL bar.
- [x] Root market Watch, Alert, Share and Trade Perps shortcuts are functional rather than placeholder actions.
- [x] Portfolio, verified trader leaderboard, copy trading, signed social feed and market intelligence remain integrated.
- [x] Followed verified traders can generate in-app/browser position-move alerts while RWA is open; unsupported Notification APIs fail gracefully.
- [x] Static UI contract, security contract, product-parity contract and aggregate release-candidate gate pass.
- [x] Real Chromium desktop/mobile smoke operates live controls, modals, margin buttons, chart interval, Hub and mobile trade surfaces.
- [x] CI verifies UI enhancement modules do not instantiate another `ExchangeClient` or call `/exchange` directly.

## External/live gates — cannot be fabricated

- [ ] Activate a public 24/7 worker endpoint and verify `/healthz`, `/readyz`, control and persistence. The Cloudflare Free bundle is ready; the current deployment workflow is waiting for real Cloudflare API credentials if they are not already configured.
- [ ] Complete real internal beta evidence required by `launch/readiness.json`.
- [ ] Complete closed beta evidence required by `launch/readiness.json`.
- [ ] Complete public beta evidence required by `launch/readiness.json`.
- [ ] Publish at least one genuinely verified RWA asset with required ownership/appraisal/legal/KYB/disclosure evidence.
- [ ] Confirm production domain/server routing and TLS for any non-GitHub-Pages worker/API endpoint.
- [ ] Run production smoke tests with MAINNET still locked.
- [ ] Obtain explicit final launch approval and only then enable MAINNET controls.
- [ ] Execute a deliberately small real MAINNET canary lifecycle and verify entry, protection, close, history and P&L before broad public rollout.

## Launch rule

`READY_FOR_MAINNET` must be derived from real machine-evaluated evidence. Do not change beta counts, asset verification status, worker-live status or MAINNET control merely to make the dashboard green. The public frontend may expose the MAINNET switch only when the machine gate is fresh and the connected wallet has a verified E2E record.
