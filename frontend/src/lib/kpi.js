// Shared helpers for the Financials & Projects KPI dashboards.
import { apiFetch } from './api'

// Fetch once and reuse across pages/navigation.
let _cache = null
export function loadKpi(force = false) {
  if (force || !_cache) _cache = apiFetch('/api/kpi/funnel')
  return _cache
}

let _resCache = null
export function loadResources(force = false) {
  if (force || !_resCache) _resCache = apiFetch('/api/kpi/resources')
  return _resCache
}

export const KPI_BLUE = '#0b5ed7'
export const KPI_TEAL = '#16b8a6'
export const KPI_NAVY = '#0f2350'
export const KPI_PALETTE = [
  '#0b5ed7', '#16b8a6', '#2f7ff0', '#0a2e6b', '#5ec6bd', '#6699de',
  '#1b4f9c', '#0d9488', '#3d6fc0', '#89d4cc', '#5b8def', '#b9cdea',
]

// Slicers shown in the filter bar (order matters).
export const FILTER_DEFS = [
  { key: 'director', label: 'Director', icon: 'fa-user-tie' },
  { key: 'cluster', label: 'Cluster', icon: 'fa-sitemap' },
  { key: 'bu', label: 'Business Unit', icon: 'fa-building' },
  { key: 'project_type', label: 'Project Type', icon: 'fa-tags' },
  { key: 'commodity', label: 'Commodity', icon: 'fa-boxes-stacked' },
  { key: 'savings_type', label: 'Savings Type', icon: 'fa-piggy-bank' },
  { key: 'procurement_type', label: 'Procurement', icon: 'fa-file-signature' },
  { key: 'current_il', label: 'IL Status', icon: 'fa-signal' },
  { key: 'spoc', label: 'STET SPOC', icon: 'fa-user-gear' },
  { key: 'program_manager', label: 'Program Mgr', icon: 'fa-user-group' },
]

export function emptySelection(defs = FILTER_DEFS) {
  const s = {}
  defs.forEach((f) => { s[f.key] = new Set() })
  return s
}

export function applyFilters(records, selected) {
  const active = Object.entries(selected).filter(([, set]) => set && set.size)
  if (!active.length) return records
  return records.filter((r) => active.every(([key, set]) => set.has(r[key])))
}

function sumYears(obj) {
  let s = 0
  for (const k in obj) s += obj[k] || 0
  return s
}

// Value getters for the metric toggle.
export const metricValue = {
  funnel: (r) => sumYears(r.funnel),
  actual: (r) => sumYears(r.actual),
}

export function groupSum(records, key, valueFn) {
  const m = new Map()
  for (const r of records) {
    const k = r[key] || '—'
    m.set(k, (m.get(k) || 0) + (valueFn(r) || 0))
  }
  return [...m.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value)
}

export function groupCount(records, key) {
  const m = new Map()
  for (const r of records) {
    const k = r[key] || '—'
    m.set(k, (m.get(k) || 0) + 1)
  }
  return [...m.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value)
}

export function fmtEuro(n) {
  const v = n || 0
  const abs = Math.abs(v)
  if (abs >= 1e9) return `€ ${(v / 1e9).toFixed(1)}B`
  if (abs >= 1e6) return `€ ${(v / 1e6).toFixed(1)}M`
  if (abs >= 1e3) return `€ ${(v / 1e3).toFixed(0)}K`
  return `€ ${Math.round(v)}`
}

export function fmtNum(n) {
  return (n || 0).toLocaleString()
}

export function fmtAmt(n) {
  const v = n || 0
  return v.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })
}

// Slicers for the Resource Allocation view (FTE export fields).
export const RESOURCE_FILTER_DEFS = [
  { key: 'proj_others', label: 'Projects / Others', icon: 'fa-diagram-project' },
  { key: 'director', label: 'Director', icon: 'fa-user-tie' },
  { key: 'cluster', label: 'Cluster', icon: 'fa-sitemap' },
  { key: 'bu', label: 'Business Unit', icon: 'fa-building' },
  { key: 'region', label: 'Region', icon: 'fa-earth-americas' },
  { key: 'project_type', label: 'Project Type', icon: 'fa-tags' },
  { key: 'commodity', label: 'Commodity', icon: 'fa-boxes-stacked' },
  { key: 'savings_type', label: 'Savings Type', icon: 'fa-piggy-bank' },
  { key: 'fte_type', label: 'FTE / Contingent', icon: 'fa-user-clock' },
  { key: 'status', label: 'Status', icon: 'fa-toggle-on' },
  { key: 'reporting_manager', label: 'Reporting Mgr', icon: 'fa-user-group' },
]
