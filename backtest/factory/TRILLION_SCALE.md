# VectorForge — Trillion-Scale Research Architecture

The campaign target is **1,000,000,000,000 unique verified evaluations**. This document defines how VectorForge can scale toward that target without turning the number into a cosmetic counter.

## Layers

1. **GitHub Pages** is the public interactive research UI.
2. **Browser Web Worker** runs user-selected historical simulations locally in the browser.
3. **GitHub Actions** is the control plane for bounded verified batches and publication of auditable ledgers.
4. **Distributed/self-hosted runners** are the intended high-throughput compute layer for very large campaigns.
5. **Merkle shard ledger** compresses proof metadata so the repository does not need to store one trillion 64-character hashes individually.

## Verified evaluation

A verified evaluation must be derived from a canonical identity containing at least:

- exact dataset SHA-256,
- instrument,
- source period,
- strategy/model,
- complete parameter set,
- execution assumptions such as spread/slippage/cost,
- engine version.

The canonical identity is hashed with SHA-256. Repeating exactly the same identity never creates a new unique evaluation.

## Why shards are required

One trillion hexadecimal SHA-256 strings alone would require roughly 64 TB before JSON punctuation, indexes, result metrics, backups or repository overhead. A GitHub repository is not the correct storage layer for that representation.

VectorForge therefore groups completed evaluation ranges into immutable verification shards. Each shard stores a deterministic Merkle root and a verified evaluation count. A compact shard record can prove the set of evaluation IDs without publishing every leaf in the main repository.

During the current small campaign phase, VectorForge intentionally keeps both the explicit `evaluation_ids.json` ledger and the Merkle `shards.json` ledger. This cross-checks the implementation. At massive scale, the shard ledger becomes the count source while leaf/result storage moves to scalable object/database storage.

## Distributed planner rule

A future distributed planner must assign workers canonical, non-overlapping parameter ranges. Each worker receives an immutable job specification with a range ID. It must return:

- job/range ID,
- engine version,
- dataset SHA-256,
- canonical parameter range specification,
- evaluation count,
- result summary,
- Merkle root,
- completion timestamp.

The aggregator rejects duplicate shard IDs and overlapping canonical ranges. Only accepted shards increase the completed counter.

## Claim rule

The public dashboard may display:

- campaign target,
- verified completed count,
- source coverage,
- verified samples,
- shard count,
- dataset and Merkle hashes.

It must never label the one-trillion target as completed until accepted unique shards sum to one trillion verified evaluations.

## Current baseline

The existing verified baseline uses EURUSD 1-second public source files and the `price_vs_sma_state` evaluator across SMA periods 50 through 1500 in increments of 25. It is intentionally a small deterministic baseline used to validate source hashes, deduplication, automation and shard verification before expanding the distributed search space.

The interactive browser lab is broader than this baseline and already supports multiple model families plus execution assumptions. The large-scale factory can expand those dimensions later while retaining the same verification contract in `scale_contract.json`.
