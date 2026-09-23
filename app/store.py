"""Allocation store.

Uses Azure SQL when the SQL backend is active, and keeps the original in-memory
behavior for CSV/local mode.
"""
from __future__ import annotations

import datetime
import itertools
import threading
from dataclasses import asdict, dataclass

from . import config, data, db

# Rolling list of allocation months shown in the UI.
MONTHS = [
    "Jan 2026", "Feb 2026", "Mar 2026", "Apr 2026", "May 2026", "Jun 2026",
    "Jul 2026", "Aug 2026", "Sep 2026", "Oct 2026", "Nov 2026", "Dec 2026",
]


def allocatable_months() -> list[str]:
    """Months available for new/edited allocations: current month onward only."""
    today = datetime.date.today()
    result = []
    for m in MONTHS:
        dt = datetime.datetime.strptime(m, "%b %Y").date()
        if (dt.year, dt.month) >= (today.year, today.month):
            result.append(m)
    return result


def current_month() -> str:
    """The MONTHS entry matching today, falling back to the first listed month."""
    today = datetime.date.today()
    for m in MONTHS:
        dt = datetime.datetime.strptime(m, "%b %Y").date()
        if (dt.year, dt.month) == (today.year, today.month):
            return m
    return MONTHS[0]


@dataclass
class Allocation:
    id: int
    employee: str
    project_id: str
    project_title: str
    month: str
    allocation: float  # percentage 0-100


_lock = threading.Lock()
_allocations: dict[int, Allocation] = {}
_id_counter = itertools.count(1)


def _next_id() -> int:
    return next(_id_counter)


def _use_sql() -> bool:
    return data.active_backend() == "sql"


def _clear_fte_cache() -> None:
    data.load_fte_allocations.cache_clear()


def _row_to_allocation(row) -> Allocation:
    return Allocation(
        id=int(row.id),
        employee=row.employee_name or "",
        project_id=row.project_id or "",
        project_title=row.project_title or "",
        month=row.month_year or "",
        allocation=float(row.allocation or 0),
    )


def _sql_get(alloc_id: int) -> Allocation | None:
    conn = db.get_connection()
    try:
        cur = conn.cursor()
        cur.execute(
            f"""
            SELECT [id], [employee_name], [project_id], [project_title], [month_year], [allocation]
            FROM [{config.FTE_ALLOCATIONS_TABLE}]
            WHERE [id] = ?
            """,
            alloc_id,
        )
        row = cur.fetchone()
        return _row_to_allocation(row) if row else None
    finally:
        conn.close()


def seed() -> None:
    """Populate allocations from the STET FTE Allocation export (historical data)."""
    if _use_sql():
        return
    if _allocations:
        return
    for fte in data.load_fte_allocations():
        create(
            employee=fte.employee,
            project_id=fte.project_id,
            project_title=fte.project_title,
            month=fte.month,
            allocation=fte.allocation,
        )


def create(employee: str, project_id: str, project_title: str, month: str, allocation: float) -> Allocation:
    if _use_sql():
        conn = db.get_connection()
        try:
            cur = conn.cursor()
            cur.execute(
                f"""
                INSERT INTO [{config.FTE_ALLOCATIONS_TABLE}]
                    ([employee_name], [project_id], [project_title], [month_year], [allocation])
                OUTPUT INSERTED.[id]
                VALUES (?, ?, ?, ?, ?)
                """,
                employee,
                project_id,
                project_title,
                month,
                allocation,
            )
            alloc_id = int(cur.fetchone()[0])
            conn.commit()
        finally:
            conn.close()
        _clear_fte_cache()
        return Allocation(alloc_id, employee, project_id, project_title, month, allocation)

    with _lock:
        alloc = Allocation(
            id=_next_id(),
            employee=employee,
            project_id=project_id,
            project_title=project_title,
            month=month,
            allocation=allocation,
        )
        _allocations[alloc.id] = alloc
        return alloc


def update(alloc_id: int, **fields) -> Allocation | None:
    if _use_sql():
        col_map = {
            "employee": "employee_name",
            "project_id": "project_id",
            "project_title": "project_title",
            "month": "month_year",
            "allocation": "allocation",
        }
        values = [(col_map[k], v) for k, v in fields.items() if v is not None and k in col_map]
        if values:
            set_sql = ", ".join(f"[{col}] = ?" for col, _ in values)
            params = [v for _, v in values]
            params.append(alloc_id)
            conn = db.get_connection()
            try:
                cur = conn.cursor()
                cur.execute(f"UPDATE [{config.FTE_ALLOCATIONS_TABLE}] SET {set_sql} WHERE [id] = ?", params)
                if cur.rowcount == 0:
                    conn.rollback()
                    return None
                conn.commit()
            finally:
                conn.close()
            _clear_fte_cache()
        return _sql_get(alloc_id)

    with _lock:
        alloc = _allocations.get(alloc_id)
        if not alloc:
            return None
        for key, value in fields.items():
            if value is not None and hasattr(alloc, key):
                setattr(alloc, key, value)
        return alloc


def delete(alloc_id: int) -> bool:
    if _use_sql():
        conn = db.get_connection()
        try:
            cur = conn.cursor()
            cur.execute(f"DELETE FROM [{config.FTE_ALLOCATIONS_TABLE}] WHERE [id] = ?", alloc_id)
            deleted = cur.rowcount > 0
            conn.commit()
        finally:
            conn.close()
        if deleted:
            _clear_fte_cache()
        return deleted

    with _lock:
        return _allocations.pop(alloc_id, None) is not None


def list_all() -> list[Allocation]:
    if _use_sql():
        conn = db.get_connection()
        try:
            cur = conn.cursor()
            cur.execute(
                f"""
                SELECT [id], [employee_name], [project_id], [project_title], [month_year], [allocation]
                FROM [{config.FTE_ALLOCATIONS_TABLE}]
                ORDER BY LOWER([employee_name]), [month_year], [id]
                """
            )
            return [_row_to_allocation(row) for row in cur.fetchall()]
        finally:
            conn.close()

    return sorted(_allocations.values(), key=lambda a: (a.employee.lower(), a.month))


def as_dicts() -> list[dict]:
    return [asdict(a) for a in list_all()]
