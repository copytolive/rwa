from __future__ import annotations

import argparse
import csv
import json
import re
from pathlib import Path
from typing import Any

from bs4 import BeautifulSoup


def read_html(path: Path) -> str:
    raw = path.read_bytes()
    for enc in ("utf-16", "utf-8-sig", "utf-8", "cp1252"):
        try:
            text = raw.decode(enc)
            if "<html" in text.lower() or "<table" in text.lower():
                return text
        except UnicodeDecodeError:
            pass
    return raw.decode("utf-8", errors="replace")


def clean(s: str) -> str:
    return re.sub(r"\s+", " ", s.replace("\xa0", " ")).strip()


def tables_from_html(html: str) -> list[list[list[str]]]:
    soup = BeautifulSoup(html, "html.parser")
    tables: list[list[list[str]]] = []
    for table in soup.find_all("table"):
        rows: list[list[str]] = []
        for tr in table.find_all("tr"):
            cells = [clean(td.get_text(" ", strip=True)) for td in tr.find_all(["th", "td"])]
            if any(cells):
                rows.append(cells)
        if rows:
            tables.append(rows)
    return tables


def find_summary(tables: list[list[list[str]]]) -> dict[str, str]:
    out: dict[str, str] = {}
    for rows in tables:
        for row in rows:
            for i, cell in enumerate(row[:-1]):
                key = clean(cell).rstrip(":")
                if not key or len(key) > 80:
                    continue
                if cell.endswith(":") or key in {
                    "Initial Deposit", "Total Net Profit", "Gross Profit", "Gross Loss",
                    "Profit Factor", "Expected Payoff", "Total Trades", "Profit Trades (% of total)",
                    "Balance Drawdown Maximal", "Balance Drawdown Relative", "Equity Drawdown Maximal",
                    "Equity Drawdown Relative", "History Quality", "Bars", "Ticks", "Symbols"
                }:
                    val = clean(row[i + 1])
                    if val:
                        out.setdefault(key, val)
    return out


def header_index(row: list[str]) -> dict[str, int]:
    return {clean(v).lower(): i for i, v in enumerate(row)}


def detect_table(tables: list[list[list[str]]], required: set[str]) -> tuple[list[str], list[list[str]]] | None:
    req = {x.lower() for x in required}
    for rows in tables:
        for idx, row in enumerate(rows):
            hs = {clean(x).lower() for x in row}
            if req.issubset(hs):
                width = len(row)
                data = [r[:width] + [""] * max(0, width - len(r)) for r in rows[idx + 1:] if len(r) >= 2]
                return row, data
    return None


def write_csv(path: Path, header: list[str], rows: list[list[str]]) -> None:
    with path.open("w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(header)
        w.writerows(rows)


def num(text: str) -> float | None:
    s = clean(text).replace(" ", "")
    if not s:
        return None
    s = s.replace("%", "")
    # MT5 English report normally uses comma thousands and dot decimal.
    if "," in s and "." in s:
        s = s.replace(",", "")
    elif s.count(",") == 1 and "." not in s:
        left, right = s.split(",")
        if len(right) <= 2:
            s = left + "." + right
        else:
            s = left + right
    else:
        s = s.replace(",", "")
    m = re.search(r"[-+]?\d+(?:\.\d+)?", s)
    return float(m.group(0)) if m else None


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--report", required=True)
    ap.add_argument("--out-dir", required=True)
    args = ap.parse_args()

    report = Path(args.report)
    out = Path(args.out_dir)
    out.mkdir(parents=True, exist_ok=True)

    html = read_html(report)
    tables = tables_from_html(html)
    summary = find_summary(tables)

    deals = detect_table(tables, {"Time", "Deal", "Type", "Volume", "Price", "Profit"})
    orders = detect_table(tables, {"Time", "Order", "Type", "Volume", "Price"})

    if deals:
        write_csv(out / "mt5_deals.csv", deals[0], deals[1])
    if orders:
        write_csv(out / "mt5_orders.csv", orders[0], orders[1])

    standardized: dict[str, Any] = {
        "total_trades": num(summary.get("Total Trades", "")),
        "net_profit_usd": num(summary.get("Total Net Profit", "")),
        "gross_profit_usd": num(summary.get("Gross Profit", "")),
        "gross_loss_usd": num(summary.get("Gross Loss", "")),
        "profit_factor": num(summary.get("Profit Factor", "")),
        "expected_payoff_usd": num(summary.get("Expected Payoff", "")),
        "initial_deposit_usd": num(summary.get("Initial Deposit", "")),
        "balance_drawdown_relative_pct": num(summary.get("Balance Drawdown Relative", "")),
        "equity_drawdown_relative_pct": num(summary.get("Equity Drawdown Relative", "")),
        "history_quality_pct": num(summary.get("History Quality", "")),
    }

    win_text = summary.get("Profit Trades (% of total)", "")
    m = re.search(r"\(([-+]?\d+(?:[.,]\d+)?)%\)", win_text)
    if m:
        standardized["win_rate_pct"] = float(m.group(1).replace(",", "."))
    else:
        standardized["win_rate_pct"] = num(win_text)

    payload = {
        "status": "PASS" if report.exists() and len(tables) > 0 else "FAIL",
        "report": str(report),
        "summary_raw": summary,
        "summary": standardized,
        "table_count": len(tables),
        "deals_rows": len(deals[1]) if deals else 0,
        "orders_rows": len(orders[1]) if orders else 0,
    }
    (out / "mt5_summary.json").write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")
    (out / "mt5_report_tables.json").write_text(json.dumps(tables, indent=2, ensure_ascii=False), encoding="utf-8")
    print(json.dumps(payload, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
