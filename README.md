# Systeur

**STET SYSTEUR** — a resource management web app for tracking full-time employee
allocations across projects, people leaders and business units.

Built with **FastAPI + Jinja2** (no Streamlit). The UI follows the Philips "RSL
Automation Tool" look & feel: blue gradient header, icon sidebar, white rounded
cards, dark navy data tables and gradient buttons.

## Features

- **Welcome** — overview and navigation cards.
- **Project Allocation** — add / edit / delete employee-to-project monthly
  allocations, with a live project search panel.
- **Dashboards** — allocation overviews by *user*, *people leader* and
  *business unit*.

## Data

Reference data currently loads from CSV files in `Dumpdata/`:

- `STET Headcount (3).csv` — employees
- `Funnel Management List (1).csv` — projects

Allocations are held in memory (seeded with samples) for now. This will move to a
SQL database later; only `app/data.py` and `app/store.py` need to change.

## Getting started

The app now runs as **two separate services**: a Python API backend and a
React frontend.

### 1. Backend (FastAPI — API on http://127.0.0.1:8000)

```powershell
# Create & activate a virtual environment (optional if .venv exists)
python -m venv .venv
.\.venv\Scripts\Activate.ps1

# Install dependencies
pip install -r requirements.txt

# Run the API server
python run.py
```

The original Jinja2 pages are still served at http://127.0.0.1:8000, but the
React frontend consumes only the JSON API under `/api`. CORS is enabled for the
Vite dev server.

### 2. Frontend (React + Vite — UI on http://localhost:5173)

```powershell
cd frontend
npm install
npm run dev
```

Then open http://localhost:5173. In development, Vite proxies `/api` to the
backend on port 8000, so start the backend first.

To create a production build: `npm run build` (output in `frontend/dist/`).

## Project structure

```
app/
  main.py        FastAPI app + page routes + CORS + JSON API mount
  data.py        CSV loading (swap for DB later)
  store.py       In-memory allocation store (swap for DB later)
  routers.py     JSON API endpoints (/api)
templates/       Legacy Jinja2 HTML pages (still served by FastAPI)
static/          Legacy CSS + JS
frontend/        React (Vite) single-page app — the new UI
  src/
    components/  Layout, Combobox, RowCombobox
    context/     ToastContext
    lib/         api client, constants, chart setup
    pages/       Login, Welcome, Allocation, Dashboard* pages
Dumpdata/        Source CSV data
```
