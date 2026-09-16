import { useEffect, useMemo, useState } from 'react'
import KpiFilterBar from '../components/KpiFilterBar'
import { useToast } from '../context/ToastContext'
import { applyFilters, emptySelection, loadKpi } from '../lib/kpi'
import FinancialsView from './kpi/FinancialsView'
import ProjectsView from './kpi/ProjectsView'
import ResourceView from './kpi/ResourceView'

const VIEWS = [
  { key: 'financials', label: 'Financials', icon: 'fa-euro-sign', sub: 'Funnel & actual savings' },
  { key: 'projects', label: 'Projects', icon: 'fa-layer-group', sub: 'Portfolio composition' },
  { key: 'resources', label: 'Resource Allocation', icon: 'fa-users-gear', sub: 'FTE & contingent load' },
]

export default function KpiDashboard() {
  const showToast = useToast()
  const [payload, setPayload] = useState(null)
  const [selected, setSelected] = useState(emptySelection)
  const [view, setView] = useState('financials')

  useEffect(() => {
    loadKpi().then(setPayload).catch((e) => showToast(e.message, true))
  }, [showToast])

  const records = useMemo(
    () => (payload ? applyFilters(payload.records, selected) : []),
    [payload, selected],
  )

  if (!payload) return <div className="loading-wrap"><span className="spinner" /> Loading dashboard…</div>

  const isResources = view === 'resources'

  return (
    <>
      <div className="kpi-hero">
        <div className="kpi-hero-main">
          <div className="kpi-breadcrumb">STET · Analytics</div>
          <h1>KPI Dashboard</h1>
          <p>Live funnel &amp; resource analytics across the STET portfolio.</p>
        </div>
        <div className="kpi-hero-meta">
          {!isResources && (
            <div className="kpi-hero-chip"><i className="fa-solid fa-diagram-project" /> {records.length.toLocaleString()} projects</div>
          )}
          <div className="kpi-hero-chip live"><span className="live-dot" /> Live data</div>
        </div>
      </div>

      <div className="kpi-tabbar">
        {VIEWS.map((v) => (
          <button
            key={v.key}
            className={`kpi-tabbtn${view === v.key ? ' active' : ''}`}
            onClick={() => setView(v.key)}
          >
            <span className="kpi-tabbtn-ic"><i className={`fa-solid ${v.icon}`} /></span>
            <span className="kpi-tabbtn-txt">
              <span className="kpi-tabbtn-label">{v.label}</span>
              <span className="kpi-tabbtn-sub">{v.sub}</span>
            </span>
          </button>
        ))}
      </div>

      <div key={view} className="kpi-view-fade">
        {isResources && <ResourceView />}
        {!isResources && (
          <>
            <KpiFilterBar
              options={payload.filters}
              selected={selected}
              setSelected={setSelected}
              matched={records.length}
              total={payload.count}
            />
            {view === 'financials'
              ? <FinancialsView records={records} />
              : <ProjectsView records={records} />}
          </>
        )}
      </div>
    </>
  )
}
