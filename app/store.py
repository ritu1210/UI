"""In-memory allocation store.

Holds employee-to-project monthly allocations. This is a temporary stand-in for a
database: data lives only for the lifetime of the process. Replace the internals
with real persistence later without changing the public functions.
"""
from __future__ import annotations

import datetime
import itertools
import threading
from dataclasses import asdict, dataclass

from . import data

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


def seed() -> None:
    """Populate allocations from the STET FTE Allocation export (historical data)."""
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
    with _lock:
        alloc = _allocations.get(alloc_id)
        if not alloc:
            return None
        for key, value in fields.items():
            if value is not None and hasattr(alloc, key):
                setattr(alloc, key, value)
        return alloc


def delete(alloc_id: int) -> bool:
    with _lock:
        return _allocations.pop(alloc_id, None) is not None


def list_all() -> list[Allocation]:
    return sorted(_allocations.values(), key=lambda a: (a.employee.lower(), a.month))


def as_dicts() -> list[dict]:
    return [asdict(a) for a in list_all()]
