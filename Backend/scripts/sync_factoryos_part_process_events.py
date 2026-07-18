#!/usr/bin/env python3
"""Import FactoryOS daily-summary events into SQL Server PartProcessEvents.

The job uses FactoryOS's per-record "id" (a UUID) as its idempotency key:
rerunning a date updates the current FactoryOS values rather than adding
duplicate rows. FactoryOS's own "event_id" field is NOT used for this because
it is only unique for Production events — Downtime and Shift Break events can
share the same "event_id", which previously caused distinct downtime events to
collapse into one row and silently drop data.

Examples (run from Backend):
    python scripts/sync_factoryos_part_process_events.py --date 2026-07-14
    python scripts/sync_factoryos_part_process_events.py --date 2026-07-14 --dry-run

Configuration is read from environment variables.  When run from this project,
Backend/.env is also loaded for convenience. Set FOS_USER and FOS_PASS for
FactoryOS credentials. SQL writes use the existing Node mssql connection by
default; use --db-writer pyodbc only when the local ODBC driver is working.
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
from datetime import date
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

import pyodbc


DEFAULT_API_BASE = "https://factoryos.smartudyog.in/api"
DEFAULT_MACHINE_ID = "b3b8627a-3b55-4af3-96ee-c3fc7f712ecd"
INSERT_SQL = """
MERGE PartProcessEvents AS target
USING (VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)) AS source (
  EventId, EventDate, ShiftName, EventType, Barcode, StartTime, EndTime,
  Duration, PartsQty, PartsQuality, OperatorName, DowntimeReason,
  DowntimeComment, AssetName, LineName, Energy
) ON target.EventId = source.EventId
WHEN MATCHED THEN UPDATE SET
  EventDate = source.EventDate, ShiftName = source.ShiftName,
  EventType = source.EventType, Barcode = source.Barcode,
  StartTime = source.StartTime, EndTime = source.EndTime,
  Duration = source.Duration, PartsQty = source.PartsQty,
  PartsQuality = source.PartsQuality, OperatorName = source.OperatorName,
  DowntimeReason = source.DowntimeReason,
  DowntimeComment = source.DowntimeComment, AssetName = source.AssetName,
  LineName = source.LineName, Energy = source.Energy, SyncedAt = GETDATE()
WHEN NOT MATCHED THEN INSERT (
  EventId, EventDate, ShiftName, EventType, Barcode, StartTime, EndTime,
  Duration, PartsQty, PartsQuality, OperatorName, DowntimeReason,
  DowntimeComment, AssetName, LineName, Energy, SyncedAt
) VALUES (
  source.EventId, source.EventDate, source.ShiftName, source.EventType,
  source.Barcode, source.StartTime, source.EndTime, source.Duration,
  source.PartsQty, source.PartsQuality, source.OperatorName,
  source.DowntimeReason, source.DowntimeComment, source.AssetName,
  source.LineName, source.Energy, GETDATE());
"""


def load_dotenv(path: Path) -> None:
    """Load simple KEY=VALUE settings without replacing already-set variables."""
    if not path.is_file():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key, value = key.strip(), value.strip().strip('"').strip("'")
        if key and key not in os.environ:
            os.environ[key] = value


def request_json(url: str, *, method: str = "GET", payload: dict | None = None,
                 token: str | None = None) -> Any:
    headers = {"Accept": "application/json"}
    data = None
    if payload is not None:
        headers["Content-Type"] = "application/json"
        data = json.dumps(payload).encode("utf-8")
    if token:
        headers["Authorization"] = f"Bearer {token}"
    request = Request(url, data=data, headers=headers, method=method)
    try:
        with urlopen(request, timeout=60) as response:
            return json.loads(response.read().decode("utf-8"))
    except HTTPError as error:
        detail = error.read().decode("utf-8", errors="replace")[:500]
        raise RuntimeError(f"FactoryOS request failed ({error.code}): {detail}") from error
    except URLError as error:
        raise RuntimeError(f"Could not reach FactoryOS: {error.reason}") from error


def get_value(record: dict, *keys: str, default: Any = None) -> Any:
    for key in keys:
        value: Any = record
        for part in key.split("."):
            if not isinstance(value, dict):
                value = None
                break
            value = value.get(part)
        if value is not None:
            return value
    return default


def text(value: Any, limit: int | None = None) -> str | None:
    if value is None or value == "":
        return None
    result = str(value).strip()
    return result[:limit] if limit else result


def number(value: Any, default: float = 0) -> float:
    try:
        return float(value) if value is not None and value != "" else default
    except (TypeError, ValueError):
        return default


def to_row(record: dict, requested_date: str) -> tuple:
    """Map FactoryOS's snake_case payload to the local PartProcessEvents schema."""
    # FactoryOS's own "event_id" is only unique for Production events; Downtime
    # and Shift Break events reuse a shared, non-unique value there (observed:
    # multiple distinct downtime periods sharing the same "D<timestamp>" id).
    # "id" is a per-record UUID that's unique across every event type, so it's
    # the only safe idempotency key.
    event_id = get_value(record, "id", "event_id")
    if event_id is None:
        raise ValueError("FactoryOS event has no id")
    event_date = text(get_value(record, "event_date", "date", default=requested_date), 10) or requested_date
    shift = get_value(record, "shift.shift_name", "shift_name")
    return (
        text(event_id, 50), event_date, text(shift, 100),
        text(get_value(record, "event_type"), 20),
        text(get_value(record, "barcode", "model_name"), 500),
        text(get_value(record, "start_time"), 10), text(get_value(record, "end_time"), 10),
        text(get_value(record, "duration"), 15), int(number(get_value(record, "parts_quantity"))),
        text(get_value(record, "parts_quality", "part_quality"), 20),
        text(get_value(record, "operator_name"), 200),
        text(get_value(record, "downtime_reason"), 500),
        text(get_value(record, "downtime_comment")), text(get_value(record, "asset_name"), 200),
        text(get_value(record, "line_name"), 200), number(get_value(record, "energy")),
    )


def fetch_events(api_base: str, machine_id: str, event_date: str, page_size: int,
                 username: str, password: str) -> list[dict]:
    auth = request_json(f"{api_base}/auth/jwt/create/", method="POST",
                        payload={"username": username, "password": password})
    token = auth.get("access") if isinstance(auth, dict) else None
    if not token:
        raise RuntimeError("FactoryOS authentication response did not include an access token")

    events: list[dict] = []
    page = 1
    while True:
        query = urlencode({"date": event_date, "page": page, "page_size": page_size})
        payload = request_json(f"{api_base}/monitoring/daily-summary/{machine_id}/?{query}", token=token)
        page_events = payload.get("results", []) if isinstance(payload, dict) else []
        if not isinstance(page_events, list):
            raise RuntimeError("FactoryOS daily-summary response has an invalid results field")
        events.extend(page_events)
        if not payload.get("next") or not page_events:
            break
        page += 1
    return events


def database_connection() -> pyodbc.Connection:
    required = ["DB_SERVER3", "DB_NAME3", "DB_USER3", "DB_PASSWORD3"]
    missing = [name for name in required if not os.getenv(name)]
    if missing:
        raise RuntimeError(f"Missing database configuration: {', '.join(missing)}")
    configured_driver = os.getenv("DB_ODBC_DRIVER")
    drivers = pyodbc.drivers()
    driver = configured_driver or next((d for d in drivers if "ODBC Driver 18" in d), None) \
        or next((d for d in drivers if "ODBC Driver 17" in d), None)
    if not driver:
        raise RuntimeError("No Microsoft SQL Server ODBC driver found; set DB_ODBC_DRIVER if needed")
    server = os.environ["DB_SERVER3"]
    if os.getenv("DB_PORT3"):
        server = f"{server},{os.environ['DB_PORT3']}"
    connection_string = (
        f"DRIVER={{{driver}}};SERVER={server};DATABASE={os.environ['DB_NAME3']};"
        f"UID={os.environ['DB_USER3']};PWD={os.environ['DB_PASSWORD3']};"
        "Encrypt=no;TrustServerCertificate=yes;Connection Timeout=15;"
    )
    return pyodbc.connect(connection_string, autocommit=False)


def write_with_node(rows: list[tuple]) -> None:
    """Write through the app's verified mssql driver, avoiding ODBC TLS failures."""
    writer = Path(__file__).with_name("write_part_process_events.mjs")
    try:
        result = subprocess.run(
            ["node", str(writer)], input=json.dumps(rows), text=True,
            capture_output=True, check=True, timeout=300,
        )
    except FileNotFoundError as error:
        raise RuntimeError("Node.js is required for the default SQL writer") from error
    except subprocess.TimeoutExpired as error:
        raise RuntimeError("SQL Server write timed out after 5 minutes") from error
    except subprocess.CalledProcessError as error:
        detail = (error.stderr or error.stdout or "Node SQL writer failed").strip()
        # An uncaught Node exception dumps the actual "Error: message" line and
        # the immediate stack frames FIRST, then trails off into a long,
        # low-signal object dump (e.g. mssql's `info`/`precedingErrors`
        # payload). Keep the head, not the tail — slicing from the end
        # previously chopped off the one line that says what went wrong.
        raise RuntimeError(detail[:1000]) from error
    try:
        response = json.loads(result.stdout.strip().splitlines()[-1])
    except (IndexError, json.JSONDecodeError) as error:
        raise RuntimeError("Node SQL writer returned an invalid response") from error
    if response.get("synced") != len(rows):
        raise RuntimeError("Node SQL writer did not confirm all events")


def main() -> int:
    project_backend = Path(__file__).resolve().parents[1]
    load_dotenv(project_backend / ".env")
    parser = argparse.ArgumentParser(description="Sync FactoryOS events into PartProcessEvents")
    parser.add_argument("--date", default=date.today().isoformat(), help="Production date (YYYY-MM-DD)")
    parser.add_argument("--machine-id", default=os.getenv("FOS_MACHINE_ID", DEFAULT_MACHINE_ID))
    parser.add_argument("--page-size", type=int, default=1000)
    parser.add_argument("--db-writer", choices=("node", "pyodbc"), default="node",
                        help="SQL Server writer (default: node, using the app mssql driver)")
    parser.add_argument("--dry-run", action="store_true", help="Fetch and validate without writing SQL Server")
    args = parser.parse_args()
    try:
        date.fromisoformat(args.date)
        if args.page_size < 1:
            raise ValueError("page-size must be positive")
        username, password = os.getenv("FOS_USER"), os.getenv("FOS_PASS")
        if not username or not password:
            raise RuntimeError("Missing FactoryOS credentials: set FOS_USER and FOS_PASS")
        api_base = os.getenv("FOS_API_BASE", DEFAULT_API_BASE).rstrip("/")
        events = fetch_events(api_base, args.machine_id, args.date, args.page_size, username, password)
        # FactoryOS can occasionally return the same event_id more than once.
        # EventId is the local primary key, so keep the last version of each event.
        rows_by_id = {row[0]: row for row in (to_row(event, args.date) for event in events)}
        rows = list(rows_by_id.values())
        duplicate_count = len(events) - len(rows)
        if args.dry_run:
            print(f"Validated {len(rows)} unique FactoryOS events for {args.date}"
                  f" ({duplicate_count} duplicate event IDs ignored); no database changes made.")
            return 0
        if not rows:
            print(f"No FactoryOS events found for {args.date}; no database changes made.")
            return 0
        if args.db_writer == "node":
            write_with_node(rows)
        else:
            with database_connection() as connection:
                cursor = connection.cursor()
                cursor.fast_executemany = True
                cursor.executemany(INSERT_SQL, rows)
                connection.commit()
        print(f"Synced {len(rows)} unique FactoryOS events for {args.date} into PartProcessEvents"
              f" ({duplicate_count} duplicate event IDs ignored).")
        return 0
    except (RuntimeError, ValueError, pyodbc.Error) as error:
        print(f"Sync failed: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
