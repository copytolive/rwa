# GOLD canonical v11 — parallel capacity architecture

Status: **capacity proof only; non-authoritative**  
Policy: `GOLD_CANONICAL_V11_20260828`

## Purpose

Before any canonical GOLD search is multiplied across many GitHub runners, prove that one global candidate-cursor range can be partitioned across 20 workers with exact coverage and zero overlap.

The proof intentionally does **not** run strategy simulation and does **not** mutate canonical counters. It is safe to run while the existing canonical recovery/search state remains authoritative.

## Baseline used for this proof

The capacity workflow starts from the latest published v11 candidate cursor observed when this branch was created: `22152069` (batch 225). It allocates a synthetic forward range of 200,000 candidate IDs only for sharding verification.

## Sharding rule

For a global range `[start, start + count)` and `N` workers, worker `i` receives:

`start + i, start + i + N, start + i + 2N, ...`

For 20 workers this guarantees deterministic, disjoint ownership of every candidate ID in the range. The aggregator reconstructs the full global range and fails unless all of these are true:

- exactly 20 shard manifests exist;
- shard indexes are exactly `0..19`;
- each shard matches the expected modulo assignment;
- each shard digest matches its candidate ID list;
- duplicate assignment count is zero;
- missing assignment count is zero;
- the sorted union equals the complete expected global range;
- every shard declares `authoritative=false`, `simulation_executed=false`, `canonical_state_mutation=false`, and `counter_increment=0`.

## Why canonical v11 is not yet run independently in 20 isolated databases

That would be unsafe. Canonical v11 requires global authority for ConfigHash uniqueness, novelty, exact execution-ledger duplicate resolution, rankings, portfolio correlation, and family concentration. Twenty isolated `v11_runner.py` databases cannot independently know what the other 19 workers have accepted.

The correct production design is therefore:

1. deterministic global seed/cursor assignment;
2. workers produce raw, immutable per-candidate evidence only;
3. one global aggregator performs cross-worker ConfigHash/novelty resolution;
4. simulation results are merged into a single canonical authority store;
5. execution hashes are only a narrowing aid and full ledgers remain final duplicate authority;
6. portfolio filtering is centralized: **Maks 0.50 (pearson, log-return equity). Metode: per-symbol greedy filter. > 0.50 → yang kualitas lebih rendah DIHAPUS.**
7. only after the global read-back passes may canonical counters and TOP outputs advance.

## Promotion gate after this capacity proof

A real parallel backtest must not be promoted until it can demonstrate all of the following in one reproducible run: strict Gate A PASS on the approved D1 bytes/receipt, identical candidate generation to canonical v11, complete per-candidate ledgers, cross-worker duplicate handling, one global ranking authority, centralized correlation/diversification filtering, atomic checkpoint publication, and read-back verification.

The capacity proof is therefore the concurrency/sharding prerequisite, not a substitute for canonical strategy evidence.
