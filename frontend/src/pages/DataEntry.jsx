import { useEffect, useMemo, useState } from 'react'
import { apiFetch } from '../lib/api'
import SuggestInput from '../components/SuggestInput'
import SelectMenu from '../components/SelectMenu'
import DatePicker from '../components/DatePicker'
import { useToast } from '../context/ToastContext'

// Maps a field's datalist id to the /api/meta key that supplies its suggestions.
export const DL_META = {
  'dl-ptypes': 'project_types', 'dl-bus': 'bus', 'dl-clusters': 'clusters',
  'dl-commodities': 'commodities', 'dl-ils': 'current_ils', 'dl-directors': 'directors',
  'dl-spocs': 'spocs', 'dl-pms': 'program_managers', 'dl-jobtitles': 'job_titles',
  'dl-jobgrades': 'job_grades', 'dl-managers': 'reporting_managers', 'dl-countries': 'countries',
  'dl-locations': 'locations', 'dl-emptypes': 'employment_types', 'dl-statuses': 'statuses',
}

// Business units grouped by cluster — selecting a cluster limits the BU choices.
export const CLUSTER_BU = {
  PH: ['GB', 'MCC', 'OHC'],
  PD: ['DXR', 'MR', 'CT', 'US', 'US-Trans', 'IC', 'CT/AMI', 'DMS'],
  IGT: ['IGT-D', 'IGT-MoS', 'IGT-S'],
  CC: ['EC', 'HPM', 'PHM', 'SRC', 'AM&D', 'HRC'],
}
const FUNNEL_BUS = [...new Set(Object.values(CLUSTER_BU).flat())].sort()
const WEEKS = Array.from({ length: 53 }, (_, i) => `WK${i + 1}`)

// ---- Form definitions (data-driven so sections stay easy to extend) ----
export const FUNNEL_SECTIONS = [
  {
    title: 'Project Details', icon: 'fa-diagram-project',
    fields: [
      { k: 'project_id', label: 'Project ID', required: true, placeholder: 'e.g. RfS 279000' },
      { k: 'title', label: 'Project Title', required: true, placeholder: 'Short descriptive title', full: true },
      { k: 'project_type', label: 'Project Type', list: 'dl-ptypes' },
      { k: 'is_active', label: 'Is Active', options: ['Yes', 'No'] },
      { k: 'cluster', label: 'Cluster', options: ['PH', 'PD', 'IGT', 'CC'], clears: ['bu'] },
      { k: 'bu', label: 'Business Unit', optionsFn: (s) => CLUSTER_BU[s.cluster] || FUNNEL_BUS },
      { k: 'commodity', label: 'Commodity', list: 'dl-commodities' },
      { k: 'current_il', label: 'Current IL', list: 'dl-ils', required: true },
      { k: 'il5_date', label: 'IL5 Date', type: 'date', required: true },
      { k: 'parts_dual_sourced', label: '# Parts of Dual Sourced', placeholder: 'e.g. 3' },
    ],
  },
  {
    title: 'Ownership', icon: 'fa-user-tie',
    fields: [
      { k: 'director', label: 'Director', list: 'dl-directors' },
      { k: 'spoc', label: 'STET SPOC', list: 'dl-spocs' },
      { k: 'program_manager', label: 'Program Manager', list: 'dl-pms' },
    ],
  },
  {
    title: 'Savings & Financials', icon: 'fa-coins',
    showIf: (s) => (s.project_type || '').toLowerCase() === 'productivity',
    fields: [
      { k: 'aos_impact', label: 'AOS Impact (€)', placeholder: '0' },
      { k: 'qn_reduction', label: 'QN Reduction Impact (€)', placeholder: '0' },
      { k: 'procurement_type', label: 'Procurement Type', options: ['PROCUREMENT', 'TCO', 'N/A'] },
      { k: 'savings_type', label: 'Savings Type', options: ['TCO', 'CONCEPT', 'SOURCING', 'NEGO', 'NON_12NC', 'NPP', 'CONQ', 'FCP & PPV'] },
      { k: 'funnel_2025', label: '2025 Funnel (€)', placeholder: '0' },
      { k: 'actual_2025', label: '2025 Actual (€)', placeholder: '0' },
      { k: 'funnel_2026', label: '2026 Funnel (€)', placeholder: '0' },
      { k: 'actual_2026', label: '2026 Actual (€)', placeholder: '0' },
      { k: 'funnel_2027', label: '2027 Funnel (€)', placeholder: '0' },
      { k: 'actual_2027', label: '2027 Actual (€)', placeholder: '0' },
      { k: 'funnel_2028', label: '2028 Funnel (€)', placeholder: '0' },
      { k: 'actual_2028', label: '2028 Actual (€)', placeholder: '0' },
    ],
  },
  {
    title: 'Status & Notes', icon: 'fa-clipboard-check',
    fields: [
      { k: 'impacted_parts', label: 'Impacted Parts Added?', options: ['YES', 'NO', 'N/A'] },
      { k: 'sqe_resources', label: 'STET SQE Resources Applied?', options: ['YES', 'NO', 'N/A'] },
      { k: 'week', label: 'Week', options: WEEKS },
      { k: 'comments', label: 'Comments / Challenges', textarea: true, full: true },
    ],
  },
]

export const HEADCOUNT_SECTIONS = [
  {
    title: 'Identity', icon: 'fa-id-card',
    fields: [
      { k: 'name', label: 'Employee Name', required: true, placeholder: 'Full name' },
      { k: 'email', label: 'Email ID', required: true, placeholder: 'name@philips.com' },
    ],
  },
  {
    title: 'Role', icon: 'fa-briefcase',
    fields: [
      { k: 'job_title', label: 'Job Title', list: 'dl-jobtitles' },
      { k: 'job_grade', label: 'Job Grade', list: 'dl-jobgrades' },
      { k: 'employment_type', label: 'Employment Type', list: 'dl-emptypes' },
      { k: 'status', label: 'Employment Status', list: 'dl-statuses' },
      { k: 'start_date', label: 'Start Date', placeholder: 'M/D/YYYY' },
      { k: 'gender', label: 'Diversity', placeholder: 'e.g. Male / Female' },
    ],
  },
  {
    title: 'Reporting', icon: 'fa-sitemap',
    fields: [
      { k: 'reporting_manager', label: 'Reporting Manager (email)', list: 'dl-managers', placeholder: 'manager@philips.com' },
      { k: 'director', label: 'Director', list: 'dl-directors' },
    ],
  },
  {
    title: 'Location', icon: 'fa-location-dot',
    fields: [
      { k: 'country', label: 'Location Country', list: 'dl-countries' },
      { k: 'location', label: 'Job Location', list: 'dl-locations' },
    ],
  },
]

// Fields kept after a save when "keep shared fields" is on (fast batch entry).
const FUNNEL_SHARED = ['director', 'spoc', 'program_manager', 'bu', 'cluster', 'commodity', 'project_type', 'current_il', 'week']
const HC_SHARED = ['director', 'reporting_manager', 'country', 'location', 'employment_type', 'status', 'job_grade']

function emptyState(sections) {
  const s = {}
  sections.forEach((sec) => sec.fields.forEach((f) => { s[f.k] = '' }))
  return s
}

const EMPTY_FUNNEL = { ...emptyState(FUNNEL_SECTIONS), is_active: 'Yes' }
const EMPTY_HC = emptyState(HEADCOUNT_SECTIONS)

export function FormField({ cfg, value, onChange, suggestions, state }) {
  const options = cfg.optionsFn ? cfg.optionsFn(state || {}) : cfg.options
  const inner = cfg.textarea ? (
    <textarea rows={3} value={value} placeholder={cfg.placeholder} onChange={(e) => onChange(e.target.value)} />
  ) : options ? (
    <SelectMenu value={value} onChange={onChange} options={options} />
  ) : cfg.type === 'date' ? (
    <DatePicker value={value} onChange={onChange} placeholder={cfg.placeholder || 'Select date'} />
  ) : cfg.list ? (
    <SuggestInput value={value} onChange={onChange} options={suggestions || []} placeholder={cfg.placeholder} />
  ) : (
    <input type="text" value={value} placeholder={cfg.placeholder} autoComplete="off" onChange={(e) => onChange(e.target.value)} />
  )
  return (
    <div className={`form-field${cfg.full ? ' form-full' : ''}`}>
      <label>{cfg.label}{cfg.required && <span className="req">*</span>}</label>
      {inner}
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
  const [keepShared, setKeepShared] = useState(true)

  useEffect(() => {
    apiFetch('/api/meta').then(setMeta).catch((e) => showToast(e.message, true))
  }, [showToast])

  const sections = tab === 'funnel' ? FUNNEL_SECTIONS : HEADCOUNT_SECTIONS
  const state = tab === 'funnel' ? funnel : hc
  const setState = tab === 'funnel' ? setFunnel : setHc
  const set = (k) => (v) => setState((s) => ({ ...s, [k]: v }))

  const filledCount = useMemo(() => Object.values(state).filter((v) => String(v).trim()).length, [state])
  const totalCount = useMemo(() => Object.keys(state).length, [state])

  function resetAfterSave() {
    const empty = tab === 'funnel' ? EMPTY_FUNNEL : EMPTY_HC
    const shared = tab === 'funnel' ? FUNNEL_SHARED : HC_SHARED
    if (!keepShared) return setState(empty)
    setState((s) => {
      const next = { ...empty }
      shared.forEach((k) => { if (s[k]) next[k] = s[k] })
      return next
    })
  }

  async function submit(e) {
    e.preventDefault()
    // Only fields currently visible (respecting showIf) are validated and saved.
    const visibleFields = sections.filter((s) => !s.showIf || s.showIf(state)).flatMap((s) => s.fields).filter((f) => !f.showIf || f.showIf(state))
    const missing = visibleFields.find((f) => f.required && !String(state[f.k] || '').trim())
    if (missing) return showToast(`${missing.label} is required`, true)

    const visibleKeys = new Set(visibleFields.map((f) => f.k))
    const payload = {}
    Object.keys(state).forEach((k) => { payload[k] = visibleKeys.has(k) ? state[k] : '' })

    setSaving(true)
    try {
      if (tab === 'funnel') {
        const p = await apiFetch('/api/funnel', { method: 'POST', body: JSON.stringify(payload) })
        showToast('Funnel project added')
        setRecent((r) => [{ type: 'Funnel', icon: 'fa-diagram-project', label: `${p.project_id} — ${p.title}` }, ...r].slice(0, 12))
      } else {
        const emp = await apiFetch('/api/headcount', { method: 'POST', body: JSON.stringify(payload) })
        showToast('Headcount employee added')
        setRecent((r) => [{ type: 'Headcount', icon: 'fa-user-plus', label: `${emp.name}${emp.job_title ? ' — ' + emp.job_title : ''}` }, ...r].slice(0, 12))
      }
      resetAfterSave()
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
        <section className="card entry-card">
          <form onSubmit={submit}>
            {sections.filter((sec) => !sec.showIf || sec.showIf(state)).map((sec) => (
              <div className="form-section" key={sec.title}>
                <div className="form-section-head">
                  <i className={`fa-solid ${sec.icon}`} /> {sec.title}
                </div>
                <div className="form-grid-3">
                  {sec.fields.filter((f) => !f.showIf || f.showIf(state)).map((f) => (
                    <FormField key={f.k} cfg={f} value={state[f.k]} state={state}
                      onChange={(v) => setState((s) => { const n = { ...s, [f.k]: v }; (f.clears || []).forEach((k) => { n[k] = '' }); return n })}
                      suggestions={f.list ? (meta[DL_META[f.list]] || []) : null} />
                  ))}
                </div>
              </div>
            ))}

            <div className="form-sticky">
              <label className="keep-toggle">
                <input type="checkbox" checked={keepShared} onChange={(e) => setKeepShared(e.target.checked)} />
                Keep shared fields for next entry
              </label>
              <span className="fill-hint">{filledCount}/{totalCount} filled</span>
              <div className="form-actions">
                <button className="btn btn-ghost" type="button" onClick={() => setState(tab === 'funnel' ? EMPTY_FUNNEL : EMPTY_HC)}>Clear</button>
                <button className="btn btn-primary" type="submit" disabled={saving}>
                  <i className="fa-solid fa-floppy-disk" /> {saving ? 'Saving…' : tab === 'funnel' ? 'Add to Funnel' : 'Add to Headcount'}
                </button>
              </div>
            </div>
          </form>
        </section>

        <aside className="card card-accent entry-side">
          <div className="card-head"><i className="fa-solid fa-clock-rotate-left" /><h2>Recently Added</h2></div>
          {recent.length === 0 ? (
            <p className="muted">Nothing added yet this session. New entries appear here and are saved to the source files right away.</p>
          ) : (
            <>
              <span className="recent-count">{recent.length} this session</span>
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
            </>
          )}
          <div className="entry-tip">
            <i className="fa-solid fa-lightbulb" />
            <span>Keep <strong>shared fields</strong> on to add several projects for the same BU / Director without retyping. Only <span className="req">*</span> fields are required.</span>
          </div>
        </aside>
      </div>
    </>
  )
}
