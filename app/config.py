"""Application configuration and shared paths."""
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

DATA_DIR = BASE_DIR / "Dumpdata"
TEMPLATES_DIR = BASE_DIR / "templates"
STATIC_DIR = BASE_DIR / "static"

# Source data files (CSV for now, database later).
HEADCOUNT_FILE = DATA_DIR / "STET Headcount (3).csv"
FUNNEL_FILE = DATA_DIR / "STET Funnel (1).csv"
FTE_ALLOCATION_FILE = DATA_DIR / "STET FTE Allocation (22).csv"

APP_NAME = "STET SYSTEUR"
APP_TAGLINE = "Manage your resources"
# Displayed as the signed-in user until real authentication is added.
CURRENT_USER = "Ritu Mehta"
