# GOLD canonical v11 — parallel capacity architecture

Status: **staged proof; canonical promotion remains single-writer only**  
Policy: `GOLD_CANONICAL_V11_20260828`

## Purpose

Before any canonical GOLD search is multiplied across many GitHub runners, prove concurrency in stages without contaminating canonical counters, cursor ownership, rankings, or ledgers.

The authoritative search remains `GOLD Canonical v11 Recovery Continuation` until every promotion gate below is proven and read back.

## Stage 1 — deterministic 20-worker capacity proof

The capacity workflow starts from the published v11 candidate cursor `22152069` (batch 225) and partitions a synthetic forward range of 200,000 candidate IDs only for sharding verification.

For a global range `[start, start + count)` and `N` workers, worker `i` receives:

`start + i, start + i + N, start + i + 2N, ...`

For 20 workers the aggregator fails unless all are true:

- exactly 20 shard manifests exist;
- shard indexes are exactly `0..19`;
- each shard matches the deterministic modulo assignment;
- each shard digest matches its candidate ID list;
- duplicate assignment count is zero;
- missing assignment count is zero;
- the sorted union equals the complete expected global range;
- every shard declares `authoritative=false`, `simulation_executed=false`, `canonical_state_mutation=false`, and `counter_increment=0`.

This stage does **not** backtest strategies. It proves only cursor/shard ownership.

## Stage 2 — isolated simulation probe with centralized read-only dedupe

`parallel_search_probe.py` and `gold24-parallel-search-probe.yml` add a second, still non-authoritative proof:

1. freeze one already-published canonical Recovery run;
2. restore its SQLite DB and exact Gate-A D1 bytes/receipt;
3. assign deterministic cursor ownership to 20 workers;
4. each worker uses canonical `generate_v11_candidate`, `backtest_candidate`, stressed-cost execution and `evaluate_v11_metrics`;
5. workers emit immutable candidate + complete ledger evidence only;
6. one aggregator orders evidence deterministically, re-applies baseline/global novelty, and checks exact full-ledger duplicates against the frozen canonical baseline and across shards;
7. the probe explicitly sets `authoritative=false`, `promotion_enabled=false`, `canonical_state_mutation=false`, `counter_increment=0`, and `candidate_cursor_advance_allowed=false`.

Stage 2 therefore measures whether actual canonical-semantics simulations can be distributed safely enough to proceed to a merge design. It still cannot advance canonical counters.

## Why 20 isolated canonical databases are forbidden

Canonical v11 requires one global authority for ConfigHash uniqueness, novelty, exact execution-ledger duplicate resolution, rankings, portfolio correlation, and family concentration. Twenty independent `v11_runner.py` databases cannot know what the other workers have accepted.

The production design must therefore be:

1. deterministic global seed/cursor assignment;
2. workers produce raw, immutable per-candidate evidence only;
3. one global aggregator performs cross-worker ConfigHash/novelty resolution;
4. simulation evidence is merged into a single restored canonical authority store;
5. execution hashes are only a narrowing aid and full ledgers remain final duplicate authority;
6. portfolio filtering is centralized: **Maks 0.50 (pearson, log-return equity). Metode: per-symbol greedy filter. > 0.50 → yang kualitas lebih rendah DIHAPUS.**
7. only after atomic publication and read-back may canonical counters and TOP outputs advance.

## Stage 3 — required before parallel canonical promotion

A future parallel writer is promotable only after one reproducible run proves all of the following:

- strict Gate A PASS on the approved true-source D1 bytes/receipt;
- candidate generation identical to canonical v11;
- complete per-candidate ledgers;
- deterministic global ConfigHash and novelty resolution;
- exact full-ledger duplicate handling against the pre-run canonical DB and all new worker evidence;
- exactly one writer merges accepted/archive evidence into a restored canonical SQLite state;
- canonical `candidate_cursor`, batch receipts, rankings, and counters advance exactly once;
- centralized correlation/diversification filtering preserves the required `<=0.50` rule and family cap;
- atomic artifact/runtime publication succeeds;
- the published run is read back and all counts reconcile before promotion.

Until Stage 3 passes, parallel outputs remain evidence/probes only and **must never be added to canonical v11 counters**.
