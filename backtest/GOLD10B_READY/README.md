# GOLD10B READY — Canonical Backtest Package

Folder ini adalah pintu masuk siap-pakai untuk sistem **BACKTEST GOLD 10B**.

## 1. Lokasi canonical GitHub

Seluruh source executable tetap satu authority di:

`backtest/gold24/`

Jangan membuat salinan engine kedua sebagai authority baru.

File inti:
- `backtest/gold24/copytolive_unified_engine.py` — unified canonical engine
- `backtest/gold24/core.py` — 48 real implemented D1 engine families + execution/backtest core
- `backtest/gold24/MASTER_METHOD_UNIVERSE.json` — 20 kategori / family registry
- `backtest/gold24/multimethod_v1_discovery.py` — balanced adaptive discovery
- `backtest/gold24/multimethod_v1_discovery_strict.py` — strict discovery entry point
- `backtest/gold24/multimethod_v1_finalize_strict.py` — Candidate Gate + global Corr finalizer
- `backtest/gold24/multimethod_v1_full_rescan.py` — exact full-metric rescan
- `backtest/gold24/screening_gpt_real_audit.py` — real selected-method audit
- `backtest/gold24/screening_gpt_combined_portfolio_audit.py` — HARD PASS + global portfolio/diversification audit
- `backtest/gold24/period2019_selected_report.py` — 2019→latest exact-ledger diagnostic
- `backtest/gold24/qualified_scripts/` — real Python + MQ5 verified script pairs and shared MT5 include/engine
- `backtest/gold24/runtime_v11/` — finalized canonical authority summary
- `backtest/gold24/runtime_multimethod_v1/` — latest Candidate PASS discovery output
- `backtest/gold24/runtime_screening_gpt/` — selected/portfolio audit output
- `backtest/gold24/runtime_period2019/` — latest 2019→current selected report

## 2. Contract wajib

Total Backtest:
- hanya `finalized canonical backtest`;
- candidate cursor bukan Total Backtest;
- Strict/Multi/screening tidak dijumlah ulang ke finalized canonical count.

Candidate Gate:
- Total Entry >= 100
- Net Profit >= USD 20,000
- global abs Pearson(log-return equity) Corr Max <= 0.50

HARD PASS 8/8:
- Total Entry >= 300
- PF Net >= 1.20
- Max DD <= 25%
- EV/Trade > 0
- OOS PF >= 1.00
- Monte Carlo PASS
- Positive Year >= 60%
- Corr Max <= 0.50

WATCH = Candidate PASS + >=5/8.
FAIL = selain itu.

GOLD/XAUUSD:
- pip size = USD 0.01
- tabel SL/TP wajib pips
- qty canonical standard-lot audit = 100 GOLD units = 1.00 lot
- Python <-> MT5 <-> tabel harus identik.

Dataset:
- real provider/symbol/timeframe/rows/periode/SHA256/cost/qty/equity/config/execution hash wajib traceable;
- synthetic/resampled H1/H4 tidak boleh disebut real native H1/H4;
- H4_D1_MTF_NATIVE dan D1_H4_PULLBACK_NATIVE tetap DATA_BLOCKED sampai real H4 Gate-A PASS.

## 3. Quick start lokal

```bash
git clone https://github.com/copytolive/rwa.git
cd rwa
git sparse-checkout init --no-cone
git sparse-checkout set '/backtest/'
bash backtest/GOLD10B_READY/run_backtest_ready.sh verify
```

Mode `verify`:
- membuat venv lokal,
- install pinned requirements,
- compile file Python inti,
- menjalankan `selftest.py`,
- memverifikasi tepat 48 real engine families + 2 native-H4 DATA_BLOCKED.

## 4. Menjalankan discovery lokal

Butuh canonical state yang sudah direstore dari artifact authority, minimum:
- `gold24-v11.db`
- `gate_a/GC1_COMEX_TRADINGVIEW_D1_PRIMARY.csv`
- `gate_a/gate_a_receipt.json`

Lalu:

```bash
bash backtest/GOLD10B_READY/run_backtest_ready.sh discover /PATH/TO/CANONICAL_STATE 100000 2026090304
```

Output:
- `backtest/gold24/runtime_multimethod_v1/latest_multimethod_v1_discovery.csv`
- `backtest/gold24/runtime_multimethod_v1/latest_multimethod_v1_discovery.json`
- `backtest/gold24/runtime_multimethod_v1/latest_multimethod_v1_discovery_summary.json`

## 5. Jalur GitHub Actions siap pakai

Workflow utama:
- `.github/workflows/gold24-multimethod-v1-discovery-macos.yml`
- `.github/workflows/gold24-engine-family-smoke.yml`
- `.github/workflows/gold24-qualified-script-certification.yml`
- `.github/workflows/gold24-qualified-mt5-metaquotes-certification.yml`
- `.github/workflows/gold24-combined-portfolio-audit.yml`
- `.github/workflows/gold24-selected-2019-report.yml`
- `.github/workflows/gold10b-ready-package.yml`

Discovery Actions secara otomatis:
1. membaca finalized canonical authority;
2. restore canonical state artifact;
3. menjalankan candidate discovery;
4. enforce Entry>=100 + NP>=20k;
5. global correlation <=0.50;
6. publish latest result.

## 6. Script VERIFIED

Metode hanya boleh disebut VERIFIED bila:
- file Python nyata ada;
- CANDIDATE + EXPECTED nyata;
- config hash sama;
- exact canonical replay PASS;
- qty sama;
- metrics parity PASS;
- file MQ5 nyata ada;
- parameter/config hash identik;
- shared engine/include nyata;
- MetaEditor compile PASS;
- native MT5 Strategy Tester PASS.

Jika salah satu belum PASS, jangan diberi label VERIFIED.

## 7. Packaging

Workflow `GOLD10B Ready Package` membuat ZIP reproducible berisi:
- seluruh `backtest/gold24/`;
- folder panduan `backtest/GOLD10B_READY/`;
- workflow utama GOLD24;
- `PACKAGE_SHA256SUMS.txt`;
- `PACKAGE_GIT_SHA.txt`.

ZIP tersebut adalah paket yang diunggah ke Google Drive sebagai **total script + panduan backtest**, sedangkan GitHub tetap source of truth.

## 8. Google Drive

Drive digunakan untuk:
- hasil/report user-facing;
- ZIP ready package;
- panduan operasi;
- spreadsheet `backtest GOLD 10B`.

Drive bukan authority source code. GitHub `copytolive/rwa` tetap canonical source.
