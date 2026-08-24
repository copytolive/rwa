# TESTNET deployment request

Requested by the release-candidate completion pass on 2026-08-24.

Retry checkpoint: 2026-08-24 after commerce RC + hardening merged and the release-candidate status passed on the same public code line.

This file intentionally changes no runtime logic. Its change triggers the existing Cloudflare Free worker workflow. The workflow may activate only the delegated-agent TESTNET worker after real Cloudflare credentials are present and `/healthz` + `/readyz` pass. MAINNET remains machine-gated and disabled.
