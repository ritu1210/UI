import { useEffect, useMemo, useState } from 'react'
import { Bar } from 'react-chartjs-2'
import '../lib/charts'
import Combobox from '../components/Combobox'
import { apiFetch } from '../lib/api'
import { MONTHS } from '../lib/constants'
import { useToast } from '../context/ToastContext'

function Stat({ val, label, tone }) {
  return (
    <div className={`stat ${tone || ''}`}>
      <div className="stat-val">{val}</div>
      <div className="stat-label">{label}</div>
    </div>
  )
}

const barOptions = {
  indexAxis: 'y',
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: { callbacks: { label: (c) => ` ${c.parsed.x}% avg allocated` } },
  },
  scales: {
    x: { beginAtZero: true, max: 100, ticks: { callback: (v) => v + '%' }, grid: { color: '#eef2f8' } },
    y: { grid: { display: false } },
  },
}

function barData(rows) {
  return {
    labels: rows.map((r) => r.label),
    datasets: [{
      label: 'Average % Allocated',
      data: rows.map((r) => r.value),
      backgroundColor: '#0b5ed7',
      hoverBackgroundColor: '#2f7ff0',
      borderRadius: 6,
      maxBarThickness: 24,
    }],
  }
}

function ChartCard({ icon, title, rows }) {
  return (
    <section className="card chart-card">
      <div className="chart-head"><i className={`fa-solid ${icon}`} /><h3>{title}</h3></div>
      <div className="chart-box">
        {rows.length ? <Bar data={barData(rows)} options={barOptions} /> : <p className="muted" style={{ padding: 8 }}>No data for this selection</p>}
      </div>
    </section>
  )
}

export default function DashboardUser() {
  const showToast = useToast()
  const [managers, setManagers] = useState([])
  const [allEmployees, setAllEmployees] = useState([])
  const [reportees, setReportees] = useState(null)
  const [manager, setManager] = useState('')
  const [employee, setEmployee] = useState('')
  const [month, setMonth] = useState('')
  const [data, setData] = useState(null)

  useEffect(() => {
    Promise.all([apiFetch('/api/managers'), apiFetch('/api/employees')])
      .then(([m, e]) => { setManagers(m); setAllEmployees(e.map((x) => x.name)) })
      .catch((err) => showToast(err.message, true))
  }, [showToast])

  useEffect(() => {
    if (!manager) { setReportees(null); return }
    apiFetch(`/api/reportees?manager=${encodeURIComponent(manager)}`)
      .then((r) => setReportees(r.map((x) => x.name)))
      .catch((err) => showToast(err.message, true))
  }, [manager, showToast])

  useEffect(() => {
    const params = new URLSearchParams()
    if (manager) params.set('manager', manager)
    if (employee) params.set('employee', employee)
    if (month) params.set('month', month)
    apiFetch('/api/dashboard/user-breakdown?' + params.toString())
      .then(setData)
      .catch((err) => showToast(err.message, true))
  }, [manager, employee, month, showToast])

  const employeeOptions = useMemo(() => (reportees != null ? reportees : allEmployees), [reportees, allEmployees])

  function reset() { setManager(''); setEmployee(''); setMonth('') }

  return (
    <>
      <div className="page-heading">
        <h1>Allocation Dashboard <span className="tag">User specific</span></h1>
        <p className="subtitle">Average allocation broken down by cluster, business unit, project type and IL.</p>
      </div>

      <section className="card no-pad">
        <div className="toolbar">
          <div className="field">
            <label>Reporting Manager</label>
            <Combobox
              items={managers.map((m) => ({ value: m.value, label: m.label, sub: `${m.reportees} reportees` }))}
              value={manager}
              onSelect={(v) => { setManager(v); setEmployee('') }}
              allLabel="All managers"
              placeholder="All managers"
              icon="fa-user-tie"
              avatar
            />
          </div>
          <div className="field">
            <label>Employee</label>
            <Combobox
              items={employeeOptions}
              value={employee}
              onSelect={(v) => setEmployee(v)}
              allLabel="All employees"
              placeholder="All employees"
              icon="fa-user"
            />
          </div>
          <div className="field">
            <label>Month</label>
            <Combobox
              items={MONTHS}
              value={month}
              onSelect={(v) => setMonth(v)}
              allLabel="All months"
              placeholder="All months"
              icon="fa-calendar-day"
              width={180}
            />
          </div>
          <button className="btn btn-ghost" onClick={reset}><i className="fa-solid fa-rotate-left" /> Reset</button>
        </div>

        <div className="stat-row">
          <Stat val={data?.meta.allocations ?? 0} label="Allocations" />
          <Stat val={data?.meta.employees ?? 0} label="Employees" />
          <Stat val={`${data?.meta.avg ?? 0}%`} label="Average Allocated" />
        </div>
        <div style={{ height: 20 }} />
      </section>

      <div className="chart-grid">
        <ChartCard icon="fa-layer-group" title="Average Allocation by Cluster" rows={data?.by_cluster ?? []} />
        <ChartCard icon="fa-building" title="Average Allocation by Business Unit" rows={data?.by_bu ?? []} />
        <ChartCard icon="fa-diagram-project" title="Average Allocation by Project Type" rows={data?.by_project_type ?? []} />
        <ChartCard icon="fa-signal" title="Average Allocation by Current IL" rows={data?.by_il ?? []} />
      </div>
    </>
  )
}
