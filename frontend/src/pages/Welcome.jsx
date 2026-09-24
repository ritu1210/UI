import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { APP_NAME, APP_TAGLINE, CURRENT_USER } from '../lib/constants'
import { apiFetch } from '../lib/api'

const NAV_CARDS = [
  { to: '/allocation', icon: 'fa-diagram-project', title: 'Project Allocation', sub: 'Assign people to projects by month' },
  { to: '/dashboards', icon: 'fa-chart-column', title: 'Resource Allocation Dashboards', sub: 'User, people leader & business unit views' },
  { to: '/manage-projects', icon: 'fa-layer-group', title: 'Projects', sub: 'Add & manage funnel projects' },
  { to: '/manage-people', icon: 'fa-user-group', title: 'Headcount', sub: 'Add & manage employees' },
  { to: '/kpi', icon: 'fa-chart-pie', title: 'KPI Dashboard', sub: 'Funnel, savings & competency' },
]

const STAT_META = [
  { key: 'projects', label: 'Funnel Projects', icon: 'fa-diagram-project' },
  { key: 'employees', label: 'Employees', icon: 'fa-user' },
  { key: 'leaders', label: 'People Leaders', icon: 'fa-user-tie' },
  { key: 'business_units', label: 'Business Units', icon: 'fa-building' },
]

const CONTACT_GROUPS = [
  {
    title: 'Funnel',
    people: [
      ['US / CC', 'Mohan Ahire'],
      ['PD', 'Adrianna Davis'],
      ['IGT / PH', 'Supriya Kumari'],
    ],
  },
  {
    title: 'Headcount',
    people: [
      ['US / CC / PH', 'Meenakshi Devi'],
      ['PD', 'Ming Zhu DI'],
      ['IGT', 'Lydia Joseph'],
    ],
  },
]

export default function Welcome() {
  const [stats, setStats] = useState(null)

  useEffect(() => {
    apiFetch('/api/stats').then(setStats).catch(() => {})
  }, [])

  return (
    <>
      <section className="welcome-hero">
        <div className="hero-text">
          <span className="hero-eyebrow"><i className="fa-solid fa-bolt" /> {APP_NAME}</span>
          <h1>{APP_TAGLINE}</h1>
          <p>Track full-time employee allocations across projects, people leaders and business units — one clear place to plan, review and report.</p>
          <div className="hero-actions">
            <Link className="btn btn-primary" to="/allocation"><i className="fa-solid fa-diagram-project" /> Start Allocating</Link>
            <Link className="btn btn-hero-ghost" to="/dashboards"><i className="fa-solid fa-chart-line" /> View Dashboards</Link>
          </div>
        </div>
      </section>

      <div className="hero-stats">
        {STAT_META.map((s) => (
          <div className="hero-stat" key={s.key}>
            <div className="hs-icon"><i className={`fa-solid ${s.icon}`} /></div>
            <div>
              <div className="hs-val">{stats ? stats[s.key].toLocaleString() : '—'}</div>
              <div className="hs-label">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-2">
        <section className="card">
          <div className="card-head">
            <i className="fa-solid fa-circle-info" />
            <h2>About</h2>
          </div>
          <p className="muted">
            The purpose of this tool is to track full-time employee resources and provide
            people managers with a data overview of their reportees across projects,
            people leaders and business units.
          </p>

          <h3 className="section-label">Quick Actions</h3>
          <div className="nav-cards">
            {NAV_CARDS.map((c) => (
              <Link key={c.to + c.sub} className="nav-card" to={c.to}>
                <i className={`fa-solid ${c.icon}`} />
                <span className="nav-card-title">{c.title}</span>
                <span className="nav-card-sub">{c.sub}</span>
              </Link>
            ))}
          </div>
        </section>

        <aside className="card card-accent">
          <div className="card-head">
            <i className="fa-solid fa-headset" />
            <h2>Need Help?</h2>
          </div>
          <p className="muted">Tips and guidance for successful use of {APP_NAME}.</p>
          <button className="btn btn-outline"><i className="fa-solid fa-book" /> Open Guide</button>

          <h3 className="section-label">Support Contacts</h3>
          <div className="contact-groups">
            {CONTACT_GROUPS.map((g) => (
              <div className="contact-group" key={g.title}>
                <div className="contact-group-head">{g.title}</div>
                <div className="contact-cards">
                  {g.people.map(([role, name]) => (
                    <div className="contact-row" key={role + name}>
                      <span className="contact-name">{name}</span>
                      <span className="region-tag">{role}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="tool-owner">
            <span className="owner-label">Tool Owner</span>
            <span className="owner-name">{CURRENT_USER}</span>
          </div>
        </aside>
      </div>
    </>
  )
}
