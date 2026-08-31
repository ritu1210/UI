"""Systeur — FastAPI application entry point.

Serves the STET SYSTEUR web UI (welcome, project allocation, and dashboards)
and the JSON API used by those pages.
"""
from __future__ import annotations

import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

from . import config, data, store
from .routers import router as api_router

# Regenerated on each process start (uvicorn --reload restarts on file change),
# so browsers re-fetch static assets after an edit instead of using a stale copy.
ASSET_VERSION = str(int(time.time()))


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Warm the CSV caches and seed sample allocations at startup.
    data.load_employees()
    data.load_projects()
    store.seed()
    yield


app = FastAPI(title="Systeur", lifespan=lifespan)

# Allow the React frontend (separate service) to call the JSON API in development.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/static", StaticFiles(directory=config.STATIC_DIR), name="static")
app.include_router(api_router)

templates = Jinja2Templates(directory=str(config.TEMPLATES_DIR))


def _base_context(request: Request, active: str) -> dict:
    initials = "".join(part[0] for part in config.CURRENT_USER.split()[:2]).upper()
    return {
        "request": request,
        "active": active,
        "app_name": config.APP_NAME,
        "tagline": config.APP_TAGLINE,
        "current_user": config.CURRENT_USER,
        "user_initials": initials,
        "asset_v": ASSET_VERSION,
    }


@app.get("/login", response_class=HTMLResponse)
def login(request: Request):
    return templates.TemplateResponse(
        "login.html",
        {"request": request, "app_name": config.APP_NAME, "tagline": config.APP_TAGLINE, "asset_v": ASSET_VERSION},
    )


@app.get("/", response_class=HTMLResponse)
def welcome(request: Request):
    return templates.TemplateResponse("index.html", _base_context(request, "home"))


@app.get("/allocation", response_class=HTMLResponse)
def allocation(request: Request):
    ctx = _base_context(request, "allocation")
    ctx["employees"] = data.load_employees()
    ctx["months"] = store.MONTHS
    ctx["allocatable_months"] = store.allocatable_months()
    return templates.TemplateResponse("project_allocation.html", ctx)


@app.get("/dashboard/user", response_class=HTMLResponse)
def dashboard_user(request: Request):
    ctx = _base_context(request, "dash_user")
    ctx["employees"] = data.load_employees()
    ctx["months"] = store.MONTHS
    return templates.TemplateResponse("dashboard_user.html", ctx)


@app.get("/dashboard/people-leader", response_class=HTMLResponse)
def dashboard_people_leader(request: Request):
    return templates.TemplateResponse(
        "dashboard_people_leader.html", _base_context(request, "dash_leader")
    )


@app.get("/dashboard/business-unit", response_class=HTMLResponse)
def dashboard_business_unit(request: Request):
    return templates.TemplateResponse(
        "dashboard_business_unit.html", _base_context(request, "dash_bu")
    )
