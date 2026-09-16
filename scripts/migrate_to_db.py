"""One-time data migration: CSV dump files -> Azure SQL `_dev` tables.

Run AFTER scripts/setup_db.py has created the tables:

    python scripts/migrate_to_db.py

Re-runnable: it clears each table and reloads from the CSVs, then (re)adds the
foreign key that connects fte_allocations_dev.project_id -> projects_dev.
The FK is added WITH NOCHECK because the historical FTE export references some
project ids that are not in the funnel list.
"""
from __future__ import annotations

import csv
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app import config, data, db  # noqa: E402

_FK_NAME = f"FK_{config.FTE_ALLOCATIONS_TABLE}_project"


def _read_csv(path: Path) -> list[dict[str, str]]:
    with path.open(encoding="utf-8-sig", newline="") as fh:
        return list(csv.DictReader(fh))


def _project_rows() -> list[tuple]:
    cols = list(data.PROJECT_COLUMNS.keys())
    seen: set[str] = set()
    rows: list[tuple] = []
    for raw in _read_csv(config.FUNNEL_FILE):
        pid = data._clean(raw.get(data.PROJECT_COLUMNS["project_id"]))
        if not pid or pid in seen:
            continue
        seen.add(pid)
        record = []
        for col in cols:
            value = raw.get(data.PROJECT_COLUMNS[col])
            if col in data.PROJECT_NUMERIC_COLUMNS:
                record.append(data._euro(value))
            else:
                record.append(data._clean(value))
        rows.append(tuple(record))
    return rows


def _employee_rows() -> list[tuple]:
    cols = list(data.EMPLOYEE_COLUMNS.keys())
    rows: list[tuple] = []
    for raw in _read_csv(config.HEADCOUNT_FILE):
        name = data._clean(raw.get(data.EMPLOYEE_COLUMNS["name"]))
        if not name:
            continue
        rows.append(tuple(data._clean(raw.get(data.EMPLOYEE_COLUMNS[c])) for c in cols))
    return rows


def _fte_rows() -> list[tuple]:
    cols = list(data.FTE_COLUMNS.keys())
    rows: list[tuple] = []
    for raw in _read_csv(config.FTE_ALLOCATION_FILE):
        record = []
        for col in cols:
            value = raw.get(data.FTE_COLUMNS[col])
            if col == "allocation":
                record.append(data._parse_pct(value))
            else:
                record.append(data._clean(value))
        rows.append(tuple(record))
    return rows


def _load_table(cur, table: str, columns: list[str], rows: list[tuple]) -> None:
    cur.execute(f"DELETE FROM [{table}]")
    if not rows:
        print(f"  {table}: 0 rows")
        return
    col_sql = ", ".join(f"[{c}]" for c in columns)
    placeholders = ", ".join("?" for _ in columns)
    cur.fast_executemany = True
    cur.executemany(
        f"INSERT INTO [{table}] ({col_sql}) VALUES ({placeholders})", rows
    )
    print(f"  {table}: {len(rows)} rows")


def main() -> None:
    conn = db.get_connection()
    try:
        cur = conn.cursor()

        # Drop the FK first so project rows can be replaced.
        cur.execute(
            f"IF OBJECT_ID(N'{_FK_NAME}', N'F') IS NOT NULL "
            f"ALTER TABLE [{config.FTE_ALLOCATIONS_TABLE}] DROP CONSTRAINT [{_FK_NAME}]"
        )
        conn.commit()

        _load_table(cur, config.EMPLOYEES_TABLE, list(data.EMPLOYEE_COLUMNS.keys()), _employee_rows())
        _load_table(cur, config.PROJECTS_TABLE, list(data.PROJECT_COLUMNS.keys()), _project_rows())
        _load_table(cur, config.FTE_ALLOCATIONS_TABLE, list(data.FTE_COLUMNS.keys()), _fte_rows())
        conn.commit()

        # Reconnect the tables. WITH NOCHECK skips validating the dirty historical rows.
        cur.execute(
            f"ALTER TABLE [{config.FTE_ALLOCATIONS_TABLE}] WITH NOCHECK "
            f"ADD CONSTRAINT [{_FK_NAME}] FOREIGN KEY ([project_id]) "
            f"REFERENCES [{config.PROJECTS_TABLE}] ([project_id])"
        )
        conn.commit()
        print(f"  linked: {config.FTE_ALLOCATIONS_TABLE}.project_id -> {config.PROJECTS_TABLE}.project_id")
    finally:
        conn.close()
    print("Migration complete.")


if __name__ == "__main__":
    main()
