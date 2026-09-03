# RENKO GOLD Scroll Prepend Production Release

Production release marker for the GOLD total-history viewport stability closure.

Acceptance contract:
- 10 consecutive real desktop scroll-left prepend cycles.
- 3 consecutive real mobile scroll-left prepend cycles on public production.
- Total Blocking Time = 0 for each accepted prepend cycle.
- No viewport time-span, from/to, or anchor drift beyond the regression thresholds.
- No `fitContent()` during history prepend.
- Source memory remains bounded to 140,000 bars and decoded-month cache remains bounded.
- Exactly one prepared engine build per prepend and no worker failures.
- Traditional 1 and ATR 14 method switching remains functional.
- Public proof must serve the exact GitHub Pages deployment SHA under `/rwa/renko/deployment-sha.txt`.

The runtime fix is implemented in the RENKO source files merged by PR #118. PR #119 adds static syntax guards for the viewport/stitch layers. This marker intentionally changes no runtime behavior; its purpose is to create a canonical Pages release commit so the exact-SHA production acceptance workflow can validate the deployed artifact.
