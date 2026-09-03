# RWA Asset Launch Evidence — Hard Gate

The platform must not mark an RWA asset `VERIFIED` from assumptions, mock documents, screenshots, or internally generated placeholder evidence.

A launchable asset requires five **distinct public HTTPS evidence URLs**, all returning HTTP 2xx when the registry verifier runs:

1. **Ownership** — real evidence that the issuer/owner legally controls the underlying warehouse/unit/inventory or other RWA represented by the product.
2. **Appraisal / NAV** — dated valuation evidence supporting a positive NAV. Prefer an independent appraisal or another defensible valuation source.
3. **Legal** — executed/legal-counsel evidence covering issuer authority, product/token classification, ownership/title treatment, redemption rights, transferability, and applicable Indonesian regulatory analysis.
4. **KYB** — issuer/company verification evidence. Publish only a safe public verification package; do not expose private IDs, private keys, passwords, bank credentials, or unnecessary personal data.
5. **Disclosure** — public terms and risk disclosure covering redemption, reserve methodology, fees, conflicts, operational risks, suspension/shortage handling, and customer rights.

## Current project status

The existing RWA Productive Warehouse validation pack is still a **NO-GO for public asset sale**: issuer identity/stock ownership remain unresolved, legal classification remains under review, and multiple market/factory/legal/tech/ops gates are not yet supported by final evidence.

Therefore `rwa-assets.json` must remain empty until real evidence exists and an authorized reviewer signs the exact verification payload. The automated verifier then probes the five URLs and independently verifies the reviewer signature before registry publication.

This gate is intentionally non-bypassable. It protects users and prevents a software-complete launch from being presented as an asset/legal-complete launch.
