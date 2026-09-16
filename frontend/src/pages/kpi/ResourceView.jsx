import { useEffect, useMemo, useState } from 'react'
import { Bar, Doughnut } from 'react-chartjs-2'
import '../../lib/charts'
import KpiFilterBar from '../../components/KpiFilterBar'
import { useToast } from '../../context/ToastContext'
import {
  KPI_BLUE, KPI_PALETTE, KPI_TEAL, RESOURCE_FILTER_DEFS, applyFilters, emptySelection,
  fmtAmt, groupSum, loadResources,
} from '../../lib/kpi'

const noAspect = { responsive: true, maintainAspectRatio: false }
const IL_ORDER = ['IL0', 'IL1', 'IL2', 'IL3', 'IL4', 'IL5', 'ILR']
const amtAxis = { beginAtZero: true, ticks: { callback: (v) => fmtAmt(v) }, grid: { color: '#eef2f8' } }
const RES = (r) => r.resource_amount

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

function resBar(rows, palette = false) {
  return {
    labels: rows.map((d) => d.label),
    datasets: [{
      data: rows.map((d) => d.value),
      backgroundColor: palette ? rows.map((_, i) => KPI_PALETTE[i % KPI_PALETTE.length]) : KPI_BLUE,
      borderRadius: 5,
      maxBarThickness: 32,
    }],
  }
}
const resBarOpts = {
  ...noAspect,
  plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => ` ${fmtAmt(c.parsed.y ?? c.parsed.x)} FTE` } } },
  scales: { y: amtAxis, x: { grid: { display: false }, ticks: { font: { size: 10 } } } },
}

// Stack resource amount split by FTE vs Contingent across the top values of `key`.
function stackByKey(records, key, limit) {
  const m = new Map()
  for (const r of records) {
    const k = r[key] || '—'
    const e = m.get(k) || { total: 0, FTE: 0, Contingent: 0 }
    e.total += RES(r)
    const t = (r.fte_type || '').toLowerCase() === 'contingent' ? 'Contingent' : 'FTE'
    e[t] += RES(r)
    m.set(k, e)
  }
  return [...m.entries()]
    .map(([label, v]) => ({ label, ...v }))
    .sort((a, b) => b.total - a.total)
    .slice(0, limit)
}

export default function ResourceView() {
  const showToast = useToast()
  const [payload, setPayload] = useState(null)
  const [selected, setSelected] = useState(() => emptySelection(RESOURCE_FILTER_DEFS))

  useEffect(() => {
    loadResources().then(setPayload).catch((e) => showToast(e.message, true))
  }, [showToast])

  const records = useMemo(
    () => (payload ? applyFilters(payload.records, selected) : []),
    [payload, selected],
  )

  const agg = useMemo(() => {
    const total = records.reduce((s, r) => s + RES(r), 0)
    const fte = records.filter((r) => (r.fte_type || '').toLowerCase() !== 'contingent').reduce((s, r) => s + RES(r), 0)
    const contingent = total - fte
    const people = new Set(records.map((r) => r.person).filter(Boolean)).size
    const projects = new Set(records.map((r) => r.project_id).filter(Boolean)).size

    const byIl = groupSum(records, 'phase', RES).filter((d) => d.value > 0).sort((a, b) => {
      const ia = IL_ORDER.indexOf(a.label); const ib = IL_ORDER.indexOf(b.label)
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib)
    })

    return {
      total, fte, contingent, people, projects,
      byCluster: groupSum(records, 'cluster', RES).filter((d) => d.value > 0),
      byBu: groupSum(records, 'bu', RES).filter((d) => d.value > 0).slice(0, 14),
      byRegion: groupSum(records, 'region', RES).filter((d) => d.value > 0),
      byType: groupSum(records, 'project_type', RES).filter((d) => d.value > 0),
      bySavings: groupSum(records, 'savings_type', RES).filter((d) => d.value > 0),
      byIl,
      stackBu: stackByKey(records, 'bu', 12),
      stackDir: stackByKey(records, 'director', 10),
    }
  }, [records])

  if (!payload) return <div className="loading-wrap"><span className="spinner" /> Loading resources…</div>

  const stackOpts = {
    ...noAspect,
    plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, padding: 12 } }, tooltip: { callbacks: { label: (c) => ` ${c.dataset.label}: ${fmtAmt(c.parsed.y)} FTE` } } },
    scales: { x: { stacked: true, grid: { display: false }, ticks: { font: { size: 10 } } }, y: { stacked: true, ...amtAxis } },
  }

  return (
    <>
      <KpiFilterBar
        options={payload.filters}
        selected={selected}
        setSelected={setSelected}
        matched={records.length}
        total={payload.count}
        defs={RESOURCE_FILTER_DEFS}
      />

      <div className="kpi-stats">
        <div className="kpi-stat">
          <div className="kpi-stat-ic blue"><i className="fa-solid fa-users-gear" /></div>
          <div><div className="kpi-stat-val">{fmtAmt(agg.total)}</div><div className="kpi-stat-label">Total Resource (FTE)</div></div>
        </div>
        <div className="kpi-stat">
          <div className="kpi-stat-ic teal"><i className="fa-solid fa-id-badge" /></div>
          <div><div className="kpi-stat-val">{fmtAmt(agg.fte)}</div><div className="kpi-stat-label">FTE</div></div>
        </div>
        <div className="kpi-stat">
          <div className="kpi-stat-ic navy"><i className="fa-solid fa-user-clock" /></div>
          <div><div className="kpi-stat-val">{fmtAmt(agg.contingent)}</div><div className="kpi-stat-label">Contingent</div></div>
        </div>
        <div className="kpi-stat">
          <div className="kpi-stat-ic blue"><i className="fa-solid fa-user-group" /></div>
          <div><div className="kpi-stat-val">{agg.people.toLocaleString()}</div><div className="kpi-stat-label">People</div></div>
        </div>
        <div className="kpi-stat">
          <div className="kpi-stat-ic teal"><i className="fa-solid fa-diagram-project" /></div>
          <div><div className="kpi-stat-val">{agg.projects.toLocaleString()}</div><div className="kpi-stat-label">Projects</div></div>
        </div>
      </div>

      <div className="kpi-grid">
        <ChartCard icon="fa-people-arrows" title="CW &amp; FTE by Business Unit" sub="FTE vs Contingent" span={2}>
          <Bar
            data={{
              labels: agg.stackBu.map((d) => d.label),
              datasets: [
                { label: 'FTE', data: agg.stackBu.map((d) => d.FTE), backgroundColor: KPI_BLUE, borderRadius: 4, maxBarThickness: 34 },
                { label: 'Contingent', data: agg.stackBu.map((d) => d.Contingent), backgroundColor: KPI_TEAL, borderRadius: 4, maxBarThickness: 34 },
              ],
            }}
            options={stackOpts}
          />
        </ChartCard>

        <ChartCard icon="fa-sitemap" title="Resources by Cluster">
          <Bar data={resBar(agg.byCluster, true)} options={resBarOpts} />
        </ChartCard>

        <ChartCard icon="fa-building" title="Resources by Business Unit">
          <Bar data={resBar(agg.byBu)} options={resBarOpts} />
        </ChartCard>

        <ChartCard icon="fa-earth-americas" title="Resources by Region">
          <Bar data={resBar(agg.byRegion, true)} options={resBarOpts} />
        </ChartCard>

        <ChartCard icon="fa-signal" title="Resources by IL Phase">
          <Bar
            data={{ labels: agg.byIl.map((d) => d.label), datasets: [{ data: agg.byIl.map((d) => d.value), backgroundColor: KPI_TEAL, borderRadius: 5, maxBarThickness: 34 }] }}
            options={resBarOpts}
          />
        </ChartCard>

        <ChartCard icon="fa-tags" title="Resources by Project Type">
          <Bar data={resBar(agg.byType)} options={resBarOpts} />
        </ChartCard>

        <ChartCard icon="fa-piggy-bank" title="Resources by Savings Type">
          <Doughnut
            data={{ labels: agg.bySavings.map((d) => d.label), datasets: [{ data: agg.bySavings.map((d) => d.value), backgroundColor: agg.bySavings.map((_, i) => KPI_PALETTE[i % KPI_PALETTE.length]), borderWidth: 2, borderColor: '#fff' }] }}
            options={{ ...noAspect, cutout: '58%', plugins: { legend: { position: 'right', labels: { boxWidth: 12, padding: 9, font: { size: 11 } } }, tooltip: { callbacks: { label: (c) => ` ${c.label}: ${fmtAmt(c.parsed)} FTE` } } } }}
          />
        </ChartCard>

        <ChartCard icon="fa-user-tie" title="CW &amp; FTE by Director" sub="FTE vs Contingent" span={2}>
          <Bar
            data={{
              labels: agg.stackDir.map((d) => d.label),
              datasets: [
                { label: 'FTE', data: agg.stackDir.map((d) => d.FTE), backgroundColor: KPI_BLUE, borderRadius: 4, maxBarThickness: 40 },
                { label: 'Contingent', data: agg.stackDir.map((d) => d.Contingent), backgroundColor: KPI_TEAL, borderRadius: 4, maxBarThickness: 40 },
              ],
            }}
            options={stackOpts}
          />
        </ChartCard>
      </div>
    </>
  )
}
