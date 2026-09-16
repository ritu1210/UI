import { useMemo, useState } from 'react'
import { Bar, Doughnut } from 'react-chartjs-2'
import '../../lib/charts'
import {
  KPI_BLUE, KPI_PALETTE, KPI_TEAL, fmtEuro, groupSum, metricValue,
} from '../../lib/kpi'

const noAspect = { responsive: true, maintainAspectRatio: false }
const IL_ORDER = ['IL0', 'IL1', 'IL2', 'IL3', 'IL4', 'IL5', 'ILR']
const YEARS = ['2022', '2023', '2024', '2025', '2026', '2027', '2028']

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

const euroAxis = { beginAtZero: true, ticks: { callback: (v) => fmtEuro(v) }, grid: { color: '#eef2f8' } }

export default function FinancialsView({ records }) {
  const [metric, setMetric] = useState('funnel')

  const agg = useMemo(() => {
    const val = metricValue[metric]
    const totalFunnel = records.reduce((s, r) => s + metricValue.funnel(r), 0)
    const totalActual = records.reduce((s, r) => s + metricValue.actual(r), 0)
    const active = records.filter((r) => (r.is_active || 'Yes').toLowerCase() !== 'no').length

    const ilMap = new Map()
    for (const r of records) {
      const il = (r.current_il || '—').toUpperCase()
      const e = ilMap.get(il) || { funnel: 0, actual: 0 }
      e.funnel += metricValue.funnel(r)
      e.actual += metricValue.actual(r)
      ilMap.set(il, e)
    }
    const ilLabels = [...ilMap.keys()].sort((a, b) => {
      const ia = IL_ORDER.indexOf(a); const ib = IL_ORDER.indexOf(b)
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib)
    })

    const funnelByYear = YEARS.map((y) => records.reduce((s, r) => s + (r.funnel[y] || 0), 0))
    const actualByYear = YEARS.map((y) => records.reduce((s, r) => s + (r.actual[y] || 0), 0))

    const byCluster = groupSum(records, 'cluster', val).filter((d) => d.value > 0).slice(0, 12)
    const byBu = groupSum(records, 'bu', val).filter((d) => d.value > 0).slice(0, 14)
    const bySavings = groupSum(records, 'savings_type', val).filter((d) => d.value > 0)
    const byProjectAll = groupSum(records, 'title', val).filter((d) => d.value > 0)
    const topProjects = byProjectAll.slice(0, 8)
    const othersVal = byProjectAll.slice(8).reduce((s, d) => s + d.value, 0)

    return {
      totalFunnel, totalActual, gap: totalFunnel - totalActual, active,
      ilLabels,
      ilFunnel: ilLabels.map((l) => ilMap.get(l).funnel),
      ilActual: ilLabels.map((l) => ilMap.get(l).actual),
      funnelByYear, actualByYear, byCluster, byBu, bySavings, topProjects, othersVal,
    }
  }, [records, metric])

  const metricLabel = metric === 'funnel' ? 'Funnel' : 'Actual'
  const projLabels = [...agg.topProjects.map((d) => d.label), ...(agg.othersVal > 0 ? ['Other'] : [])]
  const projData = [...agg.topProjects.map((d) => d.value), ...(agg.othersVal > 0 ? [agg.othersVal] : [])]

  return (
    <>
      <div className="kpi-metric-row">
        <div className="seg">
          <button className={metric === 'funnel' ? 'active' : ''} onClick={() => setMetric('funnel')}>Funnel</button>
          <button className={metric === 'actual' ? 'active' : ''} onClick={() => setMetric('actual')}>Actual</button>
        </div>
        <span className="kpi-metric-note">Value charts show <strong>{metricLabel}</strong> savings</span>
      </div>

      <div className="kpi-stats">
        <div className="kpi-stat">
          <div className="kpi-stat-ic teal"><i className="fa-solid fa-filter-circle-dollar" /></div>
          <div><div className="kpi-stat-val">{fmtEuro(agg.totalFunnel)}</div><div className="kpi-stat-label">Total Funnel</div></div>
        </div>
        <div className="kpi-stat">
          <div className="kpi-stat-ic blue"><i className="fa-solid fa-coins" /></div>
          <div><div className="kpi-stat-val">{fmtEuro(agg.totalActual)}</div><div className="kpi-stat-label">Total Actual</div></div>
        </div>
        <div className="kpi-stat">
          <div className="kpi-stat-ic navy"><i className="fa-solid fa-scale-balanced" /></div>
          <div><div className="kpi-stat-val">{fmtEuro(agg.gap)}</div><div className="kpi-stat-label">Funnel − Actual</div></div>
        </div>
        <div className="kpi-stat">
          <div className="kpi-stat-ic blue"><i className="fa-solid fa-diagram-project" /></div>
          <div><div className="kpi-stat-val">{records.length.toLocaleString()}</div><div className="kpi-stat-label">Projects</div></div>
        </div>
        <div className="kpi-stat">
          <div className="kpi-stat-ic teal"><i className="fa-solid fa-circle-check" /></div>
          <div><div className="kpi-stat-val">{agg.active.toLocaleString()}</div><div className="kpi-stat-label">Active</div></div>
        </div>
      </div>

      <div className="kpi-grid">
        <ChartCard icon="fa-chart-column" title="Savings by Year" sub="Funnel vs Actual" span={2}>
          <Bar
            data={{
              labels: YEARS,
              datasets: [
                { label: 'Funnel', data: agg.funnelByYear, backgroundColor: KPI_BLUE, borderRadius: 5, maxBarThickness: 34 },
                { label: 'Actual', data: agg.actualByYear, backgroundColor: KPI_TEAL, borderRadius: 5, maxBarThickness: 34 },
              ],
            }}
            options={{ ...noAspect, plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, padding: 14 } }, tooltip: { callbacks: { label: (c) => ` ${c.dataset.label}: ${fmtEuro(c.parsed.y)}` } } }, scales: { y: euroAxis, x: { grid: { display: false } } } }}
          />
        </ChartCard>

        <ChartCard icon="fa-layer-group" title="Actual vs Funnel by IL Status">
          <Bar
            data={{
              labels: agg.ilLabels,
              datasets: [
                { label: 'Funnel', data: agg.ilFunnel, backgroundColor: KPI_BLUE, borderRadius: 5, maxBarThickness: 28 },
                { label: 'Actual', data: agg.ilActual, backgroundColor: KPI_TEAL, borderRadius: 5, maxBarThickness: 28 },
              ],
            }}
            options={{ ...noAspect, plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, padding: 12 } }, tooltip: { callbacks: { label: (c) => ` ${c.dataset.label}: ${fmtEuro(c.parsed.y)}` } } }, scales: { y: euroAxis, x: { grid: { display: false } } } }}
          />
        </ChartCard>

        <ChartCard icon="fa-sitemap" title="Savings by Cluster" sub={`${metricLabel} savings`}>
          <Bar
            data={{ labels: agg.byCluster.map((d) => d.label), datasets: [{ data: agg.byCluster.map((d) => d.value), backgroundColor: KPI_BLUE, borderRadius: 5, maxBarThickness: 22 }] }}
            options={{ ...noAspect, indexAxis: 'y', plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => ` ${fmtEuro(c.parsed.x)}` } } }, scales: { x: euroAxis, y: { grid: { display: false } } } }}
          />
        </ChartCard>

        <ChartCard icon="fa-building" title="Savings by Business Unit" sub={`${metricLabel} savings`}>
          <Bar
            data={{ labels: agg.byBu.map((d) => d.label), datasets: [{ data: agg.byBu.map((d) => d.value), backgroundColor: agg.byBu.map((_, i) => KPI_PALETTE[i % KPI_PALETTE.length]), borderRadius: 5, maxBarThickness: 30 }] }}
            options={{ ...noAspect, plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => ` ${fmtEuro(c.parsed.y)}` } } }, scales: { y: euroAxis, x: { grid: { display: false }, ticks: { font: { size: 10 } } } } }}
          />
        </ChartCard>

        <ChartCard icon="fa-piggy-bank" title="Savings by Savings Type" sub={`${metricLabel} savings`}>
          <Doughnut
            data={{ labels: agg.bySavings.map((d) => d.label), datasets: [{ data: agg.bySavings.map((d) => d.value), backgroundColor: agg.bySavings.map((_, i) => KPI_PALETTE[i % KPI_PALETTE.length]), borderWidth: 2, borderColor: '#fff' }] }}
            options={{ ...noAspect, cutout: '58%', plugins: { legend: { position: 'right', labels: { boxWidth: 12, padding: 9, font: { size: 11 } } }, tooltip: { callbacks: { label: (c) => ` ${c.label}: ${fmtEuro(c.parsed)}` } } } }}
          />
        </ChartCard>

        <ChartCard icon="fa-chart-pie" title="Savings by Project" sub={`Top 8 · ${metricLabel}`}>
          <Doughnut
            data={{ labels: projLabels, datasets: [{ data: projData, backgroundColor: projLabels.map((_, i) => KPI_PALETTE[i % KPI_PALETTE.length]), borderWidth: 2, borderColor: '#fff' }] }}
            options={{ ...noAspect, cutout: '58%', plugins: { legend: { position: 'right', labels: { boxWidth: 12, padding: 8, font: { size: 10.5 } } }, tooltip: { callbacks: { label: (c) => ` ${c.label}: ${fmtEuro(c.parsed)}` } } } }}
          />
        </ChartCard>
      </div>
    </>
  )
}
