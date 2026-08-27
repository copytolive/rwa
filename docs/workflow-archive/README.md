# Archived workflow startup failures

These four workflow definitions were moved out of `.github/workflows/` on 2026-08-27 because GitHub repeatedly created failed workflow runs with **No jobs were run** on unrelated pushes, generating notification storms.

Archived unchanged:
- agent-worker-smoke.yml
- browser-operability.yml
- engineering-gate.yml
- storefront-ui.yml

They remain fully preserved in Git history and here for repair/review. Active production release, Pages, Super App regression, RENKO gates, security gates, registry review, and other valid workflows are not disabled by this archive operation.

Do not restore these files to `.github/workflows/` until a clean workflow-dispatch smoke proves they create actual jobs rather than startup failures.
