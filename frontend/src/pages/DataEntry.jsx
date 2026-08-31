import { useEffect, useState } from 'react'
import { apiFetch } from '../lib/api'
import { useToast } from '../context/ToastContext'

const EMPTY_FUNNEL = {
  project_id: '', title: '', bu: '', cluster: '', project_type: '',
  commodity: '', current_il: '', director: '', spoc: '', program_manager: '',
}
const EMPTY_HC = {
  name: '', email: '', job_title: '', job_grade: '', director: '',
  reporting_manager: '', country: '', location: '', employment_type: '',
  status: '', gender: '', start_date: '',
}

function Field({ label, value, onChange, required, list, placeholder, full }) {
  return (
    <div className={`form-field${full ? ' form-full' : ''}`}>
      <label>{label}{required && <span className="req">*</span>}</label>
      <input type="text" value={value} onChange={(e) => onChange(e.target.value)} list={list} placeholder={placeholder} autoComplete="off" />
    </div>
  )
}

export default function DataEntry() {
  const showToast = useToast()
  const [tab, setTab] = useState('funnel')
  const [meta, setMeta] = useState({})
  const [funnel, setFunnel] = useState(EMPTY_FUNNEL)
  const [hc, setHc] = useState(EMPTY_HC)
  const [saving, setSaving] = useState(false)
  const [recent, setRecent] = useState([])

  useEffect(() => {
    apiFetch('/api/meta').then(setMeta).catch((e) => showToast(e.message, true))
  }, [showToast])

  const setF = (k) => (v) => setFunnel((s) => ({ ...s, [k]: v }))
  const setH = (k) => (v) => setHc((s) => ({ ...s, [k]: v }))

  async function submitFunnel(e) {
    e.preventDefault()
    if (!funnel.project_id.trim() || !funnel.title.trim()) return showToast('Project ID and Title are required', true)
    setSaving(true)
    try {
      const p = await apiFetch('/api/funnel', { method: 'POST', body: JSON.stringify(funnel) })
      showToast('Funnel project added')
      setRecent((r) => [{ type: 'Funnel', icon: 'fa-diagram-project', label: `${p.project_id} — ${p.title}` }, ...r].slice(0, 8))
      setFunnel(EMPTY_FUNNEL)
    } catch (err) { showToast(err.message, true) } finally { setSaving(false) }
  }

  async function submitHc(e) {
    e.preventDefault()
    if (!hc.name.trim() || !hc.email.trim()) return showToast('Employee Name and Email are required', true)
    setSaving(true)
    try {
      const emp = await apiFetch('/api/headcount', { method: 'POST', body: JSON.stringify(hc) })
      showToast('Headcount employee added')
      setRecent((r) => [{ type: 'Headcount', icon: 'fa-user-plus', label: `${emp.name}${emp.job_title ? ' — ' + emp.job_title : ''}` }, ...r].slice(0, 8))
      setHc(EMPTY_HC)
    } catch (err) { showToast(err.message, true) } finally { setSaving(false) }
  }

  return (
    <>
      <div className="page-heading">
        <h1>Data Entry <span className="tag">PM tools</span></h1>
        <p className="subtitle">Add new funnel projects and headcount records. Entries are appended to the STET source files and go live immediately.</p>
      </div>

      <div className="tabs">
        <button className={`tab-btn${tab === 'funnel' ? ' active' : ''}`} onClick={() => setTab('funnel')}>
          <i className="fa-solid fa-diagram-project" /> Funnel Project
        </button>
        <button className={`tab-btn${tab === 'headcount' ? ' active' : ''}`} onClick={() => setTab('headcount')}>
          <i className="fa-solid fa-user-plus" /> Headcount
        </button>
      </div>

      <div className="grid grid-alloc">
        <section className="card">
          {tab === 'funnel' ? (
            <form onSubmit={submitFunnel}>
              <div className="card-head"><i className="fa-solid fa-diagram-project" /><h2>New Funnel Project</h2></div>
              <div className="form-grid">
                <Field label="Project ID" value={funnel.project_id} onChange={setF('project_id')} required placeholder="e.g. RfS 279000" />
                <Field label="Project Title" value={funnel.title} onChange={setF('title')} required placeholder="Short descriptive title" />
                <Field label="Business Unit" value={funnel.bu} onChange={setF('bu')} list="dl-bus" />
                <Field label="Cluster" value={funnel.cluster} onChange={setF('cluster')} list="dl-clusters" />
                <Field label="Project Type" value={funnel.project_type} onChange={setF('project_type')} list="dl-ptypes" />
                <Field label="Commodity" value={funnel.commodity} onChange={setF('commodity')} list="dl-commodities" />
                <Field label="Current IL" value={funnel.current_il} onChange={setF('current_il')} list="dl-ils" />
                <Field label="Director" value={funnel.director} onChange={setF('director')} list="dl-directors" />
                <Field label="STET SPOC" value={funnel.spoc} onChange={setF('spoc')} list="dl-spocs" />
                <Field label="Program Manager" value={funnel.program_manager} onChange={setF('program_manager')} list="dl-pms" />
              </div>
              <div className="form-actions">
                <button className="btn btn-primary" type="submit" disabled={saving}>
                  <i className="fa-solid fa-floppy-disk" /> {saving ? 'Saving…' : 'Add to Funnel'}
                </button>
                <button className="btn btn-ghost" type="button" onClick={() => setFunnel(EMPTY_FUNNEL)}>Clear</button>
              </div>
            </form>
          ) : (
            <form onSubmit={submitHc}>
              <div className="card-head"><i className="fa-solid fa-user-plus" /><h2>New Headcount Record</h2></div>
              <div className="form-grid">
                <Field label="Employee Name" value={hc.name} onChange={setH('name')} required placeholder="Full name" />
                <Field label="Email ID" value={hc.email} onChange={setH('email')} required placeholder="name@philips.com" />
                <Field label="Job Title" value={hc.job_title} onChange={setH('job_title')} list="dl-jobtitles" />
                <Field label="Job Grade" value={hc.job_grade} onChange={setH('job_grade')} list="dl-jobgrades" />
                <Field label="Reporting Manager (email)" value={hc.reporting_manager} onChange={setH('reporting_manager')} list="dl-managers" placeholder="manager@philips.com" />
                <Field label="Director" value={hc.director} onChange={setH('director')} list="dl-directors" />
                <Field label="Location Country" value={hc.country} onChange={setH('country')} list="dl-countries" />
                <Field label="Job Location" value={hc.location} onChange={setH('location')} list="dl-locations" />
                <Field label="Employment Type" value={hc.employment_type} onChange={setH('employment_type')} list="dl-emptypes" />
                <Field label="Employment Status" value={hc.status} onChange={setH('status')} list="dl-statuses" />
                <Field label="Diversity" value={hc.gender} onChange={setH('gender')} placeholder="e.g. Male / Female" />
                <Field label="Start Date" value={hc.start_date} onChange={setH('start_date')} placeholder="M/D/YYYY" />
              </div>
              <div className="form-actions">
                <button className="btn btn-primary" type="submit" disabled={saving}>
                  <i className="fa-solid fa-floppy-disk" /> {saving ? 'Saving…' : 'Add to Headcount'}
                </button>
                <button className="btn btn-ghost" type="button" onClick={() => setHc(EMPTY_HC)}>Clear</button>
              </div>
            </form>
          )}
        </section>

        <aside className="card card-accent">
          <div className="card-head"><i className="fa-solid fa-clock-rotate-left" /><h2>Recently Added</h2></div>
          {recent.length === 0 ? (
            <p className="muted">Nothing added yet this session. New entries appear here and are saved to the source files right away.</p>
          ) : (
            <ul className="recent-list">
              {recent.map((r, i) => (
                <li key={i}>
                  <i className={`fa-solid ${r.icon}`} />
                  <div>
                    <span className="recent-type">{r.type}</span>
                    <span className="recent-label">{r.label}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <p className="muted" style={{ marginTop: 14, fontSize: 12 }}>
            <i className="fa-solid fa-circle-info" /> Entries are appended to the STET Funnel / Headcount CSVs and reflected across the dashboards immediately.
          </p>
        </aside>
      </div>

      {/* Suggestion lists sourced from existing data */}
      <datalist id="dl-bus">{(meta.bus || []).map((v) => <option key={v} value={v} />)}</datalist>
      <datalist id="dl-clusters">{(meta.clusters || []).map((v) => <option key={v} value={v} />)}</datalist>
      <datalist id="dl-ptypes">{(meta.project_types || []).map((v) => <option key={v} value={v} />)}</datalist>
      <datalist id="dl-commodities">{(meta.commodities || []).map((v) => <option key={v} value={v} />)}</datalist>
      <datalist id="dl-ils">{(meta.current_ils || []).map((v) => <option key={v} value={v} />)}</datalist>
      <datalist id="dl-directors">{(meta.directors || []).map((v) => <option key={v} value={v} />)}</datalist>
      <datalist id="dl-spocs">{(meta.spocs || []).map((v) => <option key={v} value={v} />)}</datalist>
      <datalist id="dl-pms">{(meta.program_managers || []).map((v) => <option key={v} value={v} />)}</datalist>
      <datalist id="dl-jobtitles">{(meta.job_titles || []).map((v) => <option key={v} value={v} />)}</datalist>
      <datalist id="dl-jobgrades">{(meta.job_grades || []).map((v) => <option key={v} value={v} />)}</datalist>
      <datalist id="dl-managers">{(meta.reporting_managers || []).map((v) => <option key={v} value={v} />)}</datalist>
      <datalist id="dl-countries">{(meta.countries || []).map((v) => <option key={v} value={v} />)}</datalist>
      <datalist id="dl-locations">{(meta.locations || []).map((v) => <option key={v} value={v} />)}</datalist>
      <datalist id="dl-emptypes">{(meta.employment_types || []).map((v) => <option key={v} value={v} />)}</datalist>
      <datalist id="dl-statuses">{(meta.statuses || []).map((v) => <option key={v} value={v} />)}</datalist>
    </>
  )
}
