# RENKO same-SHA recertification — canonical Pages witness v6

Base CURRENT main before this marker: `ad0999a9fa32805cb285aa393588b762fe8f190f`.

This RENKO-only marker re-anchors certification after unrelated non-RENKO drift. The RENKO canonical Pages witness architecture is already present: `renko/renko-deployment-sha.txt` is a Git symlink to `../deployment-sha.txt`, allowing the existing canonical RWA Pages workflow to publish the same exact SHA at both witness paths without modifying the broad Pages workflow.

This marker changes no RENKO runtime, provider, data, chart method, UI, trading semantics, or workflow logic.

All final evidence must be regenerated from the commit produced by this marker. No evidence from earlier SHAs may be mixed into final closure.
