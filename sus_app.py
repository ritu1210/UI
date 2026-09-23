
# Production: Azure App Service (env vars set in App Settings)

import os
import logging
import threading
import time
import pandas as pd
from collections import OrderedDict
from typing import Optional, List

from fastapi import FastAPI, Query, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.middleware.gzip import GZipMiddleware
from pydantic import BaseModel


# ===================== STRUCTURED LOGGING =====================
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S"
)
logger = logging.getLogger("sus042")


"""
SUS-042 RISK Material Compliance Viewer - FastAPI Backend
Connects to Azure SQL Database via Managed Identity (MSI)
"""

# ===================== INTEGRATION PATH CONFIG =====================
# BASE_DIR = directory of this file (S042_Interface/ inside RSL repo)
# RSL_ROOT = parent directory = RSL repo root (where static/sus042/ lives)
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
RSL_ROOT = os.path.dirname(BASE_DIR)

app = FastAPI(title="SUS-042 Compliance API", version="2.0.0")


# ===================== AZURE SQL CONFIG =====================
SQL_SERVER = os.getenv("AZURE_SQL_SERVER", "az26d1-rsl-sqldb-svr01.database.windows.net")
SQL_DATABASE = os.getenv("AZURE_SQL_DATABASE", "az26d1-rsl-sqldbsvr01")
SQL_DRIVER = "ODBC Driver 17 for SQL Server"


# ===================== GZIP COMPRESSION =====================
app.add_middleware(GZipMiddleware, minimum_size=500)


# ===================== SECURITY: CSP HEADER MIDDLEWARE =====================
class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; "
            "script-src 'self' 'unsafe-inline'; "
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com; "
            "font-src 'self' https://fonts.gstatic.com https://cdnjs.cloudflare.com; "
            "img-src 'self' data:; "
            "connect-src 'self';"
        )
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        return response

app.add_middleware(SecurityHeadersMiddleware)


# ===================== CORS: PRODUCTION ONLY =====================
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://az26d1-rsl-webapp01.azurewebsites.net",
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type", "Authorization"],
)


# ===================== REQUEST LOGGING MIDDLEWARE =====================
class RequestLoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        start_time = time.time()
        response = await call_next(request)
        duration = round((time.time() - start_time) * 1000, 2)
        logger.info(
            f"{request.method} {request.url.path} | "
            f"status={response.status_code} | "
            f"duration={duration}ms | "
            f"client={request.client.host if request.client else 'unknown'}"
        )
        return response

app.add_middleware(RequestLoggingMiddleware)


# ---------- Static Files & Root Route ----------
@app.get("/", include_in_schema=False)
def serve_root():
    """Redirect root to /sus042"""
    from fastapi.responses import RedirectResponse
    return RedirectResponse(url="sus042")  # relative redirect (no leading /)

@app.get("/sus042", include_in_schema=False)
def serve_sus042():
    """Serve the SUS-042 compliance viewer"""
    return FileResponse(os.path.join(RSL_ROOT, "static/sus042/index.html"))

app.mount("/static", StaticFiles(directory=os.path.join(RSL_ROOT, "static")), name="static")


# ---------- Excluded patterns (hardcoded constants — not user input, safe) ----------
EXCLUDED_PATTERNS = [
    'AOx=', 'AOx ', 'BIO=', 'BIO ', 'COL=', 'COL ', 'DIEL=', 'DIEL ',
    'FR=', 'FR ', 'HS=', 'HS ', 'INSUL=', 'INSUL ', 'ISOL=', 'ISOL ',
    'SOL=', 'SOL ', 'SUR=', 'SUR ', 'PES=', 'PES ', 'PIEZO=', 'PIEZO ',
    'PL=', 'PL ', 'WOOD=', 'WOOD ', 'Category', 'Specification', 'SUBSTANCE'
]

VALUE_OPTIONS = ["H", "L", "VR", "NA"]


# ===================== AZURE SQL CONNECTION =====================

def _get_pyodbc():
    """Lazy import pyodbc — allows app to start even if not installed."""
    import pyodbc
    return pyodbc

def get_connection():
    """Connect to Azure SQL via Managed Identity (MSI)."""
    pyodbc = _get_pyodbc()
    return pyodbc.connect(
        f"Driver={{{SQL_DRIVER}}};"
        f"Server={SQL_SERVER};"
        f"Database={SQL_DATABASE};"
        "Encrypt=yes;"
        "TrustServerCertificate=no;"
        "Authentication=ActiveDirectoryMsi;"
    )


# ===================== CONNECTION POOLING =====================
_conn_lock = threading.Lock()
_connection = None

def get_pooled_connection():
    """Reuse a single connection; reconnect if stale (no health check overhead)."""
    global _connection
    with _conn_lock:
        if _connection is not None:
            return _connection
        _connection = get_connection()
        return _connection

def _reset_connection():
    """Force reconnect on next call."""
    global _connection
    with _conn_lock:
        try:
            if _connection:
                _connection.close()
        except:
            pass
        _connection = None


# ===================== TTL CACHE =====================
_cache = {}
_CACHE_TTL = 3600  # 60 minutes (data rarely changes)

def cached_query(cache_key, query, params=None, ttl=None):
    """Run query with TTL caching. Returns cached DataFrame if not expired."""
    ttl = ttl or _CACHE_TTL
    if cache_key in _cache:
        data, timestamp = _cache[cache_key]
        if (time.time() - timestamp) < ttl:
            logger.info(f"Cache HIT: {cache_key}")
            return data
    logger.info(f"Cache MISS: {cache_key} — querying Azure SQL")
    df = run_query(query, params)
    _cache[cache_key] = (df, time.time())
    return df


_query_lock = threading.Lock()

def run_query(query: str, params: list = None) -> pd.DataFrame:
    """Execute a parameterized query using pooled connection with retry (thread-safe)."""
    def _execute(conn):
        cursor = conn.cursor()
        if params:
            cursor.execute(query, params)
        else:
            cursor.execute(query)
        columns = [desc[0] for desc in cursor.description]
        rows = cursor.fetchall()
        cursor.close()
        return pd.DataFrame.from_records([tuple(row) for row in rows], columns=columns)

    with _query_lock:
        try:
            conn = get_pooled_connection()
            return _execute(conn)
        except Exception as e:
            logger.warning(f"Query failed, resetting connection: {e}")
            _reset_connection()
            conn = get_pooled_connection()
            return _execute(conn)


# ================================================================
# FILTER ENDPOINTS (parameterized queries)
# ================================================================

# ===================== MULTI-SELECT HELPER =====================
def parse_multi_param(value: str):
    """Parse multi-select parameter. Uses ||| delimiter only."""
    if not value or value == "All":
        return None
    if "|||" in value:
        return [v.strip() for v in value.split("|||") if v.strip()]
    return [value.strip()] if value.strip() else None

def build_in_clause(column: str, values: list, params: list):
    """Build a parameterized IN clause for multiple values (pyodbc ? style)."""
    placeholders = ", ".join(["?"] * len(values))
    params.extend(values)
    return f"{column} IN ({placeholders})"


@app.get("/api/filters/subjects")
def get_subjects():
    """Get all subjects ordered by row_index"""
    logger.info("Filter request: subjects")
    query = """
    SELECT DISTINCT subject, MIN(row_index) as min_row
    FROM dbo.sus042_scs_header_new
    WHERE subject IS NOT NULL
    GROUP BY subject
    ORDER BY min_row
    """
    df = cached_query("subjects", query)
    return {"subjects": df["subject"].tolist()}


@app.get("/api/filters/categories")
def get_categories(subject: str = Query(default="All")):
    """Get categories, filtered by subject(s) if provided"""
    logger.info(f"Filter request: categories | subject={subject}")
    params = []
    where_parts = ["category IS NOT NULL"]

    subjects = parse_multi_param(subject)
    if subjects:
        where_parts.append(build_in_clause("subject", subjects, params))

    where_clause = " AND ".join(where_parts)
    query = f"""
    SELECT DISTINCT category, MIN(row_index) as min_row
    FROM dbo.sus042_scs_header_new
    WHERE {where_clause}
    GROUP BY category
    ORDER BY min_row
    """
    df = run_query(query, params if params else None)
    return {"categories": df["category"].tolist()}


@app.get("/api/filters/specifications")
def get_specifications(subject: str = Query(default="All"), category: str = Query(default="All")):
    """Get specifications filtered by subject(s) and category(ies)"""
    logger.info(f"Filter request: specifications | subject={subject} | category={category}")
    params = []
    clauses = ["specification IS NOT NULL"]

    subjects = parse_multi_param(subject)
    if subjects:
        clauses.append(build_in_clause("subject", subjects, params))

    categories = parse_multi_param(category)
    if categories:
        clauses.append(build_in_clause("category", categories, params))

    where = " AND ".join(clauses)
    query = f"""
    SELECT DISTINCT specification, MIN(row_index) as min_row
    FROM dbo.sus042_scs_header_new
    WHERE {where}
    GROUP BY specification
    ORDER BY min_row
    """
    df = run_query(query, params if params else None)
    return {"specifications": df["specification"].tolist()}


@app.get("/api/filters/sections")
def get_sections():
    """Get sections ordered by col_index, exclude Unknown, add Total Count"""
    logger.info("Filter request: sections")
    query = """
    SELECT sm.section_code, sm.section_name, MIN(sc.col_index) as min_col_index
    FROM dbo.sus042_section_master_new sm
    LEFT JOIN dbo.sus042_substance_cols_new sc
        ON sm.section_code = sc.section_code
    WHERE sm.section_code IS NOT NULL AND sm.section_code NOT IN ('Unknown', 'Total Count')
    GROUP BY sm.section_code, sm.section_name
    ORDER BY min_col_index
    """
    df = cached_query("sections", query)
    sections = df[["section_code", "section_name"]].to_dict(orient="records")
    sections.append({"section_code": "Total Count", "section_name": "Total Count"})
    return {"sections": sections}


@app.get("/api/filters/substances")
def get_substances(section: str = Query(default="All")):
    """Get substances filtered by section(s), ordered by col_index"""
    logger.info(f"Filter request: substances | section={section}")
    params = []

    sections = parse_multi_param(section)

    if not sections:
        query = """
        SELECT DISTINCT canonical_name, MIN(col_index) as min_col
        FROM dbo.sus042_substance_cols_new
        WHERE canonical_name IS NOT NULL
          AND section_code NOT IN ('Unknown', 'Total Count')
        GROUP BY canonical_name
        ORDER BY min_col
        """
    else:
        section_clause = build_in_clause("section_code", sections, params)
        query = f"""
        SELECT DISTINCT canonical_name, MIN(col_index) as min_col
        FROM dbo.sus042_substance_cols_new
        WHERE canonical_name IS NOT NULL AND {section_clause}
        GROUP BY canonical_name
        ORDER BY min_col
        """

    df = run_query(query, params if params else None)
    return {"substances": df["canonical_name"].tolist()}


@app.get("/api/filters/values")
def get_value_options():
    return {"values": VALUE_OPTIONS}

@app.get("/api/filters/regulation-categories")
def get_regulation_categories(section: str = Query(default="All")):
    """Get regulation categories from substance_cols_new, filtered by section.
    Gracefully returns empty list if _new table does not exist yet."""
    logger.info(f"Filter request: regulation-categories | section={section}")
    try:
        params = []
        sections = parse_multi_param(section)

        if sections:
            sec_clause = build_in_clause("section_code", sections, params)
            query = f"""
            SELECT regulation_category, MIN(col_index) as min_col
            FROM dbo.sus042_substance_cols_new
            WHERE regulation_category IS NOT NULL AND {sec_clause}
            GROUP BY regulation_category
            ORDER BY min_col
            """
        else:
            query = """
            SELECT regulation_category, MIN(col_index) as min_col
            FROM dbo.sus042_substance_cols_new
            WHERE regulation_category IS NOT NULL
            GROUP BY regulation_category
            ORDER BY min_col
            """

        df = run_query(query, params if params else None)
        # Exclude date-based categories (SVHC dates) from dropdown
        categories = [
            r for r in df["regulation_category"].tolist()
            if not (len(r) == 10 and r[4] == '-' and r[7] == '-')
        ]
        return {"regulation_categories": categories}
    except Exception as e:
        logger.warning(f"regulation-categories endpoint failed (table may not exist): {e}")
        return {"regulation_categories": []}


@app.get("/api/filters/svhc-dates")
def get_svhc_dates():
    """Get SVHC candidate list date-based regulation categories, sorted newest first."""
    logger.info("Filter request: svhc-dates")
    try:
        query = """
        SELECT DISTINCT regulation_category
        FROM dbo.sus042_substance_cols_new
        WHERE section_code = 'SVHC/ candidate list'
          AND regulation_category IS NOT NULL
          AND LEN(regulation_category) = 10
          AND SUBSTRING(regulation_category, 5, 1) = '-'
          AND SUBSTRING(regulation_category, 8, 1) = '-'
        ORDER BY regulation_category DESC
        """
        df = run_query(query)
        return {"dates": df["regulation_category"].tolist()}
    except Exception as e:
        logger.warning(f"svhc-dates endpoint failed (table may not exist): {e}")
        return {"dates": []}






# ================================================================
# POST FILTER ENDPOINTS (avoid URL length limits with many selections)
# ================================================================

class FilterRequest(BaseModel):
    subject: str = "All"
    category: str = "All"
    section: str = "All"


@app.post("/api/filters/categories")
def post_categories(req: FilterRequest):
    """POST version — avoids URL length limits"""
    return get_categories(subject=req.subject)


@app.post("/api/filters/specifications")
def post_specifications(req: FilterRequest):
    """POST version — avoids URL length limits"""
    return get_specifications(subject=req.subject, category=req.category)


@app.post("/api/filters/substances")
def post_substances(req: FilterRequest):
    """POST version — avoids URL length limits"""
    return get_substances(section=req.section)




# ================================================================
# SUBSTANCE COUNT ENDPOINT
# ================================================================

@app.get("/api/substance-count")
def get_substance_count(section: str = Query(default="All")):
    """Get total substance count (excludes Unknown section)"""
    logger.info(f"Substance count request | section={section}")
    params = []
    sections_list = parse_multi_param(section)

    real_sections = [s for s in (sections_list or []) if s != "Total Count"] if sections_list else None

    if real_sections:
        sec_clause = build_in_clause("section_code", real_sections, params)
        query = f"""
        SELECT COUNT(*) as total
        FROM dbo.sus042_substance_cols_new
        WHERE {sec_clause}
            AND section_code NOT IN ('Unknown', 'Total Count')
            AND canonical_name IS NOT NULL
        """
    else:
        query = """
        SELECT COUNT(*) as total
        FROM dbo.sus042_substance_cols_new
        WHERE section_code NOT IN ('Unknown', 'Total Count')
            AND canonical_name IS NOT NULL
        """

    df = run_query(query, params if params else None)
    total = int(df["total"].iloc[0]) if not df.empty else 0
    # Parse section label for display
    if section and section != "All":
        parts = [s.strip() for s in section.split("|||") if s.strip()]
        real_parts = [p for p in parts if p != "Total Count"]
        if len(real_parts) == 0:
            section_label = "Total Count"
        elif len(real_parts) == 1:
            section_label = real_parts[0]
        else:
            section_label = f"{len(real_parts)} sections selected"
    else:
        section_label = "All Sections"
    return {"total": total, "section_label": section_label}


# ================================================================
# MAIN DATA QUERY ENDPOINT (POST to avoid URL length limits)
# ================================================================

class DataRequest(BaseModel):
    subject: str = "All"
    category: str = "All"
    specification: str = "All"
    section: str = "All"
    regulation_category: str = "All"
    svhc_dates: str = "All"
    substance: str = "All"
    values: Optional[str] = None


@app.post("/api/data")
def get_compliance_data(req: DataRequest):
    """
    Main data query — POST to avoid URL length limits with many substance selections.
    Loads full dataset into memory, filters in Python.
    """
    subject = req.subject
    category = req.category
    specification = req.specification
    section = req.section
    substance = req.substance
    values = req.values

    logger.info(
        f"Data request | subject={subject} | category={category} | "
        f"specification={specification} | section={section} | "
        f"substance={substance[:80] if substance else 'All'}... | values={values}"
    )

    # --- Pre-load FULL dataset into memory (cached 60 min) ---
    full_query = """
    SELECT s.subject, s.category, s.specification, s.row_index,
        rv.section_code, sm.section_name,
        COALESCE(sc.canonical_name, CONCAT('Col_', CAST(rv.col_index AS VARCHAR(20)))) as substance,
        rv.cell_value, cc.comment_text, rv.col_index
    FROM dbo.sus042_scs_header_new s
    INNER JOIN dbo.sus042_raw_values_new rv
        ON rv.row_index = s.row_index
    LEFT JOIN dbo.sus042_substance_cols_new sc
        ON sc.col_index = rv.col_index
    LEFT JOIN dbo.sus042_section_master_new sm
        ON sm.section_code = rv.section_code
    LEFT JOIN dbo.sus042_cell_comments_new cc
        ON cc.row_index = s.row_index AND cc.data_col = rv.col_index
    """
    df = cached_query("full_dataset", full_query)

    if df.empty:
        return {"records": 0, "rows": [], "section_groups": [], "metrics": {}}

    # --- Filter in Python (instant - no DB round-trip) ---
    subjects_list = parse_multi_param(subject)
    categories_list = parse_multi_param(category)
    specifications_list = parse_multi_param(specification)
    sections_list = parse_multi_param(section)
    substances_list = parse_multi_param(substance)
    reg_categories_list = parse_multi_param(req.regulation_category)
    svhc_dates_list = parse_multi_param(req.svhc_dates)

    filtered = df

    if subjects_list:
        filtered = filtered[filtered["subject"].isin(subjects_list)]
    if categories_list:
        filtered = filtered[filtered["category"].isin(categories_list)]
    if specifications_list:
        filtered = filtered[filtered["specification"].isin(specifications_list)]

    # Section filtering — Total Count is a real section; Unknown is metadata only
    if sections_list:
        filtered = filtered[filtered["section_code"].isin(sections_list)]
    else:
        # "All" — show all real sections + Total Count, exclude Unknown (metadata)
        filtered = filtered[filtered["section_code"] != "Unknown"]

    if substances_list:
        filtered = filtered[filtered["substance"].isin(substances_list)]

    # Filter by regulation_category OR svhc_dates (combined — both target col_index via regulation_category)
    combined_reg_list = []
    if reg_categories_list:
        combined_reg_list.extend(reg_categories_list)
    if svhc_dates_list:
        combined_reg_list.extend(svhc_dates_list)

    if combined_reg_list:
        try:
            reg_placeholders = ",".join(["?"] * len(combined_reg_list))
            reg_cols_query = f"SELECT col_index FROM dbo.sus042_substance_cols_new WHERE regulation_category IN ({reg_placeholders})"
            reg_cols_df = run_query(reg_cols_query, combined_reg_list)
            if not reg_cols_df.empty:
                valid_cols = set(reg_cols_df["col_index"].tolist())
                filtered = filtered[filtered["col_index"].isin(valid_cols)]
        except Exception as e:
            logger.warning(f"regulation_category/svhc_dates filter skipped: {e}")

    if values:
        value_list_parsed = [v.strip() for v in values.split(",") if v.strip()]
        if value_list_parsed:
            filtered = filtered[filtered["cell_value"].isin(value_list_parsed)]

    # Rename for rest of function
    df = filtered.copy()





    # --- Get header tooltips (cached - static data) ---
    header_df = cached_query("header_tooltips", """
        SELECT section_code, canonical_name, header_concat, col_index
        FROM dbo.sus042_substance_cols_new
        WHERE canonical_name IS NOT NULL
        ORDER BY col_index
    """)

    # --- Get metadata comments (cached - static data) ---
    metadata_df = cached_query("metadata_comments", """
        SELECT s.row_index, s.subject, s.category, s.specification,
               cc.data_col, cc.comment_text
        FROM dbo.sus042_scs_header_new s
        INNER JOIN dbo.sus042_cell_comments_new cc
            ON cc.row_index = s.row_index AND cc.data_col IN (1, 3, 5)
        WHERE cc.comment_text IS NOT NULL
    """)

    # --- Build regulation category map (col_index -> regulation_category) ---
    regulation_category_map = {}
    try:
        reg_cat_df = cached_query("reg_category_map", """
            SELECT col_index, regulation_category
            FROM dbo.sus042_substance_cols_new
            WHERE regulation_category IS NOT NULL
        """)
        for _, row in reg_cat_df.iterrows():
            regulation_category_map[int(row["col_index"])] = str(row["regulation_category"])
    except Exception:
        pass  # _new table may not exist yet

    # --- Build header tooltip map ---
    header_tooltip_map = {}
    for _, row in header_df.iterrows():
        key = f"{row['section_code']}||{row['canonical_name']}"
        if pd.notna(row["header_concat"]):
            header_tooltip_map[key] = str(row["header_concat"])

    # --- Build metadata comment map ---
    meta_comment_map = {}
    col_to_field = {1: "subject", 3: "category", 5: "specification"}
    for _, row in metadata_df.iterrows():
        field = col_to_field.get(row["data_col"])
        if field and pd.notna(row["comment_text"]):
            key = f"{row['subject']}||{row['category']}||{row['specification']}||{field}"
            meta_comment_map[key] = str(row["comment_text"])

    # --- Build cell comment map ---
    cell_comment_map = {}
    for _, row in df.iterrows():
        if pd.notna(row.get("comment_text")):
            key = f"{row['subject']}||{row['category']}||{row['specification']}||{row['section_name']}||{row['substance']}"
            cell_comment_map[key] = str(row["comment_text"])

    # --- Get substance header comments (cached - static data) ---
    substance_header_comments_df = cached_query("substance_header_comments", """
        SELECT data_col, comment_text
        FROM dbo.sus042_cell_comments_new
        WHERE row_index < 11
            AND comment_text IS NOT NULL
    """)
    substance_comment_map = {}
    for _, row in substance_header_comments_df.iterrows():
        col_idx = int(row["data_col"])
        substance_comment_map[col_idx] = str(row["comment_text"])

    # --- Pivot to wide format ---
    pivot = df.pivot_table(
        index=["row_index", "subject", "category", "specification"],
        columns=["section_name", "substance", "col_index"],
        values="cell_value",
        aggfunc="first"
    )

    # --- Build section_groups (regular first, Total Count last) ---
    section_groups = OrderedDict()
    total_count_substances = []
    for col in sorted(pivot.columns, key=lambda x: x[2] if len(x) == 3 else 0):
        if isinstance(col, tuple) and len(col) == 3:
            section_name, sub_name, col_idx = col
            if section_name == "Total Count":
                total_count_substances.append({"substance": sub_name, "col_index": col_idx})
            else:
                if section_name not in section_groups:
                    section_groups[section_name] = []
                section_groups[section_name].append({"substance": sub_name, "col_index": col_idx})
    if total_count_substances:
        section_groups["Total Count"] = total_count_substances

    # Build section_groups JSON structure with section_code lookup
    section_code_map = {}
    for _, row in df.iterrows():
        if row["section_name"] not in section_code_map:
            section_code_map[row["section_name"]] = row["section_code"]

    sections_output = []
    for sname, substances in section_groups.items():
        scode = "Unknown" if sname == "Total Count" else section_code_map.get(sname, "")
        sections_output.append({
            "section_name": sname,
            "section_code": scode,
            "substances": substances
        })

    pivot = pivot.reset_index().sort_values("row_index").reset_index(drop=True)

    # --- Build rows ---
    rows = []
    for idx in range(len(pivot)):
        subj = str(pivot.iloc[idx, 1]) if pd.notna(pivot.iloc[idx, 1]) else ""
        cat = str(pivot.iloc[idx, 2]) if pd.notna(pivot.iloc[idx, 2]) else ""
        spec = str(pivot.iloc[idx, 3]) if pd.notna(pivot.iloc[idx, 3]) else ""

        row_data = {
            "subject": subj,
            "subject_comment": meta_comment_map.get(f"{subj}||{cat}||{spec}||subject", ""),
            "category": cat,
            "category_comment": meta_comment_map.get(f"{subj}||{cat}||{spec}||category", ""),
            "specification": spec,
            "specification_comment": meta_comment_map.get(f"{subj}||{cat}||{spec}||specification", ""),
            "cells": {}
        }

        for sg in sections_output:
            sname = sg["section_name"]
            for sub_info in sg["substances"]:
                sub_name = sub_info["substance"]
                col_idx = sub_info["col_index"]
                col_key = (sname, sub_name, col_idx)
                try:
                    val = pivot[col_key].iloc[idx]
                    cell_value = str(val) if pd.notna(val) else ""
                except:
                    cell_value = ""
                comment_key = f"{subj}||{cat}||{spec}||{sname}||{sub_name}"
                cell_comment = cell_comment_map.get(comment_key, "")
                cell_key = f"{sname}||{sub_name}||{col_idx}"
                row_data["cells"][cell_key] = {
                    "value": cell_value,
                    "comment": cell_comment
                }
        rows.append(row_data)

    # --- Metrics ---
    unique_subjects = df["subject"].nunique()
    unique_categories = df["category"].nunique()
    unique_specs = df["specification"].nunique()
    real_substances_df = df[~df["section_code"].isin(["Unknown", "Total Count"])] if "section_code" in df.columns else df
    unique_substances = real_substances_df["col_index"].nunique()
    unique_combos = df[["subject", "category", "specification"]].drop_duplicates()

    logger.info(f"Data response | records={len(df)} | rows={len(rows)} | sections={len(sections_output)}")

    return {
        "records": len(df),
        "metrics": {
            "subjects": int(unique_subjects),
            "categories": int(unique_categories),
            "specifications": int(unique_specs),
            "total_substances": int(unique_substances),
            "unique_combinations": len(unique_combos)
        },
        "section_groups": sections_output,
        "header_tooltips": header_tooltip_map,
        "substance_comments": substance_comment_map,
        "regulation_categories": regulation_category_map,
        "rows": rows
    }


# ================================================================
# INITIAL LOAD ENDPOINT (all filters in one call)
# ================================================================


def _get_init_reg_categories():
    """Get non-date regulation categories for initial load."""
    try:
        query = """
        SELECT regulation_category, MIN(col_index) as min_col
        FROM dbo.sus042_substance_cols_new
        WHERE regulation_category IS NOT NULL
        GROUP BY regulation_category
        ORDER BY min_col
        """
        df = run_query(query)
        # Exclude date-based categories (shown in SVHC dates panel instead)
        return [
            r for r in df["regulation_category"].tolist()
            if not (len(str(r)) == 10 and str(r)[4] == '-' and str(r)[7] == '-')
        ]
    except Exception:
        return []


@app.get("/api/init")
def get_initial_filters():
    """
    Single endpoint to load ALL filter data at once.
    All results are cached for 10 minutes.
    """
    logger.info("Init request: loading all filters")

    subjects_query = """
    SELECT DISTINCT subject, MIN(row_index) as min_row
    FROM dbo.sus042_scs_header_new
    WHERE subject IS NOT NULL
    GROUP BY subject
    ORDER BY min_row
    """
    subjects_df = cached_query("subjects", subjects_query)

    sections_query = """
    SELECT sm.section_code, sm.section_name, MIN(sc.col_index) as min_col_index
    FROM dbo.sus042_section_master_new sm
    LEFT JOIN dbo.sus042_substance_cols_new sc
        ON sm.section_code = sc.section_code
    WHERE sm.section_code IS NOT NULL AND sm.section_code NOT IN ('Unknown', 'Total Count')
    GROUP BY sm.section_code, sm.section_name
    ORDER BY min_col_index
    """
    sections_df = cached_query("sections", sections_query)

    categories_query = """
    SELECT DISTINCT category, MIN(row_index) as min_row
    FROM dbo.sus042_scs_header_new
    WHERE category IS NOT NULL
    GROUP BY category
    ORDER BY min_row
    """
    categories_df = cached_query("categories_all", categories_query)

    specifications_query = """
    SELECT DISTINCT specification, MIN(row_index) as min_row
    FROM dbo.sus042_scs_header_new
    WHERE specification IS NOT NULL
    GROUP BY specification
    ORDER BY min_row
    """
    specifications_df = cached_query("specifications_all", specifications_query)

    substances_query = """
    SELECT DISTINCT canonical_name, MIN(col_index) as min_col
    FROM dbo.sus042_substance_cols_new
    WHERE canonical_name IS NOT NULL
      AND section_code NOT IN ('Unknown', 'Total Count')
    GROUP BY canonical_name
    ORDER BY min_col
    """
    substances_df = cached_query("substances_all", substances_query)

    sections_list = sections_df[["section_code", "section_name"]].to_dict(orient="records")
    sections_list.append({"section_code": "Total Count", "section_name": "Total Count"})

    logger.info("Init response: all filters loaded")
    return {
        "subjects": subjects_df["subject"].tolist(),
        "categories": categories_df["category"].tolist(),
        "specifications": specifications_df["specification"].tolist(),
        "sections": sections_list,
        "substances": substances_df["canonical_name"].tolist(),
        "regulation_categories": _get_init_reg_categories(),
        "values": VALUE_OPTIONS
    }


# ================================================================
# AZURE SQL CONNECTIVITY TEST
# ================================================================




# ================================================================
# HEALTH CHECK
# ================================================================



@app.get("/api/cache/clear")
def clear_cache():
    """Clear all cached data — use after DB updates."""
    _cache.clear()
    logger.info("Cache cleared manually")
    return {"status": "ok", "message": "All caches cleared"}

# ===================== PRE-WARM CACHE ON STARTUP =====================
@app.on_event("startup")
def startup_prewarm():
    """Pre-load full dataset into cache using a SEPARATE connection (thread-safe)."""
    import threading
    def _warm():
        try:
            logger.info("Pre-warming cache: loading full dataset...")
            # Use a DEDICATED connection for prewarm (avoids conflict with request threads)
            pyodbc = _get_pyodbc()
            warm_conn = pyodbc.connect(
                f"Driver={{{SQL_DRIVER}}};"
                f"Server={SQL_SERVER};"
                f"Database={SQL_DATABASE};"
                "Encrypt=yes;"
                "TrustServerCertificate=no;"
                "Authentication=ActiveDirectoryMsi;"
            )

            def _warm_query(cache_key, query):
                """Run query on dedicated warm connection, store in cache."""
                cursor = warm_conn.cursor()
                cursor.execute(query)
                columns = [desc[0] for desc in cursor.description]
                rows = cursor.fetchall()
                cursor.close()
                df = pd.DataFrame.from_records([tuple(row) for row in rows], columns=columns)
                _cache[cache_key] = (df, time.time())
                logger.info(f"Pre-warm cached: {cache_key} ({len(df)} rows)")
                return df

            _warm_query("subjects", """
                SELECT DISTINCT subject, MIN(row_index) as min_row
                FROM dbo.sus042_scs_header_new
                WHERE subject IS NOT NULL
                GROUP BY subject ORDER BY min_row
            """)
            _warm_query("sections", """
                SELECT sm.section_code, sm.section_name, MIN(sc.col_index) as min_col_index
                FROM dbo.sus042_section_master_new sm
                LEFT JOIN dbo.sus042_substance_cols_new sc ON sm.section_code = sc.section_code
                WHERE sm.section_code IS NOT NULL AND sm.section_code NOT IN ('Unknown', 'Total Count')
                GROUP BY sm.section_code, sm.section_name ORDER BY min_col_index
            """)
            _warm_query("full_dataset", """
                SELECT s.subject, s.category, s.specification, s.row_index,
                    rv.section_code, sm.section_name,
                    COALESCE(sc.canonical_name, CONCAT('Col_', CAST(rv.col_index AS VARCHAR(20)))) as substance,
                    rv.cell_value, cc.comment_text, rv.col_index
                FROM dbo.sus042_scs_header_new s
                INNER JOIN dbo.sus042_raw_values_new rv ON rv.row_index = s.row_index
                LEFT JOIN dbo.sus042_substance_cols_new sc ON sc.col_index = rv.col_index
                LEFT JOIN dbo.sus042_section_master_new sm ON sm.section_code = rv.section_code
                LEFT JOIN dbo.sus042_cell_comments_new cc
                    ON cc.row_index = s.row_index AND cc.data_col = rv.col_index
            """)
            _warm_query("header_tooltips", """
                SELECT section_code, canonical_name, header_concat, col_index
                FROM dbo.sus042_substance_cols_new
                WHERE canonical_name IS NOT NULL ORDER BY col_index
            """)
            _warm_query("metadata_comments", """
                SELECT s.row_index, s.subject, s.category, s.specification,
                       cc.data_col, cc.comment_text
                FROM dbo.sus042_scs_header_new s
                INNER JOIN dbo.sus042_cell_comments_new cc
                    ON cc.row_index = s.row_index AND cc.data_col IN (1, 3, 5)
                WHERE cc.comment_text IS NOT NULL
            """)
            _warm_query("substance_header_comments", """
                SELECT data_col, comment_text
                FROM dbo.sus042_cell_comments_new
                WHERE row_index < 11 AND comment_text IS NOT NULL
            """)
            warm_conn.close()
            logger.info("Pre-warm complete: all data cached, dedicated connection closed")
        except Exception as e:
            logger.warning(f"Pre-warm failed (will load on first request): {e}")
    threading.Thread(target=_warm, daemon=True).start()

@app.get("/api/health")
def health():
    try:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT 1")
        cursor.close()
        conn.close()
        logger.info("Health check: OK")
        return {"status": "ok", "database": "Azure SQL connected"}
    except Exception:
        logger.exception("Health check failed")
        return {"status": "error", "message": "Database connection unavailable"}