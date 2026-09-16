"""One-time schema setup for Azure SQL.

Creates the three connected `_dev` tables used by the app:
    employees_dev, projects_dev, fte_allocations_dev

Safe to run more than once: each table is only created if it does not already
exist. Run once after you have database access:

    python scripts/setup_db.py

Table names come from app/config.py (TABLE_SUFFIX), so dev/prod stay in sync.
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app import config, data, db  # noqa: E402


def _col_type(table: str, col: str) -> str:
    """Pick a SQL type for a database column."""
    if table == config.PROJECTS_TABLE:
        if col in data.PROJECT_NUMERIC_COLUMNS:
            return "DECIMAL(18,2)"
        if col in ("title", "comments", "transfer_reason"):
            return "NVARCHAR(MAX)"
        if col == "project_id":
            return "NVARCHAR(100) NOT NULL"
        return "NVARCHAR(255)"
    if table == config.EMPLOYEES_TABLE:
        if col == "name":
            return "NVARCHAR(255) NOT NULL"
        if col == "email":
            return "NVARCHAR(320)"
        if col == "comments":
            return "NVARCHAR(MAX)"
        return "NVARCHAR(255)"
    # fte_allocations
    if col == "allocation":
        return "DECIMAL(9,2)"
    if col == "project_title":
        return "NVARCHAR(MAX)"
    if col == "month_year":
        return "NVARCHAR(50)"
    if col == "project_id":
        return "NVARCHAR(100)"
    return "NVARCHAR(255)"


def _create_table_sql(table: str, columns: list[str], *, identity: bool, pk: str | None) -> str:
    lines: list[str] = []
    if identity:
        lines.append("    [id] INT IDENTITY(1,1) PRIMARY KEY")
    for col in columns:
        line = f"    [{col}] {_col_type(table, col)}"
        if pk and col == pk:
            line += " PRIMARY KEY"
        lines.append(line)
    body = ",\n".join(lines)
    return (
        f"IF OBJECT_ID(N'dbo.{table}', N'U') IS NULL\n"
        f"BEGIN\n"
        f"  CREATE TABLE [dbo].[{table}] (\n{body}\n  );\n"
        f"END"
    )


def main() -> None:
    statements = [
        (
            config.EMPLOYEES_TABLE,
            _create_table_sql(
                config.EMPLOYEES_TABLE,
                list(data.EMPLOYEE_COLUMNS.keys()),
                identity=True,
                pk=None,
            ),
        ),
        (
            config.PROJECTS_TABLE,
            _create_table_sql(
                config.PROJECTS_TABLE,
                list(data.PROJECT_COLUMNS.keys()),
                identity=False,
                pk="project_id",
            ),
        ),
        (
            config.FTE_ALLOCATIONS_TABLE,
            _create_table_sql(
                config.FTE_ALLOCATIONS_TABLE,
                list(data.FTE_COLUMNS.keys()),
                identity=True,
                pk=None,
            ),
        ),
    ]

    conn = db.get_connection()
    try:
        cur = conn.cursor()
        for name, sql in statements:
            cur.execute(sql)
            conn.commit()
            print(f"  ensured table: {name}")
    finally:
        conn.close()
    print("Schema setup complete.")


if __name__ == "__main__":
    main()
