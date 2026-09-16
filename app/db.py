"""Azure SQL (SQL Server) connectivity.

Every database access in the app goes through get_connection(); table names
live in config.py so schema setup, migration, and the app all refer to the
same _dev tables.
"""
from __future__ import annotations

import pyodbc

from . import config


def get_connection() -> pyodbc.Connection:
    """Open a new connection to Azure SQL using the configured settings.

    Locally this uses interactive Azure AD login (a browser prompt opens on the
    first connection of the process).
    """
    return pyodbc.connect(config.sql_connection_string(), timeout=config.SQL_TIMEOUT)


def health_check() -> dict:
    """Return database connectivity status for the /api/health/db endpoint."""
    try:
        conn = get_connection()
        try:
            cur = conn.cursor()
            cur.execute("SELECT DB_NAME(), SUSER_SNAME();")
            db_name, login = cur.fetchone()
            cur.close()
        finally:
            conn.close()
        return {"status": "ok", "database": db_name, "login": login}
    except Exception as exc:  # reported to the caller as an unhealthy status
        return {"status": "error", "detail": str(exc)}
