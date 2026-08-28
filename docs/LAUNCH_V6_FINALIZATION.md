# Launch V6 Finalization

This document defines the final fail-closed convergence path from engineering-ready to `READY_FOR_MAINNET`.

## Non-negotiable rule

No gate is marked PASS from an assumption, placeholder, local mock, synthetic transaction, manually edited balance, or unverifiable screenshot. Every externally controlled gate must be backed by machine-checkable production/testnet evidence and the responsible human authorization where required.

## Current convergence order

1. Recompute canonical global readiness from current `main`.
2. Close Product RWA prerequisites: one verified RWA asset and HyperEVM testnet chain 998 deployment receipts.
3. Bring commerce backend and delegated worker to public HTTPS health/ready state.
4. Close external operational gates: legal terms, operating economics, inventory reconciliation, refund/shortage remedy, settlement tie-out, incident/backup recovery, and evidence repository.
5. Close MULTI CHAIN: five real receipt classes, LI.FI production fee setup, and Hyperliquid builder funding/approval.
6. Complete beta thresholds 3 internal / 20 closed / 100 public unique verified wallets.
7. Enable mainnet control only after all preceding gates are green.
8. Re-run the dual global + multichain gate. Unrestricted execution unlocks only when global status is `READY_FOR_MAINNET` and MULTI CHAIN status is `READY`.

## External authorization boundaries

The repository can validate and ingest evidence, but it cannot truthfully manufacture:

- wallet signatures or on-chain receipts;
- LI.FI Partner Portal approval or payout-wallet configuration;
- Hyperliquid builder account funding or end-user builder fee approval;
- counsel approval;
- real supplier, inventory, payment, refund, settlement, backup/recovery or beta-user activity.

Those inputs remain fail-closed until real evidence exists.

## Launch decision

`GO` is allowed only when all machine gates pass. Any missing external proof keeps the launch decision at `NO-GO`.
