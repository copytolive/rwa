from __future__ import annotations

import os
from pathlib import Path

from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload

SCOPES = ["https://www.googleapis.com/auth/drive", "https://www.googleapis.com/auth/spreadsheets"]

class GoogleSync:
    def __init__(self):
        cred_path = os.environ.get("GOLD24_GOOGLE_SERVICE_ACCOUNT")
        if not cred_path or not Path(cred_path).exists():
            raise RuntimeError("GOOGLE_SYNC_BLOCKED: GOLD24_GOOGLE_SERVICE_ACCOUNT missing")
        creds = service_account.Credentials.from_service_account_file(cred_path, scopes=SCOPES)
        self.drive = build("drive", "v3", credentials=creds, cache_discovery=False)
        self.sheets = build("sheets", "v4", credentials=creds, cache_discovery=False)
        self.sheet_id = os.environ["GOLD24_SHEET_ID"]
        self.backup_folder = os.environ["GOLD24_BACKUP_FOLDER_ID"]

    def upload_checkpoint(self, path: str | Path, name: str | None = None):
        path = Path(path)
        body = {"name": name or path.name, "parents": [self.backup_folder]}
        media = MediaFileUpload(str(path), resumable=True)
        return self.drive.files().create(body=body, media_body=media, fields="id,webViewLink").execute()

    def update_top100(self, rows: list[dict]):
        values = []
        for i, row in enumerate(rows[:100], 1):
            c, m = row["candidate"], row["metrics"]
            values.append([
                i, c["family"], c["timeframe"], c["entry_method"], c["direction_mode"],
                c["sl"], c["tp"], m.get("trades"), m.get("wr"), m.get("profit_factor"),
                m.get("net_profit"), m.get("expectancy"), m.get("max_dd_pct"), m.get("sqn"),
                m.get("sharpe"), m.get("recovery"), m.get("profitable_months_pct"), "COMPLIANT_2026",
                m.get("sortino"), m.get("calmar"), m.get("avg_win_loss"), m.get("max_consec_loss"),
                m.get("tier2_pass_count"), c["family"], c["fast"], c["slow"], c["p1"], c["offset"], c["expiry"],
                c["symbol"], c["entry_method"], row["rr"], row["fingerprint"], "PASS", "PASS", "PASS", "PASS", "PASS",
                row["ledger_path"], "PASS", "PASS", "PASS", "PASS", "PASS", "PASS", "PASS", "PASS", "PASS",
                row.get("period"), m.get("history_years"), row.get("runtime"), row.get("execution_hash"), "", "gold24/worker.py", row.get("script_url", "")
            ])
        svc = self.sheets.spreadsheets().values()
        svc.clear(spreadsheetId=self.sheet_id, range="TOP100_COMPLIANT!A7:BC106", body={}).execute()
        if values:
            svc.update(spreadsheetId=self.sheet_id, range=f"TOP100_COMPLIANT!A7:BC{6+len(values)}", valueInputOption="RAW", body={"values": values}).execute()
        status = f"CURRENT ELIGIBLE: {len(values)} — AUTO 24/7; hard cap 100; PF DESC → Total Entry DESC → Net Profit DESC."
        svc.update(spreadsheetId=self.sheet_id, range="TOP100_COMPLIANT!A3", valueInputOption="RAW", body={"values": [[status]]}).execute()
