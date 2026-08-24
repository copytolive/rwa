# TESTNET deployment request

Requested by the release-candidate completion pass on 2026-08-24.

This file intentionally changes no runtime logic. Its presence triggers the existing Cloudflare Free worker workflow. The workflow may activate only the delegated-agent TESTNET worker after real Cloudflare credentials are present and `/healthz` + `/readyz` pass. MAINNET remains machine-gated and disabled.
