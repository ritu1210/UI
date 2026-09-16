import { useMemo } from 'react'
import { Bar } from 'react-chartjs-2'
import '../../lib/charts'
import { KPI_BLUE, KPI_PALETTE, KPI_TEAL, groupCount } from '../../lib/kpi'

const noAspect = { responsive: true, maintainAspectRatio: false }
const IL_ORDER = ['IL0', 'IL1', 'IL2', 'IL3', 'IL4', 'IL5', 'ILR']
const countAxis = { beginAtZero: true, ticks: { precision: 0 }, grid: { color: '#eef2f8' } }

function ChartCard({ icon, title, sub, children, span }) {
  return (
    <section className={`card chart-card${span ? ` span${span}` : ''}`}>
      <div className="chart-head">
        <i className={`fa-solid ${icon}`} />
        <div><h3>{title}</h3>{sub && <span className="chart-sub">{sub}</span>}</div>
      </div>
      <div className="chart-box">{children}</div>
    </section>
  )
}

function barData(rows, palette = false) {
  return {
    labels: rows.map((d) => d.label),
    datasets: [{
      data: rows.map((d) => d.value),
      backgroundColor: palette ? rows.map((_, i) => KPI_PALETTE[i % KPI_PALETTE.length]) : KPI_BLUE,
      borderRadius: 5,
      maxBarThickness: 34,
    }],
  }
}
const barOpts = {
  ...noAspect,
  plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => ` ${c.parsed.y ?? c.parsed.x} projects` } } },
  scales: { y: countAxis, x: { grid: { display: false }, ticks: { font: { size: 10 } } } },
}

export default function ProjectsView({ records }) {
  const agg = useMemo(() => {
    const active = records.filter((r) => (r.is_active || 'Yes').toLowerCase() !== 'no').length
    const byYearMap = new Map()
    for (const r of records) {
      if (!r.il5_year) continue
      byYearMap.set(r.il5_year, (byYearMap.get(r.il5_year) || 0) + 1)
    }
    const byYear = [...byYearMap.entries()].sort((a, b) => a[0] - b[0]).map(([label, value]) => ({ label: String(label), value }))

    const byIl = groupCount(records, 'current_il').sort((a, b) => {
      const ia = IL_ORDER.indexOf(a.label); const ib = IL_ORDER.indexOf(b.label)
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib)
    })

    return {
      active,
      inactive: records.length - active,
      clusters: new Set(records.map((r) => r.cluster).filter(Boolean)).size,
      bus: new Set(records.map((r) => r.bu).filter(Boolean)).size,
      byBu: groupCount(records, 'bu').slice(0, 16),
      byType: groupCount(records, 'project_type'),
      byProc: groupCount(records, 'procurement_type'),
      byCommodity: groupCount(records, 'commodity').slice(0, 12),
      bySavings: groupCount(records, 'savings_type').slice(0, 12),
      byIl,
      byYear,
    }
  }, [records])

  return (
    <>
      <div className="kpi-stats">
        <div className="kpi-stat">
          <div className="kpi-stat-ic blue"><i className="fa-solid fa-layer-group" /></div>
          <div><div className="kpi-stat-val">{records.length.toLocaleString()}</div><div className="kpi-stat-label">Total Projects</div></div>
        </div>
        <div className="kpi-stat">
          <div className="kpi-stat-ic teal"><i className="fa-solid fa-circle-check" /></div>
          <div><div className="kpi-stat-val">{agg.active.toLocaleString()}</div><div className="kpi-stat-label">Active</div></div>
        </div>
        <div className="kpi-stat">
          <div className="kpi-stat-ic navy"><i className="fa-solid fa-circle-pause" /></div>
          <div><div className="kpi-stat-val">{agg.inactive.toLocaleString()}</div><div className="kpi-stat-label">Inactive</div></div>
        </div>
        <div className="kpi-stat">
          <div className="kpi-stat-ic blue"><i className="fa-solid fa-building" /></div>
          <div><div className="kpi-stat-val">{agg.bus}</div><div className="kpi-stat-label">Business Units</div></div>
        </div>
        <div className="kpi-stat">
          <div className="kpi-stat-ic teal"><i className="fa-solid fa-sitemap" /></div>
          <div><div className="kpi-stat-val">{agg.clusters}</div><div className="kpi-stat-label">Clusters</div></div>
        </div>
      </div>

      <div className="kpi-grid">
        <ChartCard icon="fa-calendar" title="Projects by Year" sub="By IL5 target year" span={2}>
          <Bar data={barData(agg.byYear)} options={barOpts} />
        </ChartCard>

        <ChartCard icon="fa-building" title="Projects by Business Unit">
          <Bar data={barData(agg.byBu, true)} options={barOpts} />
        </ChartCard>

        <ChartCard icon="fa-tags" title="Projects by Type">
          <Bar data={barData(agg.byType)} options={barOpts} />
        </ChartCard>

        <ChartCard icon="fa-file-signature" title="Projects by Procurement Type">
          <Bar data={barData(agg.byProc)} options={barOpts} />
        </ChartCard>

        <ChartCard icon="fa-boxes-stacked" title="Projects by Commodity">
          <Bar
            data={barData(agg.byCommodity)}
            options={{ ...barOpts, indexAxis: 'y', scales: { x: countAxis, y: { grid: { display: false }, ticks: { font: { size: 10 } } } } }}
          />
        </ChartCard>

        <ChartCard icon="fa-piggy-bank" title="Projects by Savings Type">
          <Bar data={barData(agg.bySavings, true)} options={barOpts} />
        </ChartCard>

        <ChartCard icon="fa-signal" title="Projects by IL Status">
          <Bar
            data={{ labels: agg.byIl.map((d) => d.label), datasets: [{ data: agg.byIl.map((d) => d.value), backgroundColor: KPI_TEAL, borderRadius: 5, maxBarThickness: 34 }] }}
            options={barOpts}
          />
        </ChartCard>
      </div>
    </>
  )
}
