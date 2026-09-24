import { useState } from 'react'
import DashboardUser from './DashboardUser'
import DashboardLeader from './DashboardLeader'
import DashboardBusinessUnit from './DashboardBusinessUnit'

const VIEWS = [
  { key: 'bu', label: 'Business Unit', icon: 'fa-building', sub: 'Cross-BU allocation', comp: DashboardBusinessUnit },
  { key: 'leader', label: 'People Leader', icon: 'fa-users', sub: 'Team utilization & bench', comp: DashboardLeader },
  { key: 'user', label: 'User', icon: 'fa-user-gear', sub: 'Individual allocation', comp: DashboardUser },
]

export default function ResourceDashboards() {
  const [view, setView] = useState('bu')
  const Active = VIEWS.find((v) => v.key === view).comp

  return (
    <>
      <div className="kpi-hero">
        <div className="kpi-hero-main">
          <div className="kpi-breadcrumb">STET · Resource Allocation</div>
          <h1>Resource Allocation Dashboards</h1>
          <p>Allocation analytics from the STET resource allocation data — by individual, people leader and business unit.</p>
        </div>
        <div className="kpi-hero-meta">
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
        <Active />
      </div>
    </>
  )
}
