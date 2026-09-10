import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { apiFetch } from '../lib/api'
import { useToast } from '../context/ToastContext'
import Modal from '../components/Modal'
import Combobox from '../components/Combobox'
import { FUNNEL_SECTIONS, DL_META, FormField } from './DataEntry'

// Project ID is the row key — shown read-only in the editor.
const EDIT_SECTIONS = FUNNEL_SECTIONS.map((sec) => ({
  ...sec,
  fields: sec.fields.filter((f) => f.k !== 'project_id'),
})).filter((sec) => sec.fields.length)

const PAGE_SIZE = 25

function blankState() {
  const s = {}
  EDIT_SECTIONS.forEach((sec) => sec.fields.forEach((f) => { s[f.k] = '' }))
  return s
}

function emptyAdd() {
  const s = {}
  FUNNEL_SECTIONS.forEach((sec) => sec.fields.forEach((f) => { s[f.k] = '' }))
  s.is_active = 'Yes'
  return s
}

function isActive(v) { return (v || 'Yes').toLowerCase() !== 'no' }

const EUR = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })
function euroCompact(n) {
  const v = Number(n) || 0
  const abs = Math.abs(v)
  if (abs >= 1e9) return `\u20ac${(v / 1e9).toFixed(1)}B`
  if (abs >= 1e6) return `\u20ac${(v / 1e6).toFixed(1)}M`
  if (abs >= 1e3) return `\u20ac${(v / 1e3).toFixed(0)}K`
  return `\u20ac${Math.round(v)}`
}

const EMPTY_SUMMARY = { total: 0, active: 0, inactive: 0, funnel_total: 0, actual_total: 0, bus: [], spocs: [] }

function AddProjectForm({ meta, onAdded }) {
  const showToast = useToast()
  const [form, setForm] = useState(emptyAdd)
  const [saving, setSaving] = useState(false)

  const visibleSections = FUNNEL_SECTIONS.filter((s) => !s.showIf || s.showIf(form))

  async function submit(e) {
    e.preventDefault()
    const visible = visibleSections.flatMap((s) => s.fields).filter((f) => !f.showIf || f.showIf(form))
    const missing = visible.find((f) => f.required && !String(form[f.k] || '').trim())
    if (missing) return showToast(`${missing.label} is required`, true)
    const keys = new Set(visible.map((f) => f.k))
    const payload = {}
    Object.keys(form).forEach((k) => { payload[k] = keys.has(k) ? form[k] : '' })
    setSaving(true)
    try {
      const p = await apiFetch('/api/funnel', { method: 'POST', body: JSON.stringify(payload) })
      showToast('Project added to funnel')
      setForm(emptyAdd())
      onAdded(p)
    } catch (err) { showToast(err.message, true) } finally { setSaving(false) }
  }

  return (
    <form className="card mp-add" onSubmit={submit}>
      {visibleSections.map((sec) => (
        <div className="form-section" key={sec.title}>
          <div className="form-section-head"><i className={`fa-solid ${sec.icon}`} /><h3>{sec.title}</h3></div>
          <div className="form-grid-3">
            {sec.fields.filter((f) => !f.showIf || f.showIf(form)).map((f) => (
              <FormField key={f.k} cfg={f} value={form[f.k] || ''} state={form}
                onChange={(v) => setForm((s) => { const n = { ...s, [f.k]: v }; (f.clears || []).forEach((k) => { n[k] = '' }); return n })}
                suggestions={f.list ? (meta[DL_META[f.list]] || []) : undefined} />
            ))}
          </div>
        </div>
      ))}
      <div className="mp-add-actions">
        <button className="btn btn-ghost" type="button" onClick={() => setForm(emptyAdd())}>Clear</button>
        <button className="btn btn-primary" type="submit" disabled={saving}>
          <i className="fa-solid fa-plus" /> {saving ? 'Adding\u2026' : 'Add to Funnel'}
        </button>
      </div>
    </form>
  )
}

export default function ManageProjects() {
  const showToast = useToast()
  const [view, setView] = useState('manage') // 'manage' | 'add'
  const [meta, setMeta] = useState({})
  const [q, setQ] = useState('')
  const [debouncedQ, setDebouncedQ] = useState('')
  const [active, setActive] = useState('') // '', 'yes', 'no'
  const [bu, setBu] = useState('')
  const [spoc, setSpoc] = useState('')
  const [page, setPage] = useState(1)
  const [data, setData] = useState({ items: [], total: 0, page: 1, size: PAGE_SIZE })
  const [summary, setSummary] = useState(EMPTY_SUMMARY)
  const [loading, setLoading] = useState(false)

  // Edit modal state
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(blankState())
  const original = useRef(blankState())
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    apiFetch('/api/meta').then(setMeta).catch((e) => showToast(e.message, true))
  }, [showToast])

  useEffect(() => {
    const t = setTimeout(() => { setDebouncedQ(q.trim()); setPage(1) }, 300)
    return () => clearTimeout(t)
  }, [q])

  useEffect(() => { setPage(1) }, [active, bu, spoc])

  const load = useCallback(() => {
    setLoading(true)
    const params = new URLSearchParams({ page: String(page), size: String(PAGE_SIZE) })
    if (debouncedQ) params.set('q', debouncedQ)
    if (active) params.set('active', active)
    if (bu) params.set('bu', bu)
    if (spoc) params.set('spoc', spoc)
    apiFetch(`/api/projects/page?${params.toString()}`)
      .then(setData).catch((e) => showToast(e.message, true)).finally(() => setLoading(false))
  }, [page, debouncedQ, active, bu, spoc, showToast])

  const loadSummary = useCallback(() => {
    const params = new URLSearchParams()
    if (debouncedQ) params.set('q', debouncedQ)
    if (active) params.set('active', active)
    if (bu) params.set('bu', bu)
    if (spoc) params.set('spoc', spoc)
    apiFetch(`/api/projects/summary?${params.toString()}`).then(setSummary).catch(() => {})
  }, [debouncedQ, active, bu, spoc])

  useEffect(() => { load() }, [load])
  useEffect(() => { loadSummary() }, [loadSummary])

  const totalPages = Math.max(1, Math.ceil(data.total / PAGE_SIZE))
  const from = data.total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const to = Math.min(page * PAGE_SIZE, data.total)
  const achievement = summary.funnel_total > 0 ? Math.round((summary.actual_total / summary.funnel_total) * 100) : 0
  const hasFilters = q || bu || spoc || active

  async function openEditor(p) {
    setEditing(p)
    setLoadingDetail(true)
    try {
      const detail = await apiFetch(`/api/project?project_id=${encodeURIComponent(p.project_id)}`)
      const next = { ...blankState(), ...detail.fields }
      delete next.project_id
      setForm(next)
      original.current = next
    } catch (e) { showToast(e.message, true); setEditing(null) } finally { setLoadingDetail(false) }
  }

  const dirtyKeys = useMemo(
    () => Object.keys(form).filter((k) => (form[k] || '') !== (original.current[k] || '')),
    [form],
  )
  const dirty = dirtyKeys.length > 0

  async function save() {
    if (!editing || !dirty) return
    const visibleKeys = new Set(
      EDIT_SECTIONS.filter((s) => !s.showIf || s.showIf(form))
        .flatMap((s) => s.fields).filter((f) => !f.showIf || f.showIf(form))
        .map((f) => f.k),
    )
    const payload = { project_id: editing.project_id }
    dirtyKeys.forEach((k) => { if (visibleKeys.has(k)) payload[k] = form[k] })
    if (Object.keys(payload).length === 1) return showToast('No visible changes to save', true)

    setSaving(true)
    try {
      await apiFetch('/api/funnel', { method: 'PATCH', body: JSON.stringify(payload) })
      showToast('Project updated')
      setEditing(null)
      load()
      loadSummary()
    } catch (e) { showToast(e.message, true) } finally { setSaving(false) }
  }

  function onAdded() {
    setView('manage')
    setPage(1)
    load()
    loadSummary()
  }

  const activeNow = isActive(form.is_active)

  return (
    <>
      <div className="page-heading">
        <h1>Projects <span className="tag">PM tools</span></h1>
        <p className="subtitle">Add new funnel projects and browse or edit every existing one — IL stage, status, savings and more.</p>
      </div>

      <div className="mp-tabrow">
        <div className="mp-viewtabs">
          <button className={view === 'manage' ? 'active' : ''} onClick={() => setView('manage')}>
            <i className="fa-solid fa-table-list" /> Manage Projects
          </button>
          <button className={view === 'add' ? 'active' : ''} onClick={() => setView('add')}>
            <i className="fa-solid fa-plus" /> Add Project
          </button>
        </div>
        <a className="mp-export" href="/api/funnel/export" download>
          <i className="fa-solid fa-file-arrow-down" /> Download CSV
        </a>
      </div>

      {view === 'add' ? (
        <AddProjectForm meta={meta} onAdded={onAdded} />
      ) : (
        <>
          <div className="mp-stats">
            <div className="mp-stat">
              <div className="mp-stat-ic blue"><i className="fa-solid fa-diagram-project" /></div>
              <div><span className="mp-stat-val">{summary.total.toLocaleString()}</span><span className="mp-stat-lbl">{bu ? `Projects in ${bu}` : 'Total Projects'}</span></div>
            </div>
            <div className="mp-stat">
              <div className="mp-stat-ic indigo"><i className="fa-solid fa-bullseye" /></div>
              <div><span className="mp-stat-val">{achievement}%</span><span className="mp-stat-lbl">Savings Achieved <span className="mp-stat-sub">actual vs funnel</span></span></div>
            </div>
            <div className="mp-stat">
              <div className="mp-stat-ic amber"><i className="fa-solid fa-coins" /></div>
              <div><span className="mp-stat-val" title={EUR.format(summary.funnel_total)}>{euroCompact(summary.funnel_total)}</span><span className="mp-stat-lbl">Funnel Savings</span></div>
            </div>
            <div className="mp-stat">
              <div className="mp-stat-ic teal"><i className="fa-solid fa-sack-dollar" /></div>
              <div><span className="mp-stat-val" title={EUR.format(summary.actual_total)}>{euroCompact(summary.actual_total)}</span><span className="mp-stat-lbl">Actual Savings</span></div>
            </div>
            <div className="mp-stat">
              <div className="mp-stat-ic green"><i className="fa-solid fa-circle-check" /></div>
              <div><span className="mp-stat-val">{summary.active.toLocaleString()}</span><span className="mp-stat-lbl">Active <span className="mp-stat-sub">/ {summary.inactive.toLocaleString()} inactive</span></span></div>
            </div>
          </div>

          <div className="card">
            <div className="mp-toolbar">
              <div className="field mp-tb-search">
                <label>Search</label>
                <div className="search-box">
                  <i className="fa-solid fa-magnifying-glass" />
                  <input type="text" placeholder="Search by project id or title…" value={q}
                    onChange={(e) => setQ(e.target.value)} autoComplete="off" />
                </div>
              </div>
              <div className="field">
                <label>Business Unit</label>
                <Combobox items={summary.bus.map((b) => ({ value: b.bu, label: b.bu }))}
                  value={bu} onSelect={(v) => setBu(v)} allLabel="All BUs" placeholder="All BUs" icon="fa-building" width={190} />
              </div>
              <div className="field">
                <label>SPOC</label>
                <Combobox items={summary.spocs.map((s) => ({ value: s.spoc, label: s.spoc }))}
                  value={spoc} onSelect={(v) => setSpoc(v)} allLabel="All SPOCs" placeholder="Search SPOC…" icon="fa-user" width={210} />
              </div>
              <div className="field">
                <label>Status</label>
                <Combobox items={[{ value: 'yes', label: 'Active' }, { value: 'no', label: 'Inactive' }]}
                  value={active} onSelect={(v) => setActive(v)} allLabel="All statuses" placeholder="All statuses" icon="fa-toggle-on" width={160} />
              </div>
              {hasFilters && (
                <button className="mp-clear" type="button" onClick={() => { setQ(''); setBu(''); setSpoc(''); setActive('') }}>
                  <i className="fa-solid fa-xmark" /> Clear
                </button>
              )}
              <span className="mp-count">
                {loading ? 'Loading…' : `${from}–${to} of ${data.total} project${data.total === 1 ? '' : 's'}`}
              </span>
            </div>

            <div className="mp-table-wrap">
              <table className="mp-table">
                <thead>
                  <tr>
                    <th>Project ID</th>
                    <th>Title</th>
                    <th>Business Unit</th>
                    <th>SPOC</th>
                    <th>Current IL</th>
                    <th className="mp-th-num">Funnel (€)</th>
                    <th>Status</th>
                    <th aria-label="Edit" />
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((p) => (
                    <tr key={p.project_id} onClick={() => openEditor(p)}>
                      <td className="mp-td-id">{p.project_id}</td>
                      <td className="mp-td-title">{p.title || <span className="mp-muted">(no title)</span>}</td>
                      <td>{p.bu || <span className="mp-muted">—</span>}</td>
                      <td>{p.spoc || <span className="mp-muted">—</span>}</td>
                      <td>{p.current_il || <span className="mp-muted">—</span>}</td>
                      <td className="mp-td-num" title={p.funnel_total ? EUR.format(p.funnel_total) : ''}>
                        {p.funnel_total ? euroCompact(p.funnel_total) : <span className="mp-muted">—</span>}
                      </td>
                      <td>
                        <span className={`mp-badge ${isActive(p.is_active) ? 'on' : 'off'}`}>
                          {isActive(p.is_active) ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="mp-td-edit"><i className="fa-solid fa-pen-to-square" /></td>
                    </tr>
                  ))}
                  {!loading && data.items.length === 0 && (
                    <tr className="mp-norows"><td colSpan={8}>No projects match your filters.</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="mp-pager">
              <button className="btn btn-ghost" disabled={page <= 1 || loading} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                <i className="fa-solid fa-chevron-left" /> Prev
              </button>
              <span className="mp-pageinfo">Page {page} of {totalPages}</span>
              <button className="btn btn-ghost" disabled={page >= totalPages || loading} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
                Next <i className="fa-solid fa-chevron-right" />
              </button>
            </div>
          </div>
        </>
      )}

      {editing && (
        <Modal
          icon="fa-diagram-project"
          title={editing.title || '(no title)'}
          subtitle={`Project ${editing.project_id}`}
          onClose={() => setEditing(null)}
        >
          {loadingDetail ? (
            <div className="mp-empty"><i className="fa-solid fa-spinner fa-spin" /><p>Loading project…</p></div>
          ) : (
            <div className="mp-modal-pad">
              <div className="mp-modal-status">
                <span className={`mp-badge ${activeNow ? 'on' : 'off'}`}>{activeNow ? 'Active' : 'Inactive'}</span>
              </div>
              {EDIT_SECTIONS.filter((sec) => !sec.showIf || sec.showIf(form)).map((sec) => (
                <div className="form-section" key={sec.title}>
                  <div className="form-section-head"><i className={`fa-solid ${sec.icon}`} /><h3>{sec.title}</h3></div>
                  <div className="form-grid-3">
                    {sec.fields.filter((f) => !f.showIf || f.showIf(form)).map((f) => (
                      <FormField key={f.k} cfg={f} value={form[f.k] || ''} state={form}
                        onChange={(v) => setForm((s) => { const n = { ...s, [f.k]: v }; (f.clears || []).forEach((k) => { n[k] = '' }); return n })}
                        suggestions={f.list ? (meta[DL_META[f.list]] || []) : undefined} />
                    ))}
                  </div>
                </div>
              ))}
              <div className="mp-modal-actions">
                <span className="mp-dirty">{dirty ? `${dirtyKeys.length} unsaved change${dirtyKeys.length > 1 ? 's' : ''}` : 'No changes yet'}</span>
                <button className="btn btn-ghost" type="button" onClick={() => setForm(original.current)} disabled={!dirty}>Reset</button>
                <button className="btn btn-primary" type="button" onClick={save} disabled={saving || !dirty}>
                  <i className="fa-solid fa-floppy-disk" /> {saving ? 'Saving…' : 'Save changes'}
                </button>
              </div>
            </div>
          )}
        </Modal>
      )}
    </>
  )
}
