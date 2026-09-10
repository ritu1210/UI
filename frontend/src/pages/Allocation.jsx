import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Combobox from '../components/Combobox'
import RowCombobox from '../components/RowCombobox'
import { apiFetch } from '../lib/api'
import { allocatableMonths, MONTHS } from '../lib/constants'
import { useToast } from '../context/ToastContext'

const ALLOCATABLE = allocatableMonths()

function allocPill(v) {
  const cls = v >= 75 ? 'high' : v >= 40 ? '' : 'warn'
  return <span className={`pill ${cls}`}>{v}%</span>
}

function SavedRow({ a, onEdit, onCopy, onDelete }) {
  return (
    <tr>
      <td>{a.employee}</td>
      <td className="proj-id-cell">{a.project_id}</td>
      <td>{a.project_title}</td>
      <td>{a.month}</td>
      <td>{allocPill(a.allocation)}</td>
      <td className="col-actions">
        <button className="row-btn edit" title="Edit" onClick={() => onEdit(a.id)}><i className="fa-solid fa-pen" /></button>
        <button className="row-btn copy" title="Copy to a new allocation" onClick={() => onCopy(a)}><i className="fa-solid fa-copy" /></button>
        <button className="row-btn del" title="Delete" onClick={() => onDelete(a.id)}><i className="fa-solid fa-trash-can" /></button>
      </td>
    </tr>
  )
}

function AllocationRow({ mode, employee = '', pid = '', title = '', month = '', alloc = 100, empSource, projSource, onSave, onCancel, onActivate }) {
  const showToast = useToast()
  const locked = mode === 'roster'
  const [emp, setEmp] = useState(employee)
  const [projId, setProjId] = useState(pid)
  const [projTitle, setProjTitle] = useState(title)
  const [mon, setMon] = useState(month)
  const [al, setAl] = useState(alloc)

  function activate() {
    if (onActivate) onActivate((project) => { setProjId(project.project_id); setProjTitle(project.title || '') })
  }

  function save() {
    const employeeVal = (locked ? employee : emp).trim()
    if (!employeeVal) return showToast('Please select an employee', true)
    if (!projId) return showToast('Please select a project', true)
    if (!mon) return showToast('Please select a month', true)
    const a = parseFloat(al)
    if (Number.isNaN(a) || a < 0 || a > 100) return showToast('Allocation must be 0-100', true)
    onSave({ employee: employeeVal, project_id: projId, month: mon, allocation: a })
  }

  return (
    <tr className={locked ? 'roster-row' : 'editing'} onFocus={activate}>
      <td>
        {locked
          ? <div className="ros-emp">{employee}</div>
          : <RowCombobox initialValue={emp} placeholder="Search employee…" source={empSource} onPick={(it) => setEmp(it.value)} />}
      </td>
      <td className="proj-id-cell">
        <RowCombobox
          key={`p-${projId}`}
          initialValue={projId}
          placeholder="Search project…"
          source={projSource}
          onPick={(it) => { setProjId(it.value); setProjTitle(it.sub || '') }}
        />
      </td>
      <td className={projTitle ? '' : 'muted'}>{projTitle || 'Type or pick a project'}</td>
      <td>
        <select value={mon} onChange={(e) => setMon(e.target.value)}>
          <option value="">Select month</option>
          {ALLOCATABLE.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
      </td>
      <td><input type="number" className="alloc-input" min="0" max="100" value={al} onChange={(e) => setAl(e.target.value)} /></td>
      <td className="col-actions">
        <button className="row-btn save" title="Save allocation" onClick={save}><i className="fa-solid fa-floppy-disk" /></button>
        {!locked && <button className="row-btn cancel" title="Cancel" onClick={onCancel}><i className="fa-solid fa-xmark" /></button>}
      </td>
    </tr>
  )
}

export default function Allocation() {
  const showToast = useToast()
  const [managers, setManagers] = useState([])
  const [managerValue, setManagerValue] = useState('')
  const [allocations, setAllocations] = useState([])
  const [reportees, setReportees] = useState([])
  const [managerLoaded, setManagerLoaded] = useState(false)
  const [employeeFilter, setEmployeeFilter] = useState('')
  const [monthFilter, setMonthFilter] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [showDraft, setShowDraft] = useState(false)
  const [draftSeed, setDraftSeed] = useState(null)
  const [draftKey, setDraftKey] = useState(0)

  function openDraft(seed) {
    setDraftSeed(seed)
    setDraftKey((k) => k + 1)
    setEditingId(null)
    setShowDraft(true)
  }

  const [projects, setProjects] = useState([])
  const [projTotal, setProjTotal] = useState(null)
  const [projQuery, setProjQuery] = useState('')

  const activeFiller = useRef(null)

  useEffect(() => {
    apiFetch('/api/managers').then(setManagers).catch((e) => showToast(e.message, true))
  }, [showToast])

  const loadProjects = useCallback(async (q = '') => {
    const url = q ? `/api/projects?q=${encodeURIComponent(q)}&limit=100000` : '/api/projects?limit=100000'
    const list = await apiFetch(url)
    setProjects(list)
    if (!q) setProjTotal(list.length)
  }, [])

  useEffect(() => { loadProjects().catch((e) => showToast(e.message, true)) }, [loadProjects, showToast])

  useEffect(() => {
    const t = setTimeout(() => { loadProjects(projQuery.trim()).catch(() => {}) }, 250)
    return () => clearTimeout(t)
  }, [projQuery, loadProjects])

  const loadAllocations = useCallback(async (manager) => {
    if (!manager) {
      setAllocations([]); setReportees([]); setManagerLoaded(false); setEmployeeFilter('')
      return
    }
    const [allocs, reps] = await Promise.all([
      apiFetch(`/api/allocations?manager=${encodeURIComponent(manager)}`),
      apiFetch(`/api/reportees?manager=${encodeURIComponent(manager)}`),
    ])
    setAllocations(allocs)
    setReportees(reps)
    setManagerLoaded(true)
    setEmployeeFilter('')
  }, [])

  function onManagerSelect(val) {
    setManagerValue(val)
    setEmployeeFilter('')
    setMonthFilter('')
    setEditingId(null)
    setShowDraft(false)
    loadAllocations(val).catch((e) => showToast(e.message, true))
  }

  function clearFilters() {
    setManagerValue('')
    setEmployeeFilter('')
    setMonthFilter('')
    setManagerLoaded(false)
    setAllocations([])
    setReportees([])
    setEditingId(null)
    setShowDraft(false)
  }

  const empSource = useCallback(async (q) => {
    const base = managerLoaded && reportees.length ? reportees.map((r) => r.name) : []
    const n = (q || '').toLowerCase()
    const list = n ? base.filter((e) => e.toLowerCase().includes(n)) : base
    return list.slice(0, 300).map((e) => ({ value: e, label: e }))
  }, [managerLoaded, reportees])

  const projSource = useCallback(async (q) => {
    const url = q ? `/api/projects?q=${encodeURIComponent(q)}&limit=300` : '/api/projects?limit=300'
    const list = await apiFetch(url)
    return list.map((p) => ({ value: p.project_id, label: p.project_id, sub: p.title }))
  }, [])

  async function saveNew(payload) {
    try {
      await apiFetch('/api/allocations', { method: 'POST', body: JSON.stringify(payload) })
      showToast('Allocation added')
      setShowDraft(false)
      await loadAllocations(managerValue)
    } catch (e) { showToast(e.message, true) }
  }

  async function saveEdit(id, payload) {
    try {
      await apiFetch(`/api/allocations/${id}`, { method: 'PATCH', body: JSON.stringify(payload) })
      showToast('Allocation updated')
      setEditingId(null)
      await loadAllocations(managerValue)
    } catch (e) { showToast(e.message, true) }
  }

  async function deleteRow(id) {
    if (!window.confirm('Delete this allocation?')) return
    try {
      await apiFetch(`/api/allocations/${id}`, { method: 'DELETE' })
      showToast('Allocation deleted')
      await loadAllocations(managerValue)
    } catch (e) { showToast(e.message, true) }
  }

  const rosterRows = useMemo(() => {
    const byEmp = {}
    allocations.forEach((a) => {
      if (!byEmp[a.employee]) byEmp[a.employee] = new Map()
      byEmp[a.employee].set(a.project_id, a.project_title)
    })
    const rows = []
    reportees.forEach((r) => {
      const projs = byEmp[r.name]
      if (projs && projs.size) {
        projs.forEach((title, pid) => rows.push({ emp: r.name, pid, title }))
      } else {
        rows.push({ emp: r.name, pid: '', title: '' })
      }
    })
    return rows
  }, [allocations, reportees])

  const savedRows = allocations.filter((a) => (!employeeFilter || a.employee === employeeFilter) && (!monthFilter || a.month === monthFilter))
  const filteredRoster = rosterRows.filter((r) => !employeeFilter || r.emp === employeeFilter)

  const managerItems = managers.map((m) => ({ value: m.value, label: m.label, sub: `${m.reportees} reportee${m.reportees === 1 ? '' : 's'}` }))
  const employeeItems = reportees.map((r) => r.name)

  function onActivate(filler) { activeFiller.current = filler }
  function applyProject(project) {
    if (activeFiller.current) activeFiller.current(project)
    else showToast('Click "Add Allocation" or a row first', true)
  }

  return (
    <>
      <div className="page-heading with-actions">
        <div>
          <h1>Project Allocation <span className="tag">Monthly</span></h1>
          <p className="subtitle">Select a reporting manager to load their reportees, then allocate them to projects.</p>
        </div>
        <button className="btn btn-primary" onClick={() => openDraft(null)}>
          <i className="fa-solid fa-plus" /> Add Allocation
        </button>
      </div>

      <div className="grid grid-alloc">
        <section className="card no-pad">
          <div className="toolbar">
            <div className="field">
              <label>Reporting Manager</label>
              <Combobox items={managerItems} value={managerValue} onSelect={onManagerSelect} allLabel="None" placeholder="Select manager…" icon="fa-user-tie" avatar />
            </div>
            <div className="field">
              <label>Employee</label>
              <Combobox items={employeeItems} value={employeeFilter} onSelect={(v) => setEmployeeFilter(v)} allLabel="All employees" placeholder="All employees" icon="fa-user" />
            </div>
            <div className="field">
              <label>Month</label>
              <Combobox items={MONTHS} value={monthFilter} onSelect={(v) => setMonthFilter(v)} allLabel="All months" placeholder="All months" width={180} icon="fa-calendar-day" />
            </div>
            <button className="btn btn-ghost" onClick={clearFilters}><i className="fa-solid fa-filter-circle-xmark" /> Clear</button>
          </div>

          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Project ID</th>
                  <th>Project Title</th>
                  <th>Month</th>
                  <th>Allocation</th>
                  <th className="col-actions">Actions</th>
                </tr>
              </thead>
              <tbody>
                {!managerLoaded && !showDraft && (
                  <tr className="empty-row">
                    <td colSpan={6}><i className="fa-solid fa-user-tie" />&nbsp; Select a <strong>Reporting Manager</strong> above to load their reportees.</td>
                  </tr>
                )}

                {showDraft && (
                  <AllocationRow
                    key={`draft-${draftKey}`}
                    mode="draft"
                    employee={draftSeed?.employee || ''}
                    pid={draftSeed?.pid || ''}
                    title={draftSeed?.title || ''}
                    alloc={draftSeed?.alloc ?? 100}
                    empSource={empSource}
                    projSource={projSource}
                    onActivate={onActivate}
                    onSave={saveNew}
                    onCancel={() => setShowDraft(false)}
                  />
                )}

                {managerLoaded && savedRows.length > 0 && (
                  <tr className="section-head">
                    <td colSpan={6}>
                      <span className="sh-title"><i className="fa-solid fa-clock-rotate-left" /> Previous month allocation</span>
                      <span className="sh-hint">{savedRows.length} row{savedRows.length === 1 ? '' : 's'}</span>
                    </td>
                  </tr>
                )}
                {managerLoaded && savedRows.map((a) => (
                  editingId === a.id ? (
                    <AllocationRow
                      key={`edit-${a.id}`}
                      mode="edit"
                      employee={a.employee}
                      pid={a.project_id}
                      title={a.project_title}
                      month={a.month}
                      alloc={a.allocation}
                      empSource={empSource}
                      projSource={projSource}
                      onActivate={onActivate}
                      onSave={(payload) => saveEdit(a.id, payload)}
                      onCancel={() => setEditingId(null)}
                    />
                  ) : (
                    <SavedRow key={a.id} a={a} onEdit={setEditingId} onCopy={(row) => openDraft({ employee: row.employee, pid: row.project_id, title: row.project_title, alloc: row.allocation })} onDelete={deleteRow} />
                  )
                ))}

                {managerLoaded && filteredRoster.map((r) => (
                  <AllocationRow
                    key={`roster-${r.emp}-${r.pid}`}
                    mode="roster"
                    employee={r.emp}
                    pid={r.pid}
                    title={r.title}
                    empSource={empSource}
                    projSource={projSource}
                    onActivate={onActivate}
                    onSave={saveNew}
                  />
                ))}

                {managerLoaded && savedRows.length === 0 && filteredRoster.length === 0 && !showDraft && (
                  <tr className="empty-row"><td colSpan={6}>No reportees found for this manager.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="card search-panel">
          <div className="card-head">
            <i className="fa-solid fa-magnifying-glass" />
            <h2>Project Search</h2>
          </div>
          <div className="search-box">
            <i className="fa-solid fa-magnifying-glass" />
            <input placeholder="Search project id or title…" value={projQuery} onChange={(e) => setProjQuery(e.target.value)} />
          </div>
          <span className="proj-count">
            {projQuery
              ? `Showing ${projects.length} of ${projTotal ?? projects.length} projects`
              : `${projects.length} projects in funnel`}
          </span>
          <div className="proj-list">
            {projects.length === 0
              ? <p className="muted" style={{ padding: 8 }}>No projects found.</p>
              : projects.map((p) => (
                <div key={p.project_id} className="proj-item" onClick={() => applyProject(p)}>
                  <div className="pid">{p.project_id}</div>
                  <div className="ptitle">{p.title || '(no title)'}</div>
                  <div className="pmeta">{p.bu || '-'} &middot; {p.project_type || '-'} &middot; {p.spoc || '-'}</div>
                </div>
              ))}
          </div>
        </aside>
      </div>
    </>
  )
}
