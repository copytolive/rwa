# RWA Trade — Real-Trading Release Candidate Checklist

This file separates **code-ready** gates from **external/live evidence** gates so the project never claims production readiness by editing a flag.

## Code-ready gates

- [x] RWA-only normal trading UX.
- [x] Searchable market picker and live professional chart.
- [x] Live mark price, depth, tape and market metrics.
- [x] MARKET and LIMIT entry controls.
- [x] BUY/LONG and SELL/SHORT.
- [x] Atomic entry + TP/SL (`normalTpsl`).
- [x] Post-entry reduce-only TP/SL triggers.
- [x] Open-order modify and cancel.
- [x] Partial position close (25/50/100%) and full close.
- [x] Position/order/fill/P&L venue refresh.
- [x] Delegated one-click trading authorization.
- [x] Single browser write owner: `execution-api.js`.
- [x] Risk-increasing writes fail closed without delegated signer.
- [x] Reduce-only/cancel emergency path remains available.
- [x] Internal risk gate: daily loss, leverage, total exposure, per-asset exposure.
- [x] User-configurable stricter risk limits and kill switch.
- [x] Master seed/private key never requested/stored.
- [x] Agent secret encrypted browser-side.
- [x] Real-wallet venue-backed TESTNET lifecycle PASS and independently registered.
- [x] Mainnet hard-locked in public beta.
- [x] Dedicated 24/7 worker package exists separately from browser frontend.
- [x] Mobile-responsive trading controls.
- [x] CI verifies professional UI does not instantiate another `ExchangeClient` or call `/exchange` directly.

## External/live gates — cannot be fabricated

- [ ] Deploy `agent-worker/` to the project-owned 24/7 server and verify health/readiness/control from the public endpoint.
- [ ] Complete real internal beta evidence required by `launch/readiness.json`.
- [ ] Complete closed beta evidence required by `launch/readiness.json`.
- [ ] Complete public beta evidence required by `launch/readiness.json`.
- [ ] Publish at least one genuinely verified RWA asset with required legal/ownership/appraisal evidence.
- [ ] Confirm production domain/server routing and TLS.
- [ ] Run production smoke tests with MAINNET still locked.
- [ ] Obtain explicit final launch approval and only then enable MAINNET controls.
- [ ] Execute a deliberately small real MAINNET canary trade and verify entry, protection, close, history and P&L before broad public rollout.

## Launch rule

`READY_FOR_MAINNET` must be derived from real machine-evaluated evidence. Do not change `mainnetEnabled`, beta counts, asset verification status or worker-live status merely to make the dashboard green.
