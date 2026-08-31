import { useEffect, useState } from 'react'
import { Bar, Doughnut, Line } from 'react-chartjs-2'
import { UTIL_COLORS, utilBand } from '../lib/charts'
import Combobox from '../components/Combobox'
import Modal from '../components/Modal'
import { apiFetch } from '../lib/api'
import { downloadCsv } from '../lib/export'
import { useToast } from '../context/ToastContext'

const STATUS_LABEL = { bench: 'Zero allocation', under: 'Under-utilized', healthy: 'Healthy', over: 'Over-allocated' }

function statCard(val, label, tone, onClick) {
  return (
    <div
      className={`stat ${tone || ''}${onClick ? ' clickable' : ''}`}
      onClick={onClick}
      title={onClick ? 'Click to see who' : undefined}
    >
      <div className="stat-val">{val}</div>
      <div className="stat-label">{label}{onClick && <i className="fa-solid fa-up-right-from-square stat-drill" />}</div>
    </div>
  )
}
function utilPill(util) {
  return <span className={`pill u-${utilBand(util)}`}>{util}%</span>
}

const noAspect = { responsive: true, maintainAspectRatio: false }

function ChartCard({ icon, title, children }) {
  return (
    <section className="card chart-card">
      <div className="chart-head"><i className={`fa-solid ${icon}`} /><h3>{title}</h3></div>
      <div className="chart-box">{children}</div>
    </section>
  )
}

export default function DashboardLeader() {
  const showToast = useToast()
  const [managers, setManagers] = useState([])
  const [manager, setManager] = useState('')
  const [month, setMonth] = useState('')
  const [currentMonth, setCurrentMonth] = useState(null)
  const [data, setData] = useState(null)
  const [drill, setDrill] = useState(null)
  const [drillData, setDrillData] = useState(null)
  const [drillLoading, setDrillLoading] = useState(false)
  const [drillQuery, setDrillQuery] = useState('')

  useEffect(() => {
    apiFetch('/api/managers').then(setManagers).catch((e) => showToast(e.message, true))
  }, [showToast])

  useEffect(() => {
    if (!drill) { setDrillData(null); return }
    setDrillLoading(true)
    const params = new URLSearchParams({ status: drill.status })
    if (manager) params.set('manager', manager)
    if (month) params.set('month', month)
    apiFetch('/api/dashboard/reportees-by-status?' + params.toString())
      .then(setDrillData)
      .catch((e) => showToast(e.message, true))
      .finally(() => setDrillLoading(false))
  }, [drill, manager, month, showToast])

  useEffect(() => {
    const params = new URLSearchParams()
    if (manager) params.set('manager', manager)
    if (month) params.set('month', month)
    apiFetch('/api/dashboard/people-leader?' + params.toString())
      .then((d) => {
        setData(d)
        if (!month && currentMonth == null) { setCurrentMonth(d.month); setMonth(d.month) }
      })
      .catch((e) => showToast(e.message, true))
  }, [manager, month, currentMonth, showToast])

  if (!data) return <div className="loading-wrap"><span className="spinner" /> Loading dashboard…</div>

  const isTeam = data.scope === 'team'
  const k = data.kpis
  const u = data.utilization
  const drillRows = (drillData?.rows || []).filter((r) => {
    const q = drillQuery.trim().toLowerCase()
    return !q || r.name.toLowerCase().includes(q) || r.reporting_manager.toLowerCase().includes(q)
  })

  function exportDrill() {
    const monthLabel = drillData?.month || data.month
    const scope = isTeam ? data.scope_label : 'All teams'
    const safe = `${drill.label}_${scope}_${monthLabel}`.replace(/[^\w]+/g, '-')
    downloadCsv(`${safe}.csv`, [
      { header: 'Name', value: (r) => r.name },
      { header: 'Job Title', value: (r) => r.job_title },
      { header: 'Reports To', value: (r) => r.reporting_manager },
      { header: 'Location', value: (r) => r.location },
      { header: 'Projects', value: (r) => r.projects },
      { header: 'Utilization %', value: (r) => r.util },
    ], drillRows)
  }
  const teamUtilRows = isTeam
    ? data.by_reportee.map((r) => ({ manager: r.name, avg_util: r.util })).slice(0, 12)
    : data.by_manager.slice(0, 12)

  const mixData = {
    labels: ['Zero allocation (0%)', 'Under-utilized (<80%)', 'Healthy (80-100%)', 'Over-allocated (>100%)'],
    datasets: [{
      data: [u.bench, u.under, u.healthy, u.over],
      backgroundColor: [UTIL_COLORS.bench, UTIL_COLORS.under, UTIL_COLORS.healthy, UTIL_COLORS.over],
      borderWidth: 2, borderColor: '#fff',
    }],
  }

  const trendData = {
    labels: data.trend.map((r) => r.month),
    datasets: [{
      label: 'Avg utilization',
      data: data.trend.map((r) => r.avg_util),
      borderColor: '#0b5ed7',
      backgroundColor: 'rgba(11, 94, 215, .12)',
      fill: true, tension: 0.35,
      pointRadius: data.trend.map((r) => (r.month === data.month ? 5 : 3)),
      pointBackgroundColor: data.trend.map((r) => (r.month === data.month ? '#0a2e6b' : '#0b5ed7')),
    }],
  }

  const capacityData = isTeam
    ? {
      labels: data.by_reportee.slice(0, 14).map((r) => r.name),
      datasets: [{ label: 'Projects', data: data.by_reportee.slice(0, 14).map((r) => r.projects), backgroundColor: '#5b8def', borderRadius: 5, maxBarThickness: 22 }],
    }
    : {
      labels: teamUtilRows.map((r) => r.manager),
      datasets: [
        { label: 'Team size', data: teamUtilRows.map((r) => r.team_size), backgroundColor: '#c7d7f0', borderRadius: 5, maxBarThickness: 22 },
        { label: 'Allocated', data: teamUtilRows.map((r) => r.allocated), backgroundColor: '#0b5ed7', borderRadius: 5, maxBarThickness: 22 },
      ],
    }

  return (
    <>
      <div className="page-heading">
        <h1>Allocation Dashboard <span className="tag">People leader</span></h1>
        <p className="subtitle">Team utilization, capacity coverage and bench risk across reportees.</p>
      </div>

      <section className="card no-pad">
        <div className="toolbar">
          <div className="field">
            <label>Team</label>
            <Combobox
              items={managers.map((m) => ({ value: m.value, label: m.label, sub: `${m.reportees} reportees` }))}
              value={manager}
              onSelect={(v) => setManager(v)}
              allLabel="All teams"
              placeholder="All teams"
              icon="fa-user-tie"
              avatar
            />
          </div>
          <div className="field">
            <label>Month</label>
            <Combobox
              items={data.months}
              value={month}
              onSelect={(v) => setMonth(v || currentMonth || '')}
              allLabel="Current month"
              placeholder="Select month"
              icon="fa-calendar-day"
              width={180}
            />
          </div>
          <button className="btn btn-ghost" onClick={() => { setManager(''); if (currentMonth) setMonth(currentMonth) }}>
            <i className="fa-solid fa-rotate-left" /> Reset
          </button>
          <span className="toolbar-note">{month === currentMonth ? 'Showing current month' : ''}</span>
        </div>

        <div className="stat-row kpi-grid">
          {isTeam
            ? statCard(k.reportees, 'Reportees')
            : <>{statCard(k.leaders, 'People Leaders')}{statCard(k.reportees, 'Reportees')}</>}
          {statCard(`${k.avg_util}%`, 'Avg Utilization')}
          {statCard(k.fully_allocated, 'Fully Allocated', 'accent', () => setDrill({ status: 'fully', label: 'Fully Allocated' }))}
          {statCard(k.over_allocated, 'Over-allocated', 'deep', () => setDrill({ status: 'over', label: 'Over-allocated' }))}
          {statCard(k.bench, 'Zero Allocation', 'soft', () => setDrill({ status: 'bench', label: 'Zero Allocation' }))}
        </div>
        <div style={{ height: 20 }} />
      </section>

      <div className="chart-grid">
        <ChartCard icon="fa-chart-bar" title={isTeam ? 'Reportee Utilization' : 'Team Utilization by Manager'}>
          <Bar
            data={{
              labels: teamUtilRows.map((r) => r.manager),
              datasets: [{ data: teamUtilRows.map((r) => r.avg_util), backgroundColor: teamUtilRows.map((r) => UTIL_COLORS[utilBand(r.avg_util)]), borderRadius: 6, maxBarThickness: 26 }],
            }}
            options={{
              ...noAspect, indexAxis: 'y',
              plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => ` ${c.parsed.x}% avg utilization` } } },
              scales: { x: { beginAtZero: true, suggestedMax: 100, ticks: { callback: (v) => v + '%' }, grid: { color: '#eef2f8' } }, y: { grid: { display: false } } },
            }}
          />
        </ChartCard>

        <ChartCard icon="fa-chart-pie" title="Utilization Mix">
          <Doughnut
            data={mixData}
            options={{ ...noAspect, cutout: '58%', plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, padding: 12, font: { size: 11.5 } } }, tooltip: { callbacks: { label: (c) => ` ${c.label}: ${c.parsed} reportees` } } } }}
          />
        </ChartCard>

        <ChartCard icon="fa-arrow-trend-up" title={isTeam ? `Team Utilization Trend — ${data.scope_label}` : 'Utilization Trend (12 Months)'}>
          <Line
            data={trendData}
            options={{
              ...noAspect,
              plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => ` ${c.parsed.y}% avg utilization` } } },
              scales: { y: { beginAtZero: true, suggestedMax: 100, ticks: { callback: (v) => v + '%' }, grid: { color: '#eef2f8' } }, x: { grid: { display: false } } },
            }}
          />
        </ChartCard>

        <ChartCard icon="fa-users-gear" title={isTeam ? 'Projects per Reportee' : 'Team Size vs Allocated Reportees'}>
          <Bar
            data={capacityData}
            options={{
              ...noAspect,
              plugins: { legend: { display: isTeam ? false : true, position: 'bottom', labels: { boxWidth: 12, padding: 12, font: { size: 11.5 } } } },
              scales: { y: { beginAtZero: true, ticks: { precision: 0 }, grid: { color: '#eef2f8' } }, x: { grid: { display: false }, ticks: { font: { size: 10 } } } },
            }}
          />
        </ChartCard>
      </div>

      <h3 className="section-label">{isTeam ? `Reportees — ${data.scope_label}` : 'Team Breakdown'}</h3>
      <section className="card no-pad">
        <div className="table-wrap">
          <table className="data-table">
            {isTeam ? (
              <>
                <thead><tr><th>Reportee</th><th>Job Title</th><th>Projects</th><th>Utilization</th><th>Status</th></tr></thead>
                <tbody>
                  {data.by_reportee.length === 0
                    ? <tr className="empty-row"><td colSpan={5}>No reportees.</td></tr>
                    : data.by_reportee.map((r, i) => (
                      <tr key={`${r.name}-${i}`}>
                        <td><strong>{r.name}</strong></td>
                        <td>{r.job_title || '—'}</td>
                        <td>{r.projects}</td>
                        <td>{utilPill(r.util)}</td>
                        <td><span className={`pill u-${r.status}`}>{STATUS_LABEL[r.status]}</span></td>
                      </tr>
                    ))}
                </tbody>
              </>
            ) : (
              <>
                <thead><tr><th>Reporting Manager</th><th>Team Size</th><th>Allocated</th><th>On Bench</th><th>Over-allocated</th><th>Avg Utilization</th><th>Coverage</th></tr></thead>
                <tbody>
                  {data.by_manager.length === 0
                    ? <tr className="empty-row"><td colSpan={7}>No data.</td></tr>
                    : data.by_manager.map((r, i) => {
                      const coverage = r.team_size ? Math.round((r.allocated / r.team_size) * 100) : 0
                      return (
                        <tr key={`${r.manager}-${i}`}>
                          <td><strong>{r.manager}</strong></td>
                          <td>{r.team_size}</td>
                          <td>{r.allocated}</td>
                          <td>{r.team_size - r.allocated}</td>
                          <td>{r.over ? <span className="pill u-over">{r.over}</span> : '0'}</td>
                          <td>{utilPill(r.avg_util)}</td>
                          <td><div className="coverage-bar"><span style={{ width: `${coverage}%` }} /></div><span className="coverage-txt">{coverage}%</span></td>
                        </tr>
                      )
                    })}
                </tbody>
              </>
            )}
          </table>
        </div>
      </section>

      {drill && (
        <Modal
          icon="fa-user-group"
          title={`${drill.label} — ${drillData ? drillData.count : '…'} ${drillData && drillData.count === 1 ? 'person' : 'people'}`}
          subtitle={`${isTeam ? data.scope_label + ' · ' : 'All teams · '}${drillData?.month || data.month}`}
          onClose={() => setDrill(null)}
        >
          <div className="modal-toolbar">
            <div className="modal-search-box">
              <i className="fa-solid fa-magnifying-glass" />
              <input type="text" placeholder="Search name or manager…" value={drillQuery} onChange={(e) => setDrillQuery(e.target.value)} />
            </div>
            <button className="btn btn-outline" onClick={exportDrill} disabled={!drillRows.length}>
              <i className="fa-solid fa-file-excel" /> Export to Excel
            </button>
          </div>
          {drillLoading ? (
            <div className="loading-wrap"><span className="spinner" /> Loading…</div>
          ) : drillRows.length === 0 ? (
            <div className="modal-empty">No people found.</div>
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr><th>Name</th><th>Job Title</th><th>Reports To</th><th>Location</th><th>Projects</th><th>Utilization</th></tr>
                </thead>
                <tbody>
                  {drillRows.map((r, i) => (
                    <tr key={`${r.name}-${i}`}>
                      <td><strong>{r.name}</strong></td>
                      <td>{r.job_title || '—'}</td>
                      <td>{r.reporting_manager}</td>
                      <td>{r.location || '—'}</td>
                      <td>{r.projects}</td>
                      <td>{utilPill(r.util)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Modal>
      )}
    </>
  )
}
