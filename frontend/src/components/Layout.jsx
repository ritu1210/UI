import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { APP_NAME, APP_TAGLINE, CURRENT_USER, userInitials } from '../lib/constants'

const NAV = [
  { to: '/', icon: 'fa-house', label: 'Home', tip: 'Home', end: true },
  { to: '/allocation', icon: 'fa-diagram-project', label: 'Allocation', tip: 'Project Allocation' },
  { to: '/manage-projects', icon: 'fa-layer-group', label: 'Projects', tip: 'Add / Manage Projects' },
  { to: '/manage-people', icon: 'fa-user-group', label: 'Headcount', tip: 'Add / Manage Headcount' },
  { to: '/kpi', icon: 'fa-chart-pie', label: 'KPI Dashboard', tip: 'STET KPI Dashboard' },
  { to: '/dashboards', icon: 'fa-chart-column', label: 'Dashboards', tip: 'Resource Allocation Dashboards' },
]

export default function Layout() {
  const [expanded, setExpanded] = useState(false)

  return (
    <>
      <header className="topbar">
        <div className="topbar-left">
          <button className="icon-btn" aria-label="Toggle menu" onClick={() => setExpanded((v) => !v)}>
            <i className="fa-solid fa-bars" />
          </button>
          <span className="brand"><img src="/philips-logo.png" alt="Philips" /></span>
          <span className="topbar-divider" />
          <span className="topbar-app">{APP_NAME} <span className="topbar-app-sub">&mdash; {APP_TAGLINE}</span></span>
        </div>
        <div className="topbar-right">
          <NavLink className="icon-btn" to="/" title="Home"><i className="fa-solid fa-house" /></NavLink>
          <button className="icon-btn" title="Analytics"><i className="fa-solid fa-chart-line" /></button>
          <button className="icon-btn" title="Export"><i className="fa-solid fa-download" /></button>
          <button className="icon-btn" title="Settings"><i className="fa-solid fa-gear" /></button>
          <button className="icon-btn" title="Help"><i className="fa-solid fa-circle-question" /></button>
          <div className="avatar" title={CURRENT_USER}>{userInitials()}</div>
        </div>
      </header>

      <div className="layout">
        <nav className={`sidebar${expanded ? ' expanded' : ''}`}>
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              data-tip={n.tip}
              className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
            >
              <i className={`fa-solid ${n.icon}`} />
              <span className="nav-label">{n.label}</span>
            </NavLink>
          ))}
        </nav>

        <main className="content">
          <Outlet />
          <footer className="app-footer">
            Logged in as <strong>{CURRENT_USER}</strong>
            <span className="footer-sep">&middot;</span>
            Developed by <strong>STET</strong>
          </footer>
        </main>
      </div>
    </>
  )
}
