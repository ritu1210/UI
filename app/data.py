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
