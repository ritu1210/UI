"""Load and expose reference data from the Dumpdata CSV files.

This is intentionally file-based for now. When the data moves to a database,
only this module needs to change; the routers and templates stay the same.
"""
from __future__ import annotations

import csv
from dataclasses import dataclass, field
from functools import lru_cache

from . import config


@dataclass
class Employee:
    name: str
    director: str
    job_title: str
    job_grade: str
    country: str
    location: str
    gender: str
    status: str
    start_date: str
    reporting_manager: str
    employment_type: str
    email: str


@dataclass
class Project:
    project_id: str
    director: str
    spoc: str
    program_manager: str
    title: str
    project_type: str
    commodity: str
    bu: str
    cluster: str
    current_il: str
    is_active: str = ""
    funnel_total: float = 0.0
    actual_total: float = 0.0


@dataclass
class FteAllocation:
    employee: str
    project_id: str
    project_title: str
    month: str
    allocation: float


def _clean(value: str | None) -> str:
    """Normalise a raw CSV cell (strip stray whitespace / newlines)."""
    if value is None:
        return ""
    return " ".join(value.split()).strip()


def _euro(value: str | None) -> float:
    """Parse a euro cell like '€ 314,535.00' into a float (0.0 if empty/invalid)."""
    if not value:
        return 0.0
    s = "".join(ch for ch in value if ch.isdigit() or ch in ".-")
    if s in ("", "-", ".", "-."):
        return 0.0
    try:
        return float(s)
    except ValueError:
        return 0.0


_FUNNEL_EURO_COLS = [f"{y} Funnel (Euro)" for y in range(2025, 2029)]
_ACTUAL_EURO_COLS = [f"{y} Actual (Euro)" for y in range(2025, 2029)]


@lru_cache(maxsize=1)
def load_employees() -> list[Employee]:
    employees: list[Employee] = []
    with config.HEADCOUNT_FILE.open(encoding="utf-8-sig", newline="") as fh:
        reader = csv.DictReader(fh)
        for row in reader:
            name = _clean(row.get("Employee Name (HC)"))
            if not name:
                continue
            employees.append(
                Employee(
                    name=name,
                    director=_clean(row.get("Director")),
                    job_title=_clean(row.get("Job Title (HC)")),
                    job_grade=_clean(row.get("Job Grade (HC)")),
                    country=_clean(row.get("Location Country (HC)")),
                    location=_clean(row.get("Job Location (HC)")),
                    gender=_clean(row.get("Diversity (HC)")),
                    status=_clean(row.get("Employment Status (HC)")),
                    start_date=_clean(row.get("Employee Start Date (M/D/YYYY)")),
                    reporting_manager=_clean(row.get("Reporting Manager (HC)")),
                    employment_type=_clean(row.get("Employment Type (HC)")),
                    email=_clean(row.get("Email ID")),
                )
            )
    employees.sort(key=lambda e: e.name.lower())
    return employees


@lru_cache(maxsize=1)
def load_projects() -> list[Project]:
    projects: list[Project] = []
    seen: set[str] = set()
    with config.FUNNEL_FILE.open(encoding="utf-8-sig", newline="") as fh:
        reader = csv.DictReader(fh)
        for row in reader:
            project_id = _clean(row.get("SMRS / Project ID"))
            title = _clean(row.get("STET Funnel Project Title"))
            if not project_id or project_id in seen:
                continue
            seen.add(project_id)
            projects.append(
                Project(
                    project_id=project_id,
                    director=_clean(row.get("Director")),
                    spoc=_clean(row.get("STET SPOC")),
                    program_manager=_clean(row.get("Program Manager")),
                    title=title,
                    project_type=_clean(row.get("Project Type (PRODUCTIVITY, AOS, LCM, NPI, CART PDC, TEST ENG, CONQ, IGM)")),
                    commodity=_clean(row.get("Commodity")),
                    bu=_clean(row.get("BU")),
                    cluster=_clean(row.get("Cluster")),
                    current_il=_clean(row.get("Current IL")),
                    is_active=_clean(row.get("Is Active")),
                    funnel_total=sum(_euro(row.get(c)) for c in _FUNNEL_EURO_COLS),
                    actual_total=sum(_euro(row.get(c)) for c in _ACTUAL_EURO_COLS),
                )
            )
    projects.sort(key=lambda p: p.project_id.lower())
    return projects


@lru_cache(maxsize=1)
def project_index() -> dict[str, Project]:
    return {p.project_id: p for p in load_projects()}


@lru_cache(maxsize=1)
def employee_index() -> dict[str, Employee]:
    return {e.name: e for e in load_employees()}


def business_units() -> list[str]:
    units = {p.bu for p in load_projects() if p.bu}
    return sorted(units)


def _parse_pct(value: str | None) -> float | None:
    txt = _clean(value).replace("%", "")
    if not txt:
        return None
    try:
        return float(txt)
    except ValueError:
        return None


@lru_cache(maxsize=1)
def load_fte_allocations() -> list[FteAllocation]:
    """Existing (historical) allocations from the STET FTE Allocation export."""
    allocs: list[FteAllocation] = []
    with config.FTE_ALLOCATION_FILE.open(encoding="utf-8-sig", newline="") as fh:
        reader = csv.DictReader(fh)
        for row in reader:
            employee = _clean(row.get("FTE Employee Name"))
            project_id = _clean(row.get("FTE Project ID"))
            month = _clean(row.get("MonthYearColumn"))
            pct = _parse_pct(row.get("FTE Allocation Value (5% - 100%)"))
            if not (employee and project_id and month) or pct is None:
                continue
            allocs.append(
                FteAllocation(
                    employee=employee,
                    project_id=project_id,
                    project_title=_clean(row.get("FTE Project ID:FTE Project Title (Text)")),
                    month=month,
                    allocation=pct,
                )
            )
    return allocs


def _append_csv_row(path, values: dict[str, str]) -> None:
    """Append one row to a CSV, matching its existing header order."""
    with path.open(encoding="utf-8-sig", newline="") as fh:
        fieldnames = csv.DictReader(fh).fieldnames or []

    # Ensure the file ends with a newline before appending a new record.
    needs_nl = False
    with path.open("rb") as fh:
        fh.seek(0, 2)
        if fh.tell() > 0:
            fh.seek(-1, 2)
            needs_nl = fh.read(1) not in (b"\n", b"\r")

    row = {name: "" for name in fieldnames}
    for col, val in values.items():
        if col in row:
            row[col] = _clean(val)

    with path.open("a", encoding="utf-8", newline="") as fh:
        if needs_nl:
            fh.write("\r\n")
        csv.DictWriter(fh, fieldnames=fieldnames).writerow(row)


def append_project(values: dict[str, str]) -> Project:
    """Append a funnel project and refresh the project caches."""
    _append_csv_row(config.FUNNEL_FILE, values)
    load_projects.cache_clear()
    project_index.cache_clear()
    return project_index()[values["SMRS / Project ID"]]


def funnel_row(project_id: str) -> dict[str, str] | None:
    """Return the raw CSV row (all columns) for a funnel project id."""
    with config.FUNNEL_FILE.open(encoding="utf-8-sig", newline="") as fh:
        for row in csv.DictReader(fh):
            if _clean(row.get("SMRS / Project ID")) == project_id:
                return row
    return None


def update_project(project_id: str, updates: dict[str, str]) -> Project | None:
    """Update columns of an existing funnel project (matched by id) and re-cache."""
    path = config.FUNNEL_FILE
    with path.open(encoding="utf-8-sig", newline="") as fh:
        reader = csv.DictReader(fh)
        fieldnames = reader.fieldnames or []
        rows = list(reader)

    found = False
    for r in rows:
        if _clean(r.get("SMRS / Project ID")) == project_id:
            for col, val in updates.items():
                if col in fieldnames:
                    r[col] = _clean(val)
            found = True
    if not found:
        return None

    with path.open("w", encoding="utf-8", newline="") as fh:
        writer = csv.DictWriter(fh, fieldnames=fieldnames, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows)

    load_projects.cache_clear()
    project_index.cache_clear()
    return project_index().get(project_id)


def append_employee(values: dict[str, str]) -> Employee:
    """Append a headcount employee and refresh the employee caches."""
    _append_csv_row(config.HEADCOUNT_FILE, values)
    load_employees.cache_clear()
    employee_index.cache_clear()
    return employee_index()[values["Employee Name (HC)"]]


def _employee_matches(row: dict, key: str) -> bool:
    """Match a headcount row by email (preferred, unique) or by name."""
    if "@" in key:
        return _clean(row.get("Email ID")).lower() == key.lower()
    return _clean(row.get("Employee Name (HC)")) == key


def employee_row(key: str) -> dict[str, str] | None:
    """Return the raw CSV row (all columns) for an employee (by email or name)."""
    with config.HEADCOUNT_FILE.open(encoding="utf-8-sig", newline="") as fh:
        for row in csv.DictReader(fh):
            if _employee_matches(row, key):
                return row
    return None


def update_employee(key: str, updates: dict[str, str]) -> Employee | None:
    """Update columns of an existing headcount row (matched by email or name) and re-cache."""
    path = config.HEADCOUNT_FILE
    with path.open(encoding="utf-8-sig", newline="") as fh:
        reader = csv.DictReader(fh)
        fieldnames = reader.fieldnames or []
        rows = list(reader)

    matched_name = ""
    for r in rows:
        if _employee_matches(r, key):
            for col, val in updates.items():
                if col in fieldnames:
                    r[col] = _clean(val)
            matched_name = _clean(r.get("Employee Name (HC)"))
            break
    if not matched_name:
        return None

    with path.open("w", encoding="utf-8", newline="") as fh:
        writer = csv.DictWriter(fh, fieldnames=fieldnames, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows)

    load_employees.cache_clear()
    employee_index.cache_clear()
    return employee_index().get(matched_name)
