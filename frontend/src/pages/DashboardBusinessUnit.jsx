import { useEffect, useState } from 'react'
import { Bar, Doughnut, Line } from 'react-chartjs-2'
import { BU_PALETTE, utilBand } from '../lib/charts'
import Combobox from '../components/Combobox'
import { apiFetch } from '../lib/api'
import { useToast } from '../context/ToastContext'

function statCard(val, label, tone) {
  return <div className={`stat ${tone || ''}`}><div className="stat-val">{val}</div><div className="stat-label">{label}</div></div>
}
function KpiTile({ value, label, sub, tone = 'blue' }) {
  return (
    <div className={`bu-kpi tone-${tone}`}>
      <div className="bu-kpi-val">{value}</div>
      <div className="bu-kpi-label">{label}</div>
      {sub && <div className="bu-kpi-sub">{sub}</div>}
    </div>
  )
}
function utilPill(util) {
  return <span className={`pill u-${utilBand(util)}`}>{util}%</span>
}

const noAspect = { responsive: true, maintainAspectRatio: false }

function ChartCard({ icon, title, children, span }) {
  return (
    <section className={`card chart-card${span ? ' span2' : ''}`}>
      <div className="chart-head"><i className={`fa-solid ${icon}`} /><h3>{title}</h3></div>
      <div className="chart-box">{children}</div>
    </section>
  )
}

export default function DashboardBusinessUnit() {
  const showToast = useToast()
  const [bu, setBu] = useState('')
  const [month, setMonth] = useState('')
  const [data, setData] = useState(null)

  useEffect(() => {
    const params = new URLSearchParams()
    if (bu) params.set('bu', bu)
    if (month) params.set('month', month)
    apiFetch('/api/dashboard/business-unit?' + params.toString())
      .then(setData)
      .catch((e) => showToast(e.message, true))
  }, [bu, month, showToast])

  if (!data) return <div className="loading-wrap"><span className="spinner" /> Loading dashboard…</div>

  const k = data.kpis
  const allocPct = k.total_employees ? Math.round((k.employees / k.total_employees) * 100) : 0
  const topAvg = data.by_bu.slice(0, 12)
  const topShare = data.by_bu.slice(0, 10)
  const peopleTotal = data.by_bu.reduce((s, r) => s + r.employees, 0) || 1
  // Avg monthly FTE = total allocation % / 100, averaged over the months in scope.
  const monthsInScope = month ? 1 : 12
  const byFte = [...data.by_bu]
    .map((r) => ({ bu: r.bu, fte: Math.round((r.total_alloc / 100 / monthsInScope) * 10) / 10 }))
    .sort((a, b) => b.fte - a.fte)
    .slice(0, 12)

  return (
    <>
      <div className="page-heading">
        <h1>Allocation Dashboard <span className="tag">Business unit</span></h1>
        <p className="subtitle">Allocation, headcount and project spread across business units.</p>
      </div>

      <section className="card no-pad">
        <div className="toolbar">
          <div className="field">
            <label>Business Unit</label>
            <Combobox
              items={data.bus}
              value={bu}
              onSelect={(v) => setBu(v)}
              allLabel="All business units"
              placeholder="All business units"
              icon="fa-building"
              width={200}
            />
          </div>
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
          <button className="btn btn-ghost" onClick={() => { setBu(''); setMonth('') }}><i className="fa-solid fa-rotate-left" /> Reset</button>
          <span className="toolbar-note">
            {bu ? bu : 'All BUs'} &middot; {month ? month : 'all months'}
          </span>
        </div>

        <div className="bu-kpis">
          <KpiTile tone="navy" value={k.business_units} label={bu ? 'Business Unit' : 'Business Units'} sub={bu ? bu : 'across STET'} />
          <KpiTile tone="blue" value={k.total_employees} label={bu ? 'People in BU' : 'Total Employees'} sub={bu ? 'in this BU' : 'across STET'} />
          <KpiTile tone="teal" value={k.employees} label="Allocated" sub={`${allocPct}% of people`} />
          <KpiTile tone="amber" value={k.not_allocated} label="Not Allocated" sub="no allocation" />
          <KpiTile tone="red" value={k.resigned} label="Resigned" sub="left the org" />
          <KpiTile tone="indigo" value={k.funnel_projects} label="Funnel Projects" sub={bu ? 'BU pipeline' : 'total pipeline'} />
          <KpiTile tone="blue" value={k.staffed_projects} label="Ongoing Projects" sub={month ? month : 'all months'} />
        </div>
        <div style={{ height: 20 }} />
      </section>

      <div className="chart-grid">
        <ChartCard icon="fa-gauge-high" title={month ? `FTE Load by BU · ${month}` : 'Avg Monthly FTE by BU'}>
          <Bar
            data={{ labels: byFte.map((r) => r.bu), datasets: [{ data: byFte.map((r) => r.fte), backgroundColor: '#0b5ed7', hoverBackgroundColor: '#2f7ff0', borderRadius: 6, maxBarThickness: 26 }] }}
            options={{ ...noAspect, indexAxis: 'y', plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => ` ${c.parsed.x} FTE` } } }, scales: { x: { beginAtZero: true, grid: { color: '#eef2f8' } }, y: { grid: { display: false } } } }}
          />
        </ChartCard>

        <ChartCard icon="fa-chart-pie" title="People Allocated by BU">
          <Doughnut
            data={{ labels: topShare.map((r) => r.bu), datasets: [{ data: topShare.map((r) => r.employees), backgroundColor: topShare.map((_, i) => BU_PALETTE[i % BU_PALETTE.length]), borderWidth: 2, borderColor: '#fff' }] }}
            options={{ ...noAspect, cutout: '58%', plugins: { legend: { position: 'right', labels: { boxWidth: 12, padding: 10, font: { size: 11 } } }, tooltip: { callbacks: { label: (c) => ` ${c.label}: ${c.parsed} ${c.parsed === 1 ? 'person' : 'people'}` } } } }}
          />
        </ChartCard>

        <ChartCard icon="fa-user-group" title="Staffing Coverage by BU">
          <Bar
            data={{ labels: topAvg.map((r) => r.bu), datasets: [
              { label: 'Allocated', data: topAvg.map((r) => r.employees), backgroundColor: '#16b8a6', borderRadius: 4, maxBarThickness: 26 },
              { label: 'Not allocated', data: topAvg.map((r) => Math.max(r.headcount - r.employees, 0)), backgroundColor: '#dbe3ef', borderRadius: 4, maxBarThickness: 26 },
            ] }}
            options={{ ...noAspect, plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, padding: 12, font: { size: 11.5 } } } }, scales: { x: { stacked: true, grid: { display: false }, ticks: { font: { size: 10 } } }, y: { stacked: true, beginAtZero: true, ticks: { precision: 0 }, grid: { color: '#eef2f8' } } } }}
          />
        </ChartCard>

        <ChartCard icon="fa-diagram-project" title="Pipeline vs Ongoing Projects by BU">
          <Bar
            data={{ labels: topAvg.map((r) => r.bu), datasets: [
              { label: 'Funnel (pipeline)', data: topAvg.map((r) => r.funnel), backgroundColor: '#5b53d6', borderRadius: 5, maxBarThickness: 18 },
              { label: 'Ongoing', data: topAvg.map((r) => r.projects), backgroundColor: '#0b5ed7', borderRadius: 5, maxBarThickness: 18 },
            ] }}
            options={{ ...noAspect, indexAxis: 'y', plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, padding: 12, font: { size: 11.5 } } } }, scales: { x: { beginAtZero: true, ticks: { precision: 0 }, grid: { color: '#eef2f8' } }, y: { grid: { display: false }, ticks: { font: { size: 10 } } } } }}
          />
        </ChartCard>

        <ChartCard icon="fa-arrow-trend-up" title="Total Allocation Trend (12 Months)" span>
          <Line
            data={{ labels: data.trend.map((r) => r.month), datasets: [{ label: 'Total allocation', data: data.trend.map((r) => r.total), borderColor: '#0b5ed7', backgroundColor: 'rgba(11, 94, 215, .12)', fill: true, tension: 0.35, pointRadius: 3, pointBackgroundColor: '#0b5ed7' }] }}
            options={{ ...noAspect, plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => ` ${c.parsed.y} allocation pts` } } }, scales: { y: { beginAtZero: true, grid: { color: '#eef2f8' } }, x: { grid: { display: false } } } }}
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
