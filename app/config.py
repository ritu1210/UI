"""Application configuration and shared paths."""
import os
from pathlib import Path

try:  # optional: load a local .env file if python-dotenv is installed
    from dotenv import load_dotenv

    load_dotenv(Path(__file__).resolve().parent.parent / ".env")
except ImportError:
    pass

BASE_DIR = Path(__file__).resolve().parent.parent

DATA_DIR = BASE_DIR / "Dumpdata"
TEMPLATES_DIR = BASE_DIR / "templates"
STATIC_DIR = BASE_DIR / "static"

# Original CSV exports — now only used as the seed source for the one-time
# migration into Azure SQL (see scripts/migrate_to_db.py).
HEADCOUNT_FILE = DATA_DIR / "STET Headcount (3).csv"
FUNNEL_FILE = DATA_DIR / "Funnel Management List (1).csv"
FTE_ALLOCATION_FILE = DATA_DIR / "STET FTE Allocation (22).csv"

# Resource-allocation dashboard source (FTE export workbook).
RESOURCE_FILE = BASE_DIR / "dashboard_data" / "exportFteData_August 2026 (1).xlsx"

APP_NAME = "STET SYSTEUR"
APP_TAGLINE = "Manage your resources"
# Displayed as the signed-in user until real authentication is added.
CURRENT_USER = "Ritu Mehta"

# --- Database (Azure SQL) --------------------------------------------------
# Overridable via environment variables so the same code runs against dev and
# other environments without edits.
SQL_DRIVER = os.getenv("SYSTEUR_SQL_DRIVER", "ODBC Driver 17 for SQL Server")
SQL_SERVER = os.getenv(
    "SYSTEUR_SQL_SERVER",
    "tcp:az26d1-rsl-sqldb-svr01.database.windows.net,1433",
)
SQL_DATABASE = os.getenv("SYSTEUR_SQL_DATABASE", "az26d1-rsl-sqldbsvr01")
SQL_AUTHENTICATION = os.getenv("SYSTEUR_SQL_AUTH", "ActiveDirectoryInteractive")
SQL_TIMEOUT = int(os.getenv("SYSTEUR_SQL_TIMEOUT", "60"))

# Environment suffix keeps dev/prod tables side by side in one database and
# is the single source of truth for every table name across the app.
TABLE_SUFFIX = os.getenv("SYSTEUR_TABLE_SUFFIX", "_dev")
EMPLOYEES_TABLE = f"employees{TABLE_SUFFIX}"
PROJECTS_TABLE = f"projects{TABLE_SUFFIX}"
FTE_ALLOCATIONS_TABLE = f"fte_allocations{TABLE_SUFFIX}"

# Data backend selection:
#   "auto" (default) — try SQL, fall back to the CSV files if it is unreachable.
#   "sql"            — SQL only.
#   "csv"            — CSV only (skips the DB entirely; no login prompt).
DATA_BACKEND = os.getenv("SYSTEUR_DATA_BACKEND", "auto").lower()


def sql_connection_string() -> str:
    """Build the pyodbc connection string from the settings above."""
    return (
        f"Driver={{{SQL_DRIVER}}};"
        f"Server={SQL_SERVER};"
        f"Database={SQL_DATABASE};"
        f"Authentication={SQL_AUTHENTICATION};"
        "Encrypt=yes;TrustServerCertificate=no;"
        f"Connection Timeout={SQL_TIMEOUT};"
    )
