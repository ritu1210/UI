import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { apiFetch } from '../lib/api'
import { useToast } from '../context/ToastContext'
import Modal from '../components/Modal'
import Combobox from '../components/Combobox'
import { HEADCOUNT_SECTIONS, DL_META, FormField } from './DataEntry'

const PAGE_SIZE = 25

function blankPerson() {
  const s = {}
  HEADCOUNT_SECTIONS.forEach((sec) => sec.fields.forEach((f) => { s[f.k] = '' }))
  return s
}

function prettyName(email) {
  if (!email) return ''
  if (!email.includes('@')) return email
  return email.split('@')[0].split(/[._]/).filter(Boolean).map((p) => p[0].toUpperCase() + p.slice(1)).join(' ')
}

const EMPTY_SUMMARY = { total: 0, managers_count: 0, directors_count: 0, countries_count: 0, directors: [], managers: [], countries: [] }

function AddPersonForm({ meta, onAdded }) {
  const showToast = useToast()
  const [form, setForm] = useState(blankPerson)
  const [saving, setSaving] = useState(false)
  const set = (k) => (v) => setForm((s) => ({ ...s, [k]: v }))

  async function submit(e) {
    e.preventDefault()
    const fields = HEADCOUNT_SECTIONS.flatMap((s) => s.fields)
    const missing = fields.find((f) => f.required && !String(form[f.k] || '').trim())
    if (missing) return showToast(`${missing.label} is required`, true)
    setSaving(true)
    try {
      const p = await apiFetch('/api/headcount', { method: 'POST', body: JSON.stringify(form) })
      showToast('Employee added to headcount')
      setForm(blankPerson())
      onAdded(p)
    } catch (err) { showToast(err.message, true) } finally { setSaving(false) }
  }

  return (
    <form className="card mp-add" onSubmit={submit}>
      {HEADCOUNT_SECTIONS.map((sec) => (
        <div className="form-section" key={sec.title}>
          <div className="form-section-head"><i className={`fa-solid ${sec.icon}`} /><h3>{sec.title}</h3></div>
          <div className="form-grid-3">
            {sec.fields.map((f) => (
              <FormField key={f.k} cfg={f} value={form[f.k] || ''} onChange={set(f.k)}
                suggestions={f.list ? (meta[DL_META[f.list]] || []) : undefined} />
            ))}
          </div>
        </div>
      ))}
      <div className="mp-add-actions">
        <button className="btn btn-ghost" type="button" onClick={() => setForm(blankPerson())}>Clear</button>
        <button className="btn btn-primary" type="submit" disabled={saving}>
          <i className="fa-solid fa-user-plus" /> {saving ? 'Adding…' : 'Add to Headcount'}
        </button>
      </div>
    </form>
  )
}

export default function ManagePeople() {
  const showToast = useToast()
  const [view, setView] = useState('manage') // 'manage' | 'add'
  const [meta, setMeta] = useState({})
  const [q, setQ] = useState('')
  const [debouncedQ, setDebouncedQ] = useState('')
  const [director, setDirector] = useState('')
  const [manager, setManager] = useState('')
  const [country, setCountry] = useState('')
  const [page, setPage] = useState(1)
  const [data, setData] = useState({ items: [], total: 0, page: 1, size: PAGE_SIZE })
  const [summary, setSummary] = useState(EMPTY_SUMMARY)
  const [loading, setLoading] = useState(false)

  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(blankPerson())
  const original = useRef(blankPerson())
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    apiFetch('/api/meta').then(setMeta).catch((e) => showToast(e.message, true))
  }, [showToast])

  useEffect(() => {
    const t = setTimeout(() => { setDebouncedQ(q.trim()); setPage(1) }, 300)
    return () => clearTimeout(t)
  }, [q])

  useEffect(() => { setPage(1) }, [director, manager, country])

  const load = useCallback(() => {
    setLoading(true)
    const params = new URLSearchParams({ page: String(page), size: String(PAGE_SIZE) })
    if (debouncedQ) params.set('q', debouncedQ)
    if (director) params.set('director', director)
    if (manager) params.set('manager', manager)
    if (country) params.set('country', country)
    apiFetch(`/api/employees/page?${params.toString()}`)
      .then(setData).catch((e) => showToast(e.message, true)).finally(() => setLoading(false))
  }, [page, debouncedQ, director, manager, country, showToast])

  const loadSummary = useCallback(() => {
    const params = new URLSearchParams()
    if (debouncedQ) params.set('q', debouncedQ)
    if (director) params.set('director', director)
    if (manager) params.set('manager', manager)
    if (country) params.set('country', country)
    apiFetch(`/api/employees/summary?${params.toString()}`).then(setSummary).catch(() => {})
  }, [debouncedQ, director, manager, country])

  useEffect(() => { load() }, [load])
  useEffect(() => { loadSummary() }, [loadSummary])

  const totalPages = Math.max(1, Math.ceil(data.total / PAGE_SIZE))
  const from = data.total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const to = Math.min(page * PAGE_SIZE, data.total)
  const hasFilters = q || director || manager || country

  async function openEditor(p) {
    setEditing(p)
    setLoadingDetail(true)
    try {
      const detail = await apiFetch(`/api/employee?key=${encodeURIComponent(p.key)}`)
      const next = { ...blankPerson(), ...detail.fields }
      setForm(next)
      original.current = next
    } catch (e) { showToast(e.message, true); setEditing(null) } finally { setLoadingDetail(false) }
  }

  const set = (k) => (v) => setForm((s) => ({ ...s, [k]: v }))

  const dirtyKeys = useMemo(
    () => Object.keys(form).filter((k) => (form[k] || '') !== (original.current[k] || '')),
    [form],
  )
  const dirty = dirtyKeys.length > 0

  async function save() {
    if (!editing || !dirty) return
    const payload = { key: editing.key }
    dirtyKeys.forEach((k) => { payload[k] = form[k] })
    setSaving(true)
    try {
      await apiFetch('/api/headcount', { method: 'PATCH', body: JSON.stringify(payload) })
      showToast('Employee updated')
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

  return (
    <>
      <div className="page-heading">
        <h1>Headcount <span className="tag">PM tools</span></h1>
        <p className="subtitle">Add new team members and browse or edit every employee — role, manager, location and more.</p>
      </div>

      <div className="mp-tabrow">
        <div className="mp-viewtabs">
          <button className={view === 'manage' ? 'active' : ''} onClick={() => setView('manage')}>
            <i className="fa-solid fa-table-list" /> Manage People
          </button>
          <button className={view === 'add' ? 'active' : ''} onClick={() => setView('add')}>
            <i className="fa-solid fa-user-plus" /> Add Person
          </button>
        </div>
        <a className="mp-export" href="/api/headcount/export" download>
          <i className="fa-solid fa-file-arrow-down" /> Download CSV
        </a>
      </div>

      {view === 'add' ? (
        <AddPersonForm meta={meta} onAdded={onAdded} />
      ) : (
        <>
          <div className="mp-stats cols-4">
            <div className="mp-stat">
              <div className="mp-stat-ic blue"><i className="fa-solid fa-users" /></div>
              <div><span className="mp-stat-val">{summary.total.toLocaleString()}</span><span className="mp-stat-lbl">Total People</span></div>
            </div>
            <div className="mp-stat">
              <div className="mp-stat-ic indigo"><i className="fa-solid fa-user-tie" /></div>
              <div><span className="mp-stat-val">{summary.managers_count.toLocaleString()}</span><span className="mp-stat-lbl">People Leaders</span></div>
            </div>
            <div className="mp-stat">
              <div className="mp-stat-ic amber"><i className="fa-solid fa-user-shield" /></div>
              <div><span className="mp-stat-val">{summary.directors_count.toLocaleString()}</span><span className="mp-stat-lbl">Directors</span></div>
            </div>
            <div className="mp-stat">
              <div className="mp-stat-ic teal"><i className="fa-solid fa-location-dot" /></div>
              <div><span className="mp-stat-val">{summary.countries_count.toLocaleString()}</span><span className="mp-stat-lbl">Locations</span></div>
            </div>
          </div>

          <div className="card">
            <div className="mp-toolbar">
              <div className="field mp-tb-search">
                <label>Search</label>
                <div className="search-box">
                  <i className="fa-solid fa-magnifying-glass" />
                  <input type="text" placeholder="Search by name or email…" value={q}
                    onChange={(e) => setQ(e.target.value)} autoComplete="off" />
                </div>
              </div>
              <div className="field">
                <label>Reporting Manager</label>
                <Combobox items={summary.managers.map((m) => ({ value: m.value, label: m.label, sub: `${m.count} reportees` }))}
                  value={manager} onSelect={(v) => setManager(v)} allLabel="All managers" placeholder="Search manager…" icon="fa-user-tie" avatar width={210} />
              </div>
              <div className="field">
                <label>Director</label>
                <Combobox items={summary.directors.map((d) => ({ value: d.value, label: d.value, sub: `${d.count} people` }))}
                  value={director} onSelect={(v) => setDirector(v)} allLabel="All directors" placeholder="Search director…" icon="fa-user-shield" width={190} />
              </div>
              <div className="field">
                <label>Location</label>
                <Combobox items={summary.countries.map((l) => ({ value: l.value, label: l.value, sub: `${l.count} people` }))}
                  value={country} onSelect={(v) => setCountry(v)} allLabel="All locations" placeholder="Search location…" width={180} />
              </div>
              {hasFilters && (
                <button className="mp-clear" type="button" onClick={() => { setQ(''); setDirector(''); setManager(''); setCountry('') }}>
                  <i className="fa-solid fa-xmark" /> Clear
                </button>
              )}
              <span className="mp-count">
                {loading ? 'Loading…' : `${from}–${to} of ${data.total} ${data.total === 1 ? 'person' : 'people'}`}
              </span>
            </div>

            <div className="mp-table-wrap">
              <table className="mp-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Job Title</th>
                    <th>Reporting Manager</th>
                    <th>Director</th>
                    <th>Location</th>
                    <th>Status</th>
                    <th aria-label="Edit" />
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((p) => (
                    <tr key={p.key} onClick={() => openEditor(p)}>
                      <td className="mp-td-title">
                        <span className="mp-person">{p.name}</span>
                        {p.email && <span className="mp-person-sub">{p.email}</span>}
                      </td>
                      <td>{p.job_title || <span className="mp-muted">—</span>}</td>
                      <td>{prettyName(p.reporting_manager) || <span className="mp-muted">—</span>}</td>
                      <td>{p.director || <span className="mp-muted">—</span>}</td>
                      <td>{p.country || <span className="mp-muted">—</span>}</td>
                      <td>{p.status || <span className="mp-muted">—</span>}</td>
                      <td className="mp-td-edit"><i className="fa-solid fa-pen-to-square" /></td>
                    </tr>
                  ))}
                  {!loading && data.items.length === 0 && (
                    <tr className="mp-norows"><td colSpan={7}>No people match your filters.</td></tr>
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
          icon="fa-user"
          title={editing.name}
          subtitle={editing.email || editing.job_title || 'Employee'}
          onClose={() => setEditing(null)}
        >
          {loadingDetail ? (
            <div className="mp-empty"><i className="fa-solid fa-spinner fa-spin" /><p>Loading employee…</p></div>
          ) : (
            <div className="mp-modal-pad">
              {HEADCOUNT_SECTIONS.map((sec) => (
                <div className="form-section" key={sec.title}>
                  <div className="form-section-head"><i className={`fa-solid ${sec.icon}`} /><h3>{sec.title}</h3></div>
                  <div className="form-grid-3">
                    {sec.fields.map((f) => (
                      <FormField key={f.k} cfg={f} value={form[f.k] || ''} onChange={set(f.k)}
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
