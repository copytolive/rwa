# RENKO total reference sync — 2026-09-02

This document records the reference-architecture review used for the canonical CopyToLive GOLD / XAUUSD RENKO implementation. It is an engineering map, not a source-code import manifest.

## Source and license rule

- `123DS9472396/FinPulse-AI`: MIT. Compatible implementation patterns may be adapted with normal attribution/license handling if code is ever copied.
- `Abhi-AlgoForge/renko-charts`, `tejred213/StockGenius`, `Soham-Moholkar/NSE-TradeHub-Pro`, and `ranjithprabhuk/wealth-wings`: no repository license was declared when reviewed. Their source code is not copied into this repository. Only independently implemented architectural ideas/behavioural patterns are used.

## What is synchronized

### Abhi-AlgoForge/renko-charts
Reference pattern: deterministic append-only Renko, grid-stable brick construction, real source timestamp separated from dense per-brick display geometry, confirmed history distinct from forming/live projection.

CopyToLive mapping:
- `renko-tv-engine.js`: deterministic confirmed Renko build and projection split.
- `renko-gold-history-geometry-stitch.js`: canonical source lineage is retained separately from monotonic display time; hidden geometry cache keeps a stable dense brick sequence across prepend.
- ATR `_exactBox` session lock prevents bounded source-window shifts from rebasing historical Renko geometry.

### tejred213/StockGenius
Reference pattern: Renko is a pure derivation from cached candle data and chart-style/UI state is separate from source fetching.

CopyToLive mapping:
- canonical fixed-1s source memory is bounded and retained by `renko-gold-total-history.js`.
- worker/prepared builds derive Renko from the already-loaded source window; prepend is required to execute exactly one prepared engine build.
- method controls change settings/rebuild from current canonical data instead of replacing the GOLD source contract.

### 123DS9472396/FinPulse-AI
Reference pattern: chart controller/UI concerns are separated from data and chart-style selection.

CopyToLive mapping:
- `renko-gold-explicit-zoom.js` owns intentional logical-width changes only.
- `renko-gold-wheel-pan-lock.js` owns horizontal/mixed-trackpad position changes only.
- `renko-gold-manual-viewport-lock.js` owns user/history viewport persistence.
- zoom releases stale manual/history ownership before changing logical width; pan never writes logical width.
- ATR and Traditional remain explicit method selectors without changing canonical GOLD identity.

### Soham-Moholkar/NSE-TradeHub-Pro
Reference pattern: clean/sorted source input and dense synthetic brick chronology before handing data to Lightweight Charts.

CopyToLive mapping:
- canonical Dukascopy fixed-1s manifest is sorted and identity-locked.
- geometry stitch produces a monotonic dense display timeline while retaining canonical source lineage for seam matching and audit.

### ranjithprabhuk/wealth-wings
Reference pattern: incremental Renko updates from streaming prices.

CopyToLive mapping:
- only the confirmed-vs-projection separation is relevant to the canonical GOLD route.
- external websocket feed integration is intentionally NOT enabled on the canonical GOLD page. The canonical production contract remains downloaded Dukascopy XAU-USD, 1s, bid, complete history.

## Interaction ownership contract

1. Horizontal or mixed wheel/trackpad gesture: PAN owner.
   - native wheel scale/scroll is disabled.
   - pan uses `timeScale.scrollToPosition`, not `setVisibleLogicalRange`.
   - at the older edge, the impulse is consumed and history prepend starts before entering blank space.
   - bar spacing is held through prepend settle.

2. Vertical-only wheel or Ctrl/Meta pinch: ZOOM owner.
   - bounded logical width change.
   - stale viewport authority, manual lock, and pan size lock are released before zoom.

3. `+` / `-`: intentional ZOOM owner.

4. History prepend: HISTORY owner.
   - immutable viewport snapshot.
   - exactly one prepared worker/engine build per prepend.
   - no `fitContent()`.
   - barSpacing, rightOffset, time span, from/to and anchor are restored with strict drift thresholds.

## Performance / bounded-memory contract

- rendered Renko geometry: max 2,500 bricks.
- hidden geometry cache: bounded to 56,000 bricks.
- canonical source bars in memory: max 140,000.
- decoded history months per prepend: max 2; normal proof target 1.
- worker build failures: 0.
- total blocking time during prepend acceptance: 0 ms.

## Production acceptance

A reference-sync change is not complete until the exact release SHA passes:

- Traditional 10 explicit zoom: `+`, `-`, vertical wheel, Ctrl/Meta pinch.
- horizontal/mixed back-scroll with zero accidental zoom.
- desktop 10/10 prepend viewport regression.
- mobile 3/3 prepend smoke.
- Traditional / ATR method regression.
- canonical Pages exact-SHA validation.

The external repositories are references only. The CopyToLive canonical GOLD source identity and historical output remain authoritative.
