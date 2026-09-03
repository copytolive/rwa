# 🟨 PROMPT UPDATE — BACKTEST GOLD 10B

@GitHub selesaikan sampai tuntas dan sinkronkan hasil terbaru ke @Google Drive → `backtest GOLD 10B`.

## 1️⃣ Total Backtest
- Gunakan hanya finalized canonical backtest.
- Candidate cursor bukan Total Backtest.
- Jangan double-count Strict / Multi / Screening yang berasal dari kandidat yang sama.

## 2️⃣ Candidate Gate
Setiap metode minimal:
- Total Entry ≥100
- Net Profit ≥USD20.000
- Corr Max ≤0,50

Correlation:
- absolute Pearson(log-return equity)
- GLOBAL per-symbol terhadap seluruh selected
- quality-ordered greedy
- jika >0,50, hapus metode dengan kualitas/ranking lebih rendah

## 3️⃣ Validasi Unit & Angka
- Net Profit / EV = USD
- WR / Max DD / MC95 DD / Positive Year = %
- PF / Recovery / SQN / OOS PF / Corr = ratio
- Entry / Max Consecutive Loss = count
- History = years
- Worst Year = calendar year

## 4️⃣ SL & TP
- SL / TP = pips
- GOLD/XAUUSD pip size = USD0,01
- parameter Python ↔ MT5 ↔ tabel harus identik

## 5️⃣ Tabel Final
Metode → TF → Order → Direction → SL → TP → Total Entry → WR → PF Net → Net Profit → EV/Trade → Avg Win/Loss → Max DD → Recovery Factor → Max Consecutive Loss → SQN → OOS PF → Monte Carlo Pass → MC 95% DD → Positive Year → Worst Year → Periode Backtest → History → Sample v11 → Corr Max → Corr Gate → Python Script → MT5 Script

## 6️⃣ Script Wajib Real
Python:
- real .py GitHub
- CANDIDATE + EXPECTED
- config hash
- exact canonical replay
- qty sama
- metrics parity PASS

MT5:
- real .mq5 GitHub
- bukan mockup
- parameter dan config hash identik
- real engine/include
- MetaEditor compile PASS
- native MT5 Strategy Tester PASS

Jika salah satu gagal → jangan beri VERIFIED.

## 7️⃣ Metode / Family
20 kategori wajib:
Moving Average / Trend; Channel / Breakout; Momentum; Mean Reversion; Candlestick; Hybrid / Ensemble; Chart Pattern; Market Structure; Support / Resistance; Fibonacci; Volatility; Keltner / Bollinger Hybrid; Ichimoku; SuperTrend / Adaptive Trend; Divergence; Volume; VWAP; Statistical; Relative Strength; Multi-Timeframe.

Engine expansion:
- baseline 24 family
- +22 D1-real remix implemented
- +2 native H4/D1 family DATA_BLOCKED sampai real H4 tersedia
- registry target 48
- dilarang mengaku 48 implemented sebelum 2 native-MTF memiliki data real dan Gate-A PASS
- jangan hanya variasi Candle/Donchian

## 8️⃣ Real Dataset
Wajib traceable:
provider; symbol; timeframe; rows; periode; dataset SHA256; cost model; quantity/lot; starting equity; config hash; execution hash.

Dilarang synthetic/resample timeframe lalu disebut real H1/H4.
Native H1/H4 hanya boleh setelah canonical dataset asli + Gate-A audit.

## 9️⃣ HARD PASS
Candidate PASS ≠ final.

8 HARD gates:
1. Total Entry ≥300
2. PF Net ≥1,20
3. Max DD ≤25%
4. EV/Trade >0
5. OOS PF ≥1,00
6. Monte Carlo PASS / probability positive ≥95%
7. Positive Year ≥60%
8. Corr Max ≤0,50

- HARD PASS = Candidate PASS + 8/8
- WATCH = Candidate PASS + ≥5/8
- FAIL = selain itu

## 🔟 Portfolio Gate
- global correlation seluruh selected
- greedy Corr ≤0,50
- minimal 6 family
- target ≥10 family
- max family share 25%; ideal ≤20%
- kurangi dominasi Candle
- hitung portfolio DD + diagnostic PnL
- jangan sebut LIVE READY sebelum margin/slippage/commission/swap/tick/simultaneous-position interaction tervalidasi

## 1️⃣1️⃣ Progress BEFORE → AFTER
Wajib angka:
Total finalized backtest; Candidate evaluated; Candidate PASS; HARD PASS; WATCH; FAIL; selected methods; distinct family; max family concentration; Corr violations; global Corr kept; Python verified; MT5 verified; Sample ≥300; Max DD ≤25%; portfolio readiness.

Jika tidak ada perkembangan:
cari penyebab → perbaiki engine/data/discovery → rerun → validate → baru update.

## 🎯 Target Akhir
48 registered real-family designs → large-scale backtest → Candidate Gate → HARD PASS → global correlation → diversification → exact Python/MT5 → Portfolio Final tradable + reproducible + auditable.
