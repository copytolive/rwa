# VectorForge Tick Source Catalog

`manifest.json` indexes every monthly file that was verified to exist in the upstream public EURUSD 1-second repository used by VectorForge.

Coverage:

- Symbol: EURUSD
- Sampling: 1 second
- First source month: 2009-05
- Last source month: 2018-07
- Indexed monthly files: 111
- Upstream repository: `zcbmlijygrdwa/fx_EUR_USD_tick`

The raw monthly files are intentionally referenced rather than copied into this repository because individual files are commonly tens of megabytes and the full archive is several gigabytes. The VectorForge browser worker streams the selected files directly from their raw GitHub URLs.

Every verified GitHub batch downloads its selected source file, computes a SHA-256 digest, and persists that digest in the batch/campaign ledgers. This lets a result be tied to the exact bytes used in the calculation.

No file is fabricated for dates after the verified upstream coverage.
