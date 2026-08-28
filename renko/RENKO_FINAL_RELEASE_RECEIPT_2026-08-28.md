# RENKO Final Release Receipt — 2026-08-28

Pre-merge candidate: `b084e56f0b19465fc6e6d1831f609231cd2e5e92`
Base main at integration: `5f471cf85dac6248c4b2081ff826852663de61a6`

Exact browser gates:
- 50-pair zero-ms switch gate run `33178946114`: PASS.
- XAUT fixed-1s ATR matrix gate run `33178946202`: PASS.
- Desktop 50 pair: PASS.
- Mobile 50 pair: PASS.
- XAUT provider desktop/mobile: PASS.
- ATR lengths 1 / 10 / 100 / 1000 / 10000 / 100000 / 1000000 desktop/mobile: PASS.

Release contract:
- Production source rate is fixed to 1 second; there is no timeframe selector.
- Pair switching preserves the previous chart on the first frame, avoids the full-screen blank loader, keeps deep XAUT ATR history idle until requested, and keeps rendered Renko geometry bounded.
- XAUT deep ATR UI displays the currently applied validated ATR state instead of a transient matrix worker label.
- Public-production is not considered closed until GitHub Pages serves the exact final main SHA and the public 50-pair and XAUT ATR browser gates both PASS on that SHA.

Claim boundary: observable/documented TradingView Renko behavior only; no claim of access to proprietary TradingView source code.
