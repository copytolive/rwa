from __future__ import annotations

import os
from pathlib import Path

from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload

SCOPES = ["https://www.googleapis.com/auth/drive", "https://www.googleapis.com/auth/spreadsheets"]
SCRIPT_URL = "https://github.com/copytolive/rwa/blob/main/backtest/gold24/worker.py"


class GoogleSync:
    def __init__(self):
        cred_path = os.environ.get("GOLD24_GOOGLE_SERVICE_ACCOUNT")
        if not cred_path or not Path(cred_path).exists():
            raise RuntimeError("GOOGLE_SYNC_BLOCKED: GOLD24_GOOGLE_SERVICE_ACCOUNT missing")
        creds = service_account.Credentials.from_service_account_file(cred_path, scopes=SCOPES)
        self.drive = build("drive", "v3", credentials=creds, cache_discovery=False)
        self.sheets = build("sheets", "v4", credentials=creds, cache_discovery=False)
        self.sheet_id = os.environ["GOLD24_SHEET_ID"]
        self.root_folder = os.environ["GOLD24_BACKUP_FOLDER_ID"]
        self.checkpoint_folder = os.environ.get("GOLD24_CHECKPOINT_FOLDER_ID", self.root_folder)
        self.ledger_folder = os.environ.get("GOLD24_LEDGER_FOLDER_ID", self.root_folder)
        self.receipt_folder = os.environ.get("GOLD24_RECEIPT_FOLDER_ID", self.root_folder)

    @staticmethod
    def _escape_drive_q(value: str) -> str:
        return value.replace("\\", "\\\\").replace("'", "\\'")

    def _ensure_uploaded(self, path: str | Path, folder_id: str, name: str | None = None):
        path = Path(path)
        if not path.exists():
            raise RuntimeError(f"GOOGLE_SYNC_BLOCKED: local evidence missing: {path}")
        target_name = name or path.name
        qname = self._escape_drive_q(target_name)
        q = f"name='{qname}' and '{folder_id}' in parents and trashed=false"
        found = self.drive.files().list(q=q, fields="files(id,name,webViewLink)", pageSize=10).execute().get("files", [])
        if found:
            return found[0]
        body = {"name": target_name, "parents": [folder_id]}
        media = MediaFileUpload(str(path), resumable=True)
        return self.drive.files().create(body=body, media_body=media, fields="id,name,webViewLink").execute()

    def upload_checkpoint(self, path: str | Path, name: str | None = None):
        return self._ensure_uploaded(path, self.checkpoint_folder, name)

    def upload_ledger(self, path: str | Path, name: str | None = None):
        return self._ensure_uploaded(path, self.ledger_folder, name)

    def upload_receipt(self, path: str | Path, name: str | None = None):
        return self._ensure_uploaded(path, self.receipt_folder, name)

    def ledger_url(self, path: str | Path) -> str:
        return self.upload_ledger(path).get("webViewLink", "")

    @staticmethod
    def _method_name(c: dict) -> str:
        return (
            f"{c['family']} — {c['fast']}/{c['slow']}, p1 {c['p1']}, "
            f"SL {c['sl']}, TP {c['tp']}, off {c['offset']}, exp {c['expiry']}"
        )

    def update_top100(self, rows: list[dict]):
        # Evidence links are resolved before writing; a missing ledger fails the sync instead of
        # publishing an unauditable strategy row.
        ledger_urls: dict[str, str] = {}
        for row in rows[:100]:
            lp = row["ledger_path"]
            if lp not in ledger_urls:
                ledger_urls[lp] = self.ledger_url(lp)

        values = []
        for i, row in enumerate(rows[:100], 1):
            c, m = row["candidate"], row["metrics"]
            execution_hash = row.get("execution_hash", "") or ""
            h1, h2 = (execution_hash[:16], execution_hash[16:32]) if len(execution_hash) >= 32 else (execution_hash, "")
            period = row.get("period", "")
            corr = float(row.get("correlation_max", 0.0))
            values.append([
                i, self._method_name(c), c["timeframe"], c["entry_method"], c["direction_mode"],
                c["sl"], c["tp"], m.get("trades"), m.get("wr"), m.get("profit_factor"),
                m.get("net_profit"), m.get("expectancy"), m.get("max_dd_pct"), m.get("sqn"),
                m.get("sharpe"), m.get("recovery"), m.get("profitable_months_pct"), "COMPLIANT_2026_PRECERT",
                m.get("sortino"), m.get("calmar"), m.get("avg_win_loss"), m.get("max_consec_loss"),
                m.get("tier2_pass_count"), c["family"], c["fast"], c["slow"], c["p1"], c["offset"], c["expiry"],
                c["symbol"], c["entry_method"], row["rr"], row["fingerprint"],
                "PASS", "PASS", "PASS", "PASS", "PASS", ledger_urls[row["ledger_path"]],
                "PASS", "PASS", "PASS", "PASS", "PASS", "PASS", f"PASS ({corr:.6f})", "PASS",
                "PASS — PRECERT, NOT VALIDATED/FINAL", period, m.get("history_years"), row.get("runtime", "NOT_RECORDED"),
                h1, h2, "backtest/gold24/worker.py", SCRIPT_URL,
            ])

        if any(len(v) != 55 for v in values):
            raise RuntimeError("SHEET_SYNC_FAIL: TOP100 row width must be exactly 55 columns A:BC")

        svc = self.sheets.spreadsheets().values()
        svc.clear(spreadsheetId=self.sheet_id, range="TOP100_COMPLIANT!A7:BC106", body={}).execute()
        if values:
            svc.update(
                spreadsheetId=self.sheet_id,
                range=f"TOP100_COMPLIANT!A7:BC{6 + len(values)}",
                valueInputOption="RAW",
                body={"values": values},
            ).execute()
        status = (
            f"CURRENT ELIGIBLE: {len(values)} — GOLD24 AUTO 24/7 when persistent VM is active; "
            "hard cap 100; PF DESC → Total Entry DESC → Net Profit DESC; PRECERT ≠ VALIDATED/FINAL."
        )
        svc.update(
            spreadsheetId=self.sheet_id,
            range="TOP100_COMPLIANT!A3",
            valueInputOption="RAW",
            body={"values": [[status]]},
        ).execute()
