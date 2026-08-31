import { Link } from 'react-router-dom'
import { APP_NAME, CURRENT_USER } from '../lib/constants'

const NAV_CARDS = [
  { to: '/allocation', icon: 'fa-diagram-project', title: 'Project Allocation', sub: 'Assign people to projects by month' },
  { to: '/dashboard/user', icon: 'fa-user-gear', title: 'Allocation Dashboard', sub: 'User specific' },
  { to: '/dashboard/people-leader', icon: 'fa-users', title: 'Allocation Dashboard', sub: 'People leader' },
  { to: '/dashboard/business-unit', icon: 'fa-building', title: 'Allocation Dashboard', sub: 'Business unit' },
]

const CONTACTS = [
  ['Project Updates — US / CC', 'Ashwini Jibhkate'],
  ['Project Updates — PD', 'Adrianna Davis'],
  ['Project Updates — IGT / PH', 'Supriya Kumari'],
  ['Headcount — US / CC / PH', 'Meenakshi Devi'],
  ['Headcount — PD', 'Ming Zhu DI'],
  ['Headcount — IGT', 'Asmita Marathe'],
]

export default function Welcome() {
  return (
    <>
      <div className="page-heading">
        <h1>Welcome to {APP_NAME}</h1>
        <p className="subtitle">Track full-time employee resources and give people managers a clear view of their reportees.</p>
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

          <h3 className="section-label">Navigation</h3>
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
          <ul className="contact-list">
            {CONTACTS.map(([role, name]) => (
              <li key={role}>
                <span className="contact-role">{role}</span>
                <span className="contact-name">{name}</span>
              </li>
            ))}
          </ul>
          <div className="tool-owner">Tool Owner — <strong>{CURRENT_USER}</strong></div>
        </aside>
      </div>
    </>
  )
}
