# TESTNET deployment request

Requested by the release-candidate completion pass on 2026-08-24.

Retry checkpoint: 2026-08-24 after Product RWA MVP + full-platform launch-gate merged to `main`.

This file intentionally changes no runtime logic. Its change triggers the existing Cloudflare Free worker workflow. The workflow may activate only the delegated-agent TESTNET worker after real Cloudflare credentials are present and `/healthz` + `/readyz` pass. MAINNET remains machine-gated and disabled until all real-asset, commerce, legal, pilot and beta gates pass.

Execution retry: 2026-08-24T18:17+07:00.
