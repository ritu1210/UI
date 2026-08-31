"""JSON API endpoints consumed by the front-end pages."""
from __future__ import annotations

import re
from collections import defaultdict

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from . import data, store


def _pretty_manager(email: str) -> str:
    """Turn a manager email (tim.bokelman@philips.com) into a readable name."""
    if not email:
        return email
    local = email.split("@")[0]
    parts = [p for p in re.split(r"[._]", local) if p]
    return " ".join(p.capitalize() for p in parts) or email

router = APIRouter(prefix="/api", tags=["api"])


class AllocationIn(BaseModel):
    employee: str
    project_id: str
    month: str
    allocation: float


class AllocationPatch(BaseModel):
    employee: str | None = None
    project_id: str | None = None
    month: str | None = None
    allocation: float | None = None


def _serialize(alloc: store.Allocation) -> dict:
    return {
        "id": alloc.id,
        "employee": alloc.employee,
        "project_id": alloc.project_id,
        "project_title": alloc.project_title,
        "month": alloc.month,
        "allocation": alloc.allocation,
    }


@router.get("/employees")
def get_employees(q: str | None = None):
    employees = data.load_employees()
    if q:
        needle = q.lower()
        employees = [e for e in employees if needle in e.name.lower()]
    return [
        {
            "name": e.name,
            "job_title": e.job_title,
            "director": e.director,
            "reporting_manager": e.reporting_manager,
            "location": e.location,
            "country": e.country,
        }
        for e in employees
    ]


@router.get("/projects")
def get_projects(q: str | None = None, limit: int = 50):
    projects = data.load_projects()
    if q:
        needle = q.lower()
        projects = [
            p for p in projects
            if needle in p.project_id.lower() or needle in p.title.lower()
        ]
    return [
        {
            "project_id": p.project_id,
            "title": p.title,
            "bu": p.bu,
            "cluster": p.cluster,
            "project_type": p.project_type,
            "spoc": p.spoc,
        }
        for p in projects[:limit]
    ]


@router.get("/managers")
def get_managers():
    counts: dict[str, int] = {}
    for e in data.load_employees():
        if e.reporting_manager:
            key = e.reporting_manager.lower()
            counts[key] = counts.get(key, 0) + 1
    result = [
        {"value": m, "label": _pretty_manager(m), "reportees": c}
        for m, c in counts.items()
    ]
    result.sort(key=lambda r: r["label"].lower())
    return result


@router.get("/allocations")
def get_allocations(manager: str | None = None):
    allocs = store.list_all()
    if manager is not None:
        key = manager.lower()
        emp_index = data.employee_index()
        allocs = [
            a for a in allocs
            if (emp_index.get(a.employee) and emp_index[a.employee].reporting_manager.lower() == key)
        ]
    return [_serialize(a) for a in allocs]


@router.get("/reportees")
def get_reportees(manager: str):
    key = manager.lower()
    return [
        {"name": e.name, "job_title": e.job_title, "location": e.location}
        for e in data.load_employees()
        if e.reporting_manager.lower() == key
    ]


@router.post("/allocations", status_code=201)
def create_allocation(payload: AllocationIn):
    project = data.project_index().get(payload.project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Unknown project id")
    if payload.month not in store.allocatable_months():
        raise HTTPException(status_code=422, detail="Allocations are only allowed for the current or future months")
    alloc = store.create(
        employee=payload.employee,
        project_id=payload.project_id,
        project_title=project.title,
        month=payload.month,
        allocation=payload.allocation,
    )
    return _serialize(alloc)


@router.patch("/allocations/{alloc_id}")
def patch_allocation(alloc_id: int, payload: AllocationPatch):
    fields = payload.model_dump(exclude_none=True)
    if "month" in fields and fields["month"] not in store.allocatable_months():
        raise HTTPException(status_code=422, detail="Allocations are only allowed for the current or future months")
    if "project_id" in fields:
        project = data.project_index().get(fields["project_id"])
        if not project:
            raise HTTPException(status_code=404, detail="Unknown project id")
        fields["project_title"] = project.title
    alloc = store.update(alloc_id, **fields)
    if not alloc:
        raise HTTPException(status_code=404, detail="Allocation not found")
    return _serialize(alloc)


@router.delete("/allocations/{alloc_id}", status_code=204)
def delete_allocation(alloc_id: int):
    if not store.delete(alloc_id):
        raise HTTPException(status_code=404, detail="Allocation not found")


@router.get("/dashboard/user")
def dashboard_user(employee: str | None = None):
    allocations = store.list_all()
    if employee:
        allocations = [a for a in allocations if a.employee == employee]
    by_month: dict[str, float] = defaultdict(float)
    rows = []
    for a in allocations:
        by_month[a.month] += a.allocation
        rows.append(_serialize(a))
    return {
        "rows": rows,
        "by_month": [{"month": m, "total": round(t, 1)} for m, t in sorted(by_month.items())],
        "total_allocations": len(rows),
    }


@router.get("/dashboard/user-breakdown")
def dashboard_user_breakdown(
    manager: str | None = None,
    employee: str | None = None,
    month: str | None = None,
):
    proj_index = data.project_index()
    emp_index = data.employee_index()
    allocs = store.list_all()
    if manager:
        key = manager.lower()
        allocs = [
            a for a in allocs
            if emp_index.get(a.employee) and emp_index[a.employee].reporting_manager.lower() == key
        ]
    if employee:
        allocs = [a for a in allocs if a.employee == employee]
    if month:
        allocs = [a for a in allocs if a.month == month]

    def breakdown(attr: str) -> list[dict]:
        sums: dict[str, float] = defaultdict(float)
        counts: dict[str, int] = defaultdict(int)
        for a in allocs:
            project = proj_index.get(a.project_id)
            label = (getattr(project, attr) if project else "") or "Unassigned"
            sums[label] += a.allocation
            counts[label] += 1
        rows = [{"label": k, "value": round(sums[k] / counts[k], 1)} for k in sums]
        rows.sort(key=lambda r: r["value"], reverse=True)
        return rows[:12]

    return {
        "by_cluster": breakdown("cluster"),
        "by_bu": breakdown("bu"),
        "by_project_type": breakdown("project_type"),
        "by_il": breakdown("current_il"),
        "meta": {
            "allocations": len(allocs),
            "employees": len({a.employee for a in allocs}),
            "avg": round(sum(a.allocation for a in allocs) / len(allocs), 1) if allocs else 0,
        },
    }


# Utilization bands (per reportee, % of their monthly capacity that is booked).
_BENCH_MAX = 0.0       # exactly 0% booked -> on the bench
_UNDER_MAX = 79.0      # 1-79% -> under-utilized (spare capacity)
_HEALTHY_MAX = 100.0   # 80-100% -> healthy
                       # >100% -> over-allocated


def _band(util: float) -> str:
    if util <= _BENCH_MAX:
        return "bench"
    if util <= _UNDER_MAX:
        return "under"
    if util <= _HEALTHY_MAX:
        return "healthy"
    return "over"


@router.get("/dashboard/people-leader")
def dashboard_people_leader(month: str | None = None, manager: str | None = None):
    """Leadership view: team utilization, capacity coverage and bench risk.

    Utilization for a reportee = the sum of their project allocations in the
    selected month (can exceed 100% when double-booked across projects).
    When ``manager`` is supplied the view narrows to that manager's reportees.
    """
    employees = data.load_employees()
    sel_month = month if month in store.MONTHS else store.current_month()

    # Total booked % and project count per (employee, month).
    util_by_emp: dict[tuple[str, str], float] = defaultdict(float)
    projects_in_month: dict[str, int] = defaultdict(int)
    for a in store.list_all():
        util_by_emp[(a.employee, a.month)] += a.allocation
        if a.month == sel_month:
            projects_in_month[a.employee] += 1

    # Reportees grouped under their reporting manager (headcount from HC list).
    teams: dict[str, list] = defaultdict(list)
    for e in employees:
        if e.reporting_manager:
            teams[e.reporting_manager].append(e)

    bands = {"bench": 0, "under": 0, "healthy": 0, "over": 0}

    # ---- Single-team view -------------------------------------------------
    if manager:
        key = manager.lower()
        members = [e for e in employees if e.reporting_manager and e.reporting_manager.lower() == key]
        by_reportee = []
        for e in members:
            u = util_by_emp.get((e.name, sel_month), 0.0)
            bands[_band(u)] += 1
            by_reportee.append({
                "name": e.name,
                "job_title": e.job_title,
                "util": round(u, 1),
                "projects": projects_in_month.get(e.name, 0),
                "status": _band(u),
            })
        by_reportee.sort(key=lambda r: (r["util"], r["name"].lower()))
        total = len(members)
        total_util = sum(r["util"] for r in by_reportee)
        trend = [
            {
                "month": m,
                "avg_util": round(sum(util_by_emp.get((e.name, m), 0.0) for e in members) / total, 1) if total else 0.0,
            }
            for m in store.MONTHS
        ]
        return {
            "scope": "team",
            "scope_label": _pretty_manager(manager),
            "manager": manager,
            "month": sel_month,
            "months": store.MONTHS,
            "kpis": {
                "reportees": total,
                "avg_util": round(total_util / total, 1) if total else 0,
                "fully_allocated": bands["healthy"] + bands["over"],
                "over_allocated": bands["over"],
                "bench": bands["bench"],
                "sum_allocations": round(total_util),
            },
            "utilization": bands,
            "by_reportee": by_reportee,
            "by_manager": [],
            "trend": trend,
        }

    # ---- Org-wide view ----------------------------------------------------
    total_reportees = 0
    total_util = 0.0
    by_manager = []
    for mgr, members in teams.items():
        utils = [util_by_emp.get((e.name, sel_month), 0.0) for e in members]
        allocated = sum(1 for u in utils if u > 0)
        team_total = sum(utils)
        avg_util = round(team_total / len(members), 1) if members else 0.0
        for u in utils:
            bands[_band(u)] += 1
        total_reportees += len(members)
        total_util += team_total
        by_manager.append({
            "manager": _pretty_manager(mgr),
            "team_size": len(members),
            "allocated": allocated,
            "avg_util": avg_util,
            "total_util": round(team_total, 1),
            "over": sum(1 for u in utils if u > _HEALTHY_MAX),
        })

    by_manager.sort(key=lambda r: r["avg_util"], reverse=True)

    # 12-month utilization trend across every reportee (org-wide average).
    all_members = [e for members in teams.values() for e in members]
    trend = []
    for m in store.MONTHS:
        if all_members:
            avg = sum(util_by_emp.get((e.name, m), 0.0) for e in all_members) / len(all_members)
        else:
            avg = 0.0
        trend.append({"month": m, "avg_util": round(avg, 1)})

    return {
        "scope": "org",
        "scope_label": "All teams",
        "manager": None,
        "month": sel_month,
        "months": store.MONTHS,
        "kpis": {
            "leaders": len(teams),
            "reportees": total_reportees,
            "avg_util": round(total_util / total_reportees, 1) if total_reportees else 0,
            "fully_allocated": bands["healthy"] + bands["over"],
            "over_allocated": bands["over"],
            "bench": bands["bench"],
            "sum_allocations": round(total_util),
        },
        "utilization": bands,
        "by_reportee": [],
        "by_manager": by_manager,
        "trend": trend,
    }


@router.get("/dashboard/business-unit")
def dashboard_business_unit(month: str | None = None):
    """Business-unit view: allocation, headcount and project spread per BU."""
    proj_index = data.project_index()
    sel_month = month if month in store.MONTHS else None  # None => all months

    allocs = store.list_all()
    scoped = [a for a in allocs if a.month == sel_month] if sel_month else allocs

    summary: dict[str, dict] = {}
    for a in scoped:
        project = proj_index.get(a.project_id)
        bu = project.bu if project and project.bu else "Unassigned"
        bucket = summary.setdefault(bu, {"bu": bu, "employees": set(), "projects": set(), "total": 0.0, "count": 0})
        bucket["employees"].add(a.employee)
        bucket["projects"].add(a.project_id)
        bucket["total"] += a.allocation
        bucket["count"] += 1

    by_bu = []
    for bucket in summary.values():
        by_bu.append({
            "bu": bucket["bu"],
            "employees": len(bucket["employees"]),
            "projects": len(bucket["projects"]),
            "allocations": bucket["count"],
            "total_alloc": round(bucket["total"], 1),
            "avg_allocation": round(bucket["total"] / bucket["count"], 1) if bucket["count"] else 0,
        })
    by_bu.sort(key=lambda r: r["total_alloc"], reverse=True)

    # 12-month total allocation trend across all business units.
    trend_by_month: dict[str, float] = defaultdict(float)
    for a in allocs:
        trend_by_month[a.month] += a.allocation
    trend = [{"month": m, "total": round(trend_by_month.get(m, 0.0), 1)} for m in store.MONTHS]

    return {
        "month": sel_month,
        "months": store.MONTHS,
        "kpis": {
            "business_units": len(by_bu),
            "employees": len({a.employee for a in scoped}),
            "projects": len({a.project_id for a in scoped}),
            "allocations": len(scoped),
            "avg_allocation": round(sum(a.allocation for a in scoped) / len(scoped), 1) if scoped else 0,
            "total_alloc": round(sum(a.allocation for a in scoped)),
        },
        "by_bu": by_bu,
        "trend": trend,
    }
