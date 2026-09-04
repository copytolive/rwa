from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import os
from pathlib import Path

import numpy as np
import pandas as pd


def sha256(p: Path) -> str:
    return hashlib.sha256(p.read_bytes()).hexdigest()


def main() -> int:
    ap = argparse.ArgumentParser(description="Fetch source-native broker H4 bars through MetaTrader5; never resample")
    ap.add_argument("--terminal", required=True)
    ap.add_argument("--crosscheck", required=True)
    ap.add_argument("--out-dir", required=True)
    ap.add_argument("--symbol", default="XAUUSD")
    a = ap.parse_args()

    import MetaTrader5 as mt5

    login = int(os.environ["MT5_LOGIN"])
    password = os.environ["MT5_PASSWORD"]
    server = os.environ["MT5_SERVER"]
    if not mt5.initialize(path=a.terminal, login=login, password=password, server=server, timeout=60000):
        raise SystemExit(f"MT5_INITIALIZE_FAIL {mt5.last_error()}")
    try:
        names = [x.name for x in (mt5.symbols_get() or [])]
        if a.symbol in names:
            symbol = a.symbol
        else:
            candidates = sorted([x for x in names if "XAUUSD" in x.upper()], key=lambda x: (len(x), x))
            if not candidates:
                raise RuntimeError("broker has no XAUUSD-like symbol")
            symbol = candidates[0]
        if not mt5.symbol_select(symbol, True):
            raise RuntimeError(f"symbol_select failed {symbol}: {mt5.last_error()}")

        # Ask the broker terminal directly for its source-native H4 series.
        # copy_rates_range is preferred because some terminals reject oversized
        # copy_rates_from_pos counts with "Invalid params". Both APIs return
        # broker H4 bars directly; no lower-TF aggregation/resampling is used.
        attempts = []
        utc = dt.timezone.utc
        rates = mt5.copy_rates_range(
            symbol, mt5.TIMEFRAME_H4,
            dt.datetime(2000, 1, 1, tzinfo=utc),
            dt.datetime.now(tz=utc),
        )
        attempts.append({"api":"copy_rates_range","count":0 if rates is None else int(len(rates)),"last_error":mt5.last_error()})
        if rates is None or len(rates) == 0:
            for count in (50000, 20000, 10000, 5000, 2000):
                rates = mt5.copy_rates_from_pos(symbol, mt5.TIMEFRAME_H4, 0, count)
                attempts.append({"api":"copy_rates_from_pos","requested":count,"count":0 if rates is None else int(len(rates)),"last_error":mt5.last_error()})
                if rates is not None and len(rates) > 0:
                    break
        if rates is None or len(rates) == 0:
            raise RuntimeError(f"native H4 returned no bars after bounded direct-H4 fallbacks: {attempts}")
        d = pd.DataFrame(rates)
        d["Date"] = pd.to_datetime(d["time"], unit="s", utc=True)
        vol = d["real_volume"].where(d["real_volume"] > 0, d["tick_volume"]).fillna(0)
        primary = pd.DataFrame({
            "Date": d["Date"],
            "Open": pd.to_numeric(d["open"], errors="raise"),
            "High": pd.to_numeric(d["high"], errors="raise"),
            "Low": pd.to_numeric(d["low"], errors="raise"),
            "Close": pd.to_numeric(d["close"], errors="raise"),
            "Volume": pd.to_numeric(vol, errors="raise"),
        }).drop_duplicates("Date", keep="last").sort_values("Date").reset_index(drop=True)
        o,h,l,c = (primary[x].to_numpy(float) for x in ["Open","High","Low","Close"])
        if np.any(h < l) or np.any(o < l) or np.any(o > h) or np.any(c < l) or np.any(c > h):
            raise RuntimeError("native broker H4 OHLC consistency violation")

        out = Path(a.out_dir); out.mkdir(parents=True, exist_ok=True)
        primary_path = out / "XAUUSD_MT5_NATIVE_H4_PRIMARY.csv"
        receipt_path = out / "gate_a_h4_receipt.json"
        primary.to_csv(primary_path, index=False, date_format="%Y-%m-%dT%H:%M:%SZ")

        cross = pd.read_csv(a.crosscheck)
        cross["Date"] = pd.to_datetime(cross["Date"], utc=True, errors="raise")
        cross = cross.sort_values("Date").drop_duplicates("Date", keep="last")
        left = primary[["Date","Close"]].rename(columns={"Date":"primary_date","Close":"primary_close"}).sort_values("primary_date")
        right = cross[["Date","Close"]].rename(columns={"Date":"cross_date","Close":"cross_close"}).sort_values("cross_date")

        # Broker and OANDA source-native H4 candles can have different session
        # anchors. Align only for independent identity validation; the broker
        # H4 OHLCV above remains untouched for every backtest.
        left["_date_ns"] = left["primary_date"].map(lambda z: int(pd.Timestamp(z).value)).astype("int64")
        right["_date_ns"] = right["cross_date"].map(lambda z: int(pd.Timestamp(z).value)).astype("int64")
        aligned = pd.merge_asof(
            left.sort_values("_date_ns"), right.sort_values("_date_ns"),
            on="_date_ns", direction="nearest", tolerance=int(pd.Timedelta(hours=2).value),
        ).dropna(subset=["cross_close"])
        rp = np.log(aligned["primary_close"]).diff(); rx = np.log(aligned["cross_close"]).diff()
        valid = rp.notna() & rx.notna()
        corr = float(rp[valid].corr(rx[valid])) if int(valid.sum()) >= 2 else float("nan")
        direction = float((np.sign(rp[valid]) == np.sign(rx[valid])).mean()) if valid.any() else 0.0
        med_delta = float(((aligned["primary_close"] / aligned["cross_close"] - 1.0).abs()).median()) if len(aligned) else float("inf")

        # A second identity check removes H4-session-anchor noise by comparing
        # only the last NATIVE H4 close seen on each UTC date. This aggregation
        # is validation-only and is never written to / used as H4 backtest data.
        pdaily = primary.set_index("Date")["Close"].groupby(primary["Date"].dt.floor("D").to_numpy()).last()
        xdaily = cross.set_index("Date")["Close"].groupby(cross["Date"].dt.floor("D").to_numpy()).last()
        daily = pd.concat([pdaily.rename("p"), xdaily.rename("x")], axis=1, join="inner").dropna()
        if len(daily) >= 3:
            drp = np.log(daily["p"]).diff(); drx = np.log(daily["x"]).diff()
            dv = drp.notna() & drx.notna()
            daily_corr = float(drp[dv].corr(drx[dv])) if int(dv.sum()) >= 2 else float("nan")
            daily_direction = float((np.sign(drp[dv]) == np.sign(drx[dv])).mean()) if dv.any() else 0.0
        else:
            daily_corr, daily_direction = float("nan"), 0.0

        start = primary["Date"].iloc[0]; end = primary["Date"].iloc[-1]
        criteria = {
            "primary_rows_ge_10000": len(primary) >= 10000,
            "primary_history_ge_10y": (end - start).days >= 3650,
            "primary_reaches_2026": int(end.year) >= 2026,
            "crosscheck_overlap_ge_3000": len(aligned) >= 3000,
            "h4_direction_agreement_ge_0_70": direction >= 0.70,
            "daily_validation_return_corr_ge_0_90": bool(np.isfinite(daily_corr) and daily_corr >= 0.90),
            "daily_validation_direction_ge_0_80": daily_direction >= 0.80,
            "median_abs_price_delta_le_0_08": med_delta <= 0.08,
        }
        receipt = {
            "schema":"gold10b-mt5-native-h4-gate-a-v2-session-aware",
            "provider":"TradingView",
            "crosscheck_pass":bool(all(criteria.values())),
            "approved_method":"BROKER_NATIVE_MT5_H4_PLUS_TRADINGVIEW_OANDA_H4_SESSION_AWARE_CROSSCHECK_V2",
            "symbol":"GOLD","timeframe":"H4",
            "primary_provider":"MetaTrader5 broker server",
            "primary_broker_server":server,
            "primary_symbol":symbol,
            "crosscheck_symbol":"TradingView OANDA:XAUUSD",
            "source_interval":"H4",
            "construction":"DIRECT_BROKER_NATIVE_H4_NO_RESAMPLING",
            "no_resampling_attested":True,
            "primary_rows":int(len(primary)),
            "primary_start_utc":str(start),"primary_end_utc":str(end),
            "primary_sha256":sha256(primary_path),
            "crosscheck_data_sha256":sha256(Path(a.crosscheck)),
            "overlap_rows":int(len(aligned)),
            "h4_log_return_correlation_diagnostic":corr,
            "h4_direction_agreement":direction,
            "daily_validation_rows":int(len(daily)),
            "daily_validation_log_return_correlation":daily_corr,
            "daily_validation_direction_agreement":daily_direction,
            "daily_validation_policy":"last native H4 close per UTC date for cross-check only; never used as backtest bars",
            "crosscheck_alignment_policy":"nearest source H4 timestamp within 2h; no OHLCV resampling",
            "median_absolute_price_delta_fraction":med_delta,
            "criteria":criteria,
            "broker_fetch_attempts":attempts,
            "generated_at":pd.Timestamp.now(tz="UTC").isoformat(),
        }
        receipt_path.write_text(json.dumps(receipt, indent=2, sort_keys=True)+"\n", encoding="utf-8")
        print(json.dumps(receipt, indent=2, sort_keys=True))
        return 0 if receipt["crosscheck_pass"] else 2
    finally:
        mt5.shutdown()


if __name__ == "__main__":
    raise SystemExit(main())
