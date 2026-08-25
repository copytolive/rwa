# Global Asset Terminal — 1–50 Definition of Done

Target: **Crypto realtime + 40,000–50,000 global stocks + regulator-backed fundamentals + dividend + financial history + physical RWA in one canonical `/rwa/` terminal.**

Accuracy contract: the system may be engineering-complete while global source coverage is still externally gated. A missing or unlicensed source must remain `SOURCE GATED`, `DELAYED`, `EOD`, or unavailable. It must never be promoted to a fabricated `LIVE`/`VERIFIED` state.

| # | Engineering deliverable | Status |
|---:|---|---|
| 1 | Canonical `/rwa/` root remains the terminal | PASS |
| 2 | Existing Binance crypto realtime path preserved | PASS |
| 3 | Provider-agnostic Global Asset runtime | PASS |
| 4 | Stocks filter inside same terminal | PASS |
| 5 | Crypto filter inside same terminal | PASS |
| 6 | Country filter | PASS |
| 7 | Stock timeframe hard-locked to 10 minutes | PASS |
| 8 | No unlicensed stock order book | PASS |
| 9 | Stock market-data status shown explicitly | PASS |
| 10 | Global Security Master contract | PASS |
| 11 | Collision-resistant exchange-aware security IDs | PASS |
| 12 | MIC/exchange/country/currency identity fields | PASS |
| 13 | Ticker/name/exchange/country search | PASS |
| 14 | Browser rendering bounded while full catalog remains searchable | PASS |
| 15 | Official regulator/source registry | PASS |
| 16 | Redistribution/use-policy registry | PASS |
| 17 | Traditional stocks cannot inherit RWA reviewer `VERIFIED` | PASS |
| 18 | Fundamental numeric provenance required | PASS |
| 19 | `RWA CALCULATED` values require formula + source inputs | PASS |
| 20 | Official SEC US catalog synchronizer | PASS |
| 21 | SEC CIK association preserved | PASS |
| 22 | SEC XBRL frame fundamentals bootstrap | PASS |
| 23 | Sharded fundamentals storage | PASS |
| 24 | Browser shard bridge | PASS |
| 25 | Revenue normalization | PASS |
| 26 | Net income normalization | PASS |
| 27 | EPS normalization | PASS |
| 28 | Assets normalization | PASS |
| 29 | Liabilities normalization | PASS |
| 30 | Equity normalization | PASS |
| 31 | Cash normalization | PASS |
| 32 | Operating cash-flow normalization | PASS |
| 33 | CapEx normalization | PASS |
| 34 | 10-year financial-history target | PASS |
| 35 | Source-backed dividend engine | PASS |
| 36 | Corporate-action engine | PASS |
| 37 | Fundamental coverage/freshness/source score | PASS |
| 38 | Compact country-sharded search-index builder | PASS |
| 39 | Desktop browser proof | PASS |
| 40 | Mobile browser proof | PASS |
| 41 | Stock-specific fundamentals overlay | PASS |
| 42 | Source/provenance view | PASS |
| 43 | Financial-history view | PASS |
| 44 | Dividend view | PASS |
| 45 | Crypto depth/chart recovery after stock mode | PASS |
| 46 | Stock expansion cannot bypass launch/mainnet gates | PASS |
| 47 | Fail-closed global data audit | PASS |
| 48 | CI syntax/data/browser gate | PASS |
| 49 | Scheduled official SEC catalog/fundamental sync workflows | PASS |
| 50 | Multi-country rollout registry and 40k–50k target contract | PASS — engineering contract; production data coverage remains source/licensing gated |

## What “PASS” means

`PASS` means the repository contains the executable engineering control and it is subject to CI. It does **not** mean a regulator, exchange, issuer, broker, or market-data licensor has granted rights that have not actually been granted.

## Data labels

- `REGULATOR FILED`: value extracted from a regulator filing/API with provenance.
- `ISSUER ANNOUNCED`: issuer-published corporate action/dividend.
- `EXCHANGE SOURCE`: exchange-origin identity/event data where policy permits its use.
- `RWA CALCULATED`: formula-derived value whose sourced inputs are preserved.
- `SOURCE GATED`: the terminal refuses to invent or redistribute the value.
- `LIVE`, `DELAYED`, `EOD`: market-data freshness classes; these are independent of the 10-minute candle interval.

## Global production completion rule

The final 40,000–50,000+ claim may only be displayed when machine-generated coverage counts confirm it from the actual Global Security Master. Likewise, “complete fundamentals” must be expressed as measured coverage, not a marketing assumption. Country adapters remain gated until source terms and the parser for that market are actually proven.
