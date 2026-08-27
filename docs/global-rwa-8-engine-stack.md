# Global RWA 8-Engine Stack

North Star: Every Business. An RWA.

This document records the reference architecture and upstream projects selected for the Global RWA Factory. Production issuance and trading remain disabled unless jurisdiction, KYB/KYC, evidence, reviewer, funding and mainnet gates all pass.

## 1. RWA Passport
Primary upstream: decentralized-identity/veramo (Apache-2.0)
Role: DID/VC issuance and verification, key management, selective disclosure.
RWA adapter: organization-centric Business Passport and Asset Credentials.

## 2. Asset Registry
Primary upstream: hyperledger-firefly/firefly (Apache-2.0)
Role: enterprise asset/data/blockchain orchestration, pluggable token and event connectors.
RWA adapter: canonical business -> asset -> evidence -> instrument graph.

## 3. Proof Engine
Primary upstream: sigstore/rekor and sigstore/rekor-tiles (Apache-2.0)
Role: append-only, tamper-evident transparency proofs.
RWA adapter: hash every evidence package, valuation snapshot, legal decision and issuance receipt. Documents themselves stay private; only hashes/metadata are published.

## 4. Valuation Engine
Primary upstream: lballabio/QuantLib (QuantLib license)
Role: quantitative finance modelling and risk.
RWA adapter: DCF, bond/debt, cash-flow, scenario and risk models, plus asset-class-specific valuation adapters. Every output carries model/version/input provenance.

## 5. Legal / Jurisdiction Engine
Primary upstreams: openfisca/openfisca-core (AGPL-3.0) for Rules-as-Code patterns; open-policy-agent/opa (Apache-2.0) for production policy decisioning.
Role: encode jurisdiction-specific eligibility and legal-rights decisions.
RWA policy: no LLM-only legal approval. AI may explain; deterministic policy + reviewer evidence decides.

## 6. Compliance Engine
Primary upstreams: open-policy-agent/opa (Apache-2.0), opensanctions/yente (MIT; data licensing separate).
Role: policy enforcement, sanctions/PEP/watchlist screening, investor/business eligibility and transfer checks.
RWA policy: screening is mandatory at onboarding and re-screening; false positives require reviewer workflow.

## 7. RWA Factory
Primary upstreams: ERC-3643/ERC-3643 (GPL-3.0) and OpenZeppelin/openzeppelin-contracts (MIT).
Role: permissioned token/identity/compliance contracts plus audited base primitives.
RWA policy: REGISTER mode is default. FINANCE and TRADE are jurisdiction-gated. Token/TGE/mainnet deployment remains disabled by default.

## 8. Global Marketplace
Primary upstream: 0xProject/protocol (open protocol) / 0x APIs as optional execution adapter.
Role: liquidity routing and EVM execution after RWA compliance eligibility passes.
RWA policy: marketplace discovery is universal; execution is not. Regulated instruments must pass instrument, investor, jurisdiction and transfer restrictions before any order can settle.

## Canonical lifecycle
BUSINESS -> VERIFY -> PASSPORT -> ADD ASSET -> PROOF -> VALUE -> LEGAL CLASSIFY -> COMPLIANCE -> REGISTER -> optional FINANCE -> optional TRADE -> SETTLE -> SERVICE -> CONTINUOUS RE-SCREEN / RE-VERIFY

## Product modes
- REGISTER: global default; creates RWA Passport + verified asset record, no investment offer.
- FINANCE: creates a financing proposal only after legal/compliance eligibility.
- TRADE: execution enabled only where instrument + investor + venue + jurisdiction gates permit it.

## Non-negotiable safety gates
- No secondary direct blockchain write path.
- No mainnet deployment from browser-only approval.
- No token/TGE deployment merely because product tests pass.
- No unverified asset can become tradeable.
- No legal/compliance decision may be represented as authoritative when source evidence is missing.
- Every decision/output must carry provenance, policy version and timestamp.
