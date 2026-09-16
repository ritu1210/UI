import { useEffect, useState } from 'react'
import { Bar, Doughnut, Line } from 'react-chartjs-2'
import { BU_PALETTE, UTIL_COLORS, utilBand } from '../lib/charts'
import Combobox from '../components/Combobox'
import { apiFetch } from '../lib/api'
import { useToast } from '../context/ToastContext'

function statCard(val, label, tone) {
  return <div className={`stat ${tone || ''}`}><div className="stat-val">{val}</div><div className="stat-label">{label}</div></div>
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

export default function DashboardBusinessUnit() {
  const showToast = useToast()
  const [month, setMonth] = useState('')
  const [data, setData] = useState(null)

  useEffect(() => {
    const params = new URLSearchParams()
    if (month) params.set('month', month)
    apiFetch('/api/dashboard/business-unit?' + params.toString())
      .then(setData)
      .catch((e) => showToast(e.message, true))
  }, [month, showToast])

  if (!data) return <div className="loading-wrap"><span className="spinner" /> Loading dashboard…</div>

  const k = data.kpis
  const topAvg = data.by_bu.slice(0, 12)
  const topShare = data.by_bu.slice(0, 10)
  const peopleTotal = data.by_bu.reduce((s, r) => s + r.employees, 0) || 1

  return (
    <>
      <div className="page-heading">
        <h1>Allocation Dashboard <span className="tag">Business unit</span></h1>
        <p className="subtitle">Allocation, headcount and project spread across business units.</p>
      </div>

      <section className="card no-pad">
        <div className="toolbar">
          <div className="field">
            <label>Month</label>
            <Combobox
              items={data.months}
              value={month}
              onSelect={(v) => setMonth(v)}
              allLabel="All months"
              placeholder="All months"
              icon="fa-calendar-day"
              width={180}
            />
          </div>
          <button className="btn btn-ghost" onClick={() => setMonth('')}><i className="fa-solid fa-rotate-left" /> Reset</button>
          <span className="toolbar-note">{month ? `Showing ${month}` : 'Showing all months'}</span>
        </div>

        <div className="stat-row kpi-grid">
          {statCard(k.business_units, 'Business Units')}
          {statCard(k.total_employees, 'Total Employees')}
          {statCard(k.employees, 'Allocated Employees', 'accent')}
          {statCard(k.bench, 'People on Bench', 'deep')}
          {statCard(k.projects, 'Active Projects')}
        </div>
        <div style={{ height: 20 }} />
      </section>

      <div className="chart-grid">
        <ChartCard icon="fa-chart-bar" title="Average Allocation by BU">
          <Bar
            data={{ labels: topAvg.map((r) => r.bu), datasets: [{ data: topAvg.map((r) => r.avg_allocation), backgroundColor: topAvg.map((r) => UTIL_COLORS[utilBand(r.avg_allocation)]), borderRadius: 6, maxBarThickness: 26 }] }}
            options={{ ...noAspect, indexAxis: 'y', plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => ` ${c.parsed.x}% avg allocation` } } }, scales: { x: { beginAtZero: true, suggestedMax: 100, ticks: { callback: (v) => v + '%' }, grid: { color: '#eef2f8' } }, y: { grid: { display: false } } } }}
          />
        </ChartCard>

        <ChartCard icon="fa-chart-pie" title="People Allocated by BU">
          <Doughnut
            data={{ labels: topShare.map((r) => r.bu), datasets: [{ data: topShare.map((r) => r.employees), backgroundColor: topShare.map((_, i) => BU_PALETTE[i % BU_PALETTE.length]), borderWidth: 2, borderColor: '#fff' }] }}
            options={{ ...noAspect, cutout: '58%', plugins: { legend: { position: 'right', labels: { boxWidth: 12, padding: 10, font: { size: 11 } } }, tooltip: { callbacks: { label: (c) => ` ${c.label}: ${c.parsed} ${c.parsed === 1 ? 'person' : 'people'}` } } } }}
          />
        </ChartCard>

        <ChartCard icon="fa-arrow-trend-up" title="Total Allocation Trend (12 Months)">
          <Line
            data={{ labels: data.trend.map((r) => r.month), datasets: [{ label: 'Total allocation', data: data.trend.map((r) => r.total), borderColor: '#0b5ed7', backgroundColor: 'rgba(11, 94, 215, .12)', fill: true, tension: 0.35, pointRadius: 3, pointBackgroundColor: '#0b5ed7' }] }}
            options={{ ...noAspect, plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => ` ${c.parsed.y} allocation pts` } } }, scales: { y: { beginAtZero: true, grid: { color: '#eef2f8' } }, x: { grid: { display: false } } } }}
          />
        </ChartCard>

        <ChartCard icon="fa-users-between-lines" title="Employees vs Projects by BU">
          <Bar
            data={{ labels: topAvg.map((r) => r.bu), datasets: [{ label: 'Employees', data: topAvg.map((r) => r.employees), backgroundColor: '#0b5ed7', borderRadius: 5, maxBarThickness: 20 }, { label: 'Projects', data: topAvg.map((r) => r.projects), backgroundColor: '#b9cdea', borderRadius: 5, maxBarThickness: 20 }] }}
            options={{ ...noAspect, plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, padding: 12, font: { size: 11.5 } } } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 }, grid: { color: '#eef2f8' } }, x: { grid: { display: false }, ticks: { font: { size: 10 } } } } }}
          />
        </ChartCard>
      </div>

      <h3 className="section-label">Business Unit Breakdown</h3>
      <section className="card no-pad">
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr><th>Business Unit</th><th>People Allocated</th><th>Projects</th><th>Avg Allocation</th><th>Share of People</th></tr></thead>
            <tbody>
              {data.by_bu.length === 0
                ? <tr className="empty-row"><td colSpan={5}>No data.</td></tr>
                : data.by_bu.map((r) => {
                  const share = Math.round((r.employees / peopleTotal) * 100)
                  return (
                    <tr key={r.bu}>
                      <td><strong>{r.bu}</strong></td>
                      <td>{r.employees} <span className="muted-of">of {r.headcount}</span></td>
                      <td>{r.projects}</td>
                      <td>{utilPill(r.avg_allocation)}</td>
                      <td><div className="coverage-bar"><span style={{ width: `${share}%` }} /></div><span className="coverage-txt">{share}%</span></td>
                    </tr>
                  )
                })}
            </tbody>
          </table>
        </div>
      </section>
    </>
  )
}
