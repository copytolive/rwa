# RENKO recertification — 2026-09-01 after cold-path + assertion sync v8

This marker intentionally makes no RENKO runtime change.

Purpose: recertify CURRENT `main` after the RENKO launch-pair cold-path prewarm fix and the matching total-history workflow version assertion sync, so final evidence can be collected against one SHA only.

Closure rules:
- RENKO-only scope.
- Runtime behavior is unchanged by this marker.
- Test thresholds/assertions are not weakened.
- Broad `.github/workflows/pages.yml` remains untouched.
- All final closure evidence must use the resulting SHA only.
- NO EVIDENCE MIXED BETWEEN SHAs.
