import { useMemo, useState } from 'react'
import { Bar } from 'react-chartjs-2'
import '../../lib/charts'
import { COMPETENCY } from '../../lib/competencyData'

const noAspect = { responsive: true, maintainAspectRatio: false }
const TARGET = 70
const GOAL = 70
const H1_TARGET = 67
const BASE_2025 = 65

const GREEN = '#16b8a6'
const AMBER = '#f5a524'
const RED = '#e5484d'
const BLUE = '#0b5ed7'
const NAVY = '#0f2350'

const LEVEL_COLORS = {
  'LEVEL-4': '#0a2e6b',
  'LEVEL-3': '#0b5ed7',
  'LEVEL-2': '#16b8a6',
  'LEVEL-1': '#f5a524',
  'LEVEL-0': '#e5484d',
}

// Bucket colour by proficiency % (shared by person + function charts).
const bandColor = (v) => (v >= TARGET ? GREEN : v >= 60 ? AMBER : RED)

// ---- On-canvas data-label plugins (no extra dependency) ----
const pctLabels = {
  id: 'pctLabels',
  afterDatasetsDraw(chart) {
    const { ctx } = chart
    chart.data.datasets.forEach((ds, di) => {
      if (ds.type === 'line') return
      const meta = chart.getDatasetMeta(di)
      if (meta.hidden) return
      meta.data.forEach((el, i) => {
        const v = ds.data[i]
        if (v == null) return
        ctx.save()
        ctx.font = '700 11px Inter, sans-serif'
        ctx.fillStyle = '#334155'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'bottom'
        ctx.fillText(`${v}%`, el.x, el.y - 5)
        ctx.restore()
      })
    })
  },
}
const countInStack = {
  id: 'countInStack',
  afterDatasetsDraw(chart) {
    const { ctx } = chart
    chart.data.datasets.forEach((ds, di) => {
      const meta = chart.getDatasetMeta(di)
      if (meta.hidden) return
      meta.data.forEach((el, i) => {
        const v = ds.data[i]
        if (!v) return
        const h = Math.abs(el.base - el.y)
        if (h < 15) return
        ctx.save()
        ctx.font = '700 10.5px Inter, sans-serif'
        ctx.fillStyle = '#fff'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(v, el.x, (el.y + el.base) / 2)
        ctx.restore()
      })
    })
  },
}
const stackTotalTop = {
  id: 'stackTotalTop',
  afterDatasetsDraw(chart) {
    const { ctx } = chart
    const metas = chart.data.datasets.map((_, i) => chart.getDatasetMeta(i))
    const n = chart.data.labels.length
    for (let i = 0; i < n; i++) {
      let total = 0; let topY = Infinity; let x = 0
      chart.data.datasets.forEach((ds, di) => {
        const el = metas[di].data[i]
        if (!el) return
        total += ds.data[i] || 0
        x = el.x
        if (el.y < topY) topY = el.y
      })
      if (!total) continue
      ctx.save()
      ctx.font = '800 11px Inter, sans-serif'
      ctx.fillStyle = NAVY
      ctx.textAlign = 'center'
      ctx.textBaseline = 'bottom'
      ctx.fillText(total, x, topY - 5)
      ctx.restore()
    }
  },
}

function ChartCard({ icon, title, sub, children, footer, span, dummy }) {
  return (
    <section className={`card chart-card${span ? ` span${span}` : ''}`}>
      <div className="chart-head">
        <i className={`fa-solid ${icon}`} />
        <div>
          <h3>{title} {dummy && <span className="comp-dummy-tag">DUMMY</span>}</h3>
          {sub && <span className="chart-sub">{sub}</span>}
        </div>
      </div>
      <div className="chart-box">{children}</div>
      {footer}
    </section>
  )
}

function ScoreLegend() {
  return (
    <div className="comp-legend">
      <span><i style={{ background: GREEN }} /> On target (&ge;70%)</span>
      <span><i style={{ background: AMBER }} /> Near (60&ndash;69%)</span>
      <span><i style={{ background: RED }} /> At risk (&lt;60%)</span>
      <span className="comp-legend-dash"><i /> Target 70%</span>
    </div>
  )
}

const pctAxis = {
  beginAtZero: true, max: 100,
  ticks: { callback: (v) => `${v}%` }, grid: { color: '#eef2f8' },
}
const topPad = { layout: { padding: { top: 20 } } }
// A flat 70% goal line overlaid on a bar chart.
const goalLine = (labels) => ({
  type: 'line', label: `Target ${TARGET}%`, data: labels.map(() => TARGET),
  borderColor: NAVY, borderWidth: 2, borderDash: [6, 4], pointRadius: 0, fill: false,
})

export default function CompetencyView() {
  const { overall, teams, note } = COMPETENCY
  const [half, setHalf] = useState('h2')
  const [teamCode, setTeamCode] = useState(teams[0].code)

  const key = half // 'h1' | 'h2'
  const halfLabel = half === 'h1' ? "H1'26 (1st half)" : "H2'26 (2nd half)"

  // STET-GB actual index = mean of every individual score (individual -> GB roll-up).
  const gb = useMemo(() => {
    const h1 = []; const h2 = []
    teams.forEach((t) => t.people.forEach((p) => { h1.push(p.h1); h2.push(p.h2) }))
    const avg = (a) => Math.round(a.reduce((s, v) => s + v, 0) / (a.length || 1))
    return { h1: avg(h1), h2: avg(h2) }
  }, [teams])
  const gbH1 = gb.h1
  const gbH2 = gb.h2
  const neededToGoal = Math.max(0, GOAL - gbH1) // remaining gap after H1, to close in H2

  // Per-team aggregates for the selected half.
  const teamAgg = useMemo(() => teams.map((t) => {
    const scores = t.people.map((p) => p[key])
    const avg = Math.round(scores.reduce((s, v) => s + v, 0) / (scores.length || 1))
    const above = scores.filter((v) => v >= TARGET).length
    return { code: t.code, name: t.name, people: t.people.length, avg, above, below: t.people.length - above }
  }), [teams, key])

  const totals = useMemo(() => {
    const metTeams = teamAgg.filter((t) => t.avg >= TARGET).length
    const below = teamAgg.reduce((s, t) => s + t.below, 0)
    return { metTeams, teams: teams.length, below }
  }, [teamAgg, teams])

  const team = teams.find((t) => t.code === teamCode)
  const needTraining = useMemo(() => team.people
    .map((p) => ({ ...p, score: p[key] }))
    .filter((p) => p.score < TARGET)
    .sort((a, b) => a.score - b.score), [team, key])

  // Goal vs Target vs Actual tracker (the KPI the 70% / 67% numbers refer to).
  const trackLabels = ['2025 Baseline', "H1'26 Target", "H1'26 Actual", "H2'26 Goal", "H2'26 Actual"]
  const trackValues = [BASE_2025, H1_TARGET, gb.h1, GOAL, gb.h2]
  const trackColors = [NAVY, BLUE, AMBER, BLUE, AMBER]

  return (
    <>
      <div className="comp-note">
        <i className="fa-solid fa-circle-info" />
        <span><strong>BU-GB · STET-GB Competency Matrix.</strong> {note}</span>
      </div>

      <div className="kpi-metric-row">
        <div className="seg">
          <button className={half === 'h1' ? 'active' : ''} onClick={() => setHalf('h1')}>H1 · 1st Half</button>
          <button className={half === 'h2' ? 'active' : ''} onClick={() => setHalf('h2')}>H2 · 2nd Half</button>
        </div>
        <span className="kpi-metric-note">
          Team target <strong>{TARGET}%</strong> · 2025 base year <strong>65%</strong> · showing <strong>{halfLabel}</strong>
        </span>
      </div>

      <div className="kpi-stats">
        <div className="kpi-stat">
          <div className="kpi-stat-ic navy"><i className="fa-solid fa-bullseye" /></div>
          <div><div className="kpi-stat-val">{GOAL}%</div><div className="kpi-stat-label">2026 Goal (STET-GB)</div></div>
        </div>

        {half === 'h1' ? (
          <>
            <div className="kpi-stat">
              <div className="kpi-stat-ic blue"><i className="fa-solid fa-flag-checkered" /></div>
              <div><div className="kpi-stat-val">{H1_TARGET}%</div><div className="kpi-stat-label">H1'26 Target</div></div>
            </div>
            <div className="kpi-stat">
              <div className={`kpi-stat-ic ${gbH1 >= H1_TARGET ? 'teal' : 'blue'}`}><i className="fa-solid fa-gauge-high" /></div>
              <div>
                <div className="kpi-stat-val">{gbH1}%</div>
                <div className={`comp-pill ${gbH1 >= H1_TARGET ? 'ok' : 'warn'}`}>{gbH1 >= H1_TARGET ? 'On track' : `${H1_TARGET - gbH1}% below target`}</div>
                <div className="kpi-stat-label">H1'26 Actual <span className="comp-dummy-tag sm">DUMMY</span></div>
              </div>
            </div>
            <div className="kpi-stat">
              <div className="kpi-stat-ic navy"><i className="fa-solid fa-arrow-trend-up" /></div>
              <div><div className="kpi-stat-val">+{neededToGoal}%</div><div className="kpi-stat-label">Still to reach 70% goal in H2</div></div>
            </div>
          </>
        ) : (
          <>
            <div className="kpi-stat">
              <div className="kpi-stat-ic blue"><i className="fa-solid fa-hourglass-start" /></div>
              <div><div className="kpi-stat-val">{gbH1}%</div><div className="kpi-stat-label">H1'26 Actual (start) <span className="comp-dummy-tag sm">DUMMY</span></div></div>
            </div>
            <div className="kpi-stat">
              <div className="kpi-stat-ic navy"><i className="fa-solid fa-arrow-trend-up" /></div>
              <div><div className="kpi-stat-val">+{neededToGoal}%</div><div className="kpi-stat-label">Needed in H2 to hit 70%</div></div>
            </div>
            <div className="kpi-stat">
              <div className={`kpi-stat-ic ${gbH2 >= GOAL ? 'teal' : 'blue'}`}><i className="fa-solid fa-gauge-high" /></div>
              <div>
                <div className="kpi-stat-val">{gbH2}%</div>
                <div className={`comp-pill ${gbH2 >= GOAL ? 'ok' : 'warn'}`}>{gbH2 >= GOAL ? `Goal met +${gbH2 - GOAL}%` : `${GOAL - gbH2}% short`}</div>
                <div className="kpi-stat-label">H2'26 Actual <span className="comp-dummy-tag sm">DUMMY</span></div>
              </div>
            </div>
          </>
        )}

        <div className="kpi-stat">
          <div className="kpi-stat-ic teal"><i className="fa-solid fa-circle-check" /></div>
          <div>
            <div className="kpi-stat-val">{totals.metTeams} of {totals.teams}</div>
            <div className="kpi-stat-label">Functions achieved (&ge;70%){totals.teams - totals.metTeams > 0 ? ` · ${totals.teams - totals.metTeams} below` : ''}</div>
          </div>
        </div>
      </div>

      <div className="kpi-grid">
        <ChartCard
          icon="fa-bullseye"
          title="STET-GB Competency — Goal vs Target vs Actual"
          sub="Competency index across the year · blue = target/baseline, amber = actual · goal line 70%"
          span={2}
          dummy
        >
          <Bar
            data={{
              labels: trackLabels,
              datasets: [
                { label: 'Index %', data: trackValues, backgroundColor: trackColors, borderRadius: 6, maxBarThickness: 54 },
                goalLine(trackLabels),
              ],
            }}
            options={{
              ...noAspect, ...topPad,
              plugins: {
                legend: { display: false },
                tooltip: { callbacks: { label: (c) => (c.dataset.type === 'line' ? ` Goal: ${TARGET}%` : ` ${trackLabels[c.dataIndex]}: ${c.parsed.y}%`) } },
              },
              scales: { y: pctAxis, x: { grid: { display: false }, ticks: { font: { size: 11 } } } },
            }}
            plugins={[pctLabels]}
          />
        </ChartCard>

        <ChartCard icon="fa-layer-group" title="STET-GB Proficiency Mix" sub="Head-count by competency level (real targets & baseline)">
          <Bar
            data={{
              labels: Object.keys(overall.counts),
              datasets: overall.levels.map((lv, i) => ({
                label: lv,
                data: Object.keys(overall.counts).map((p) => overall.counts[p][i]),
                backgroundColor: LEVEL_COLORS[lv],
                borderRadius: 3, maxBarThickness: 54,
              })),
            }}
            options={{
              ...noAspect, ...topPad,
              plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, padding: 10, font: { size: 10 } } } },
              scales: { x: { stacked: true, grid: { display: false }, ticks: { font: { size: 10 } } }, y: { stacked: true, beginAtZero: true, grid: { color: '#eef2f8' } } },
            }}
            plugins={[countInStack, stackTotalTop]}
          />
        </ChartCard>

        <ChartCard icon="fa-people-arrows" title={`People \u2265 ${TARGET}% by Function`} sub={`Achieved vs to-be-trained head-count · ${halfLabel}`} dummy>
          <Bar
            data={{
              labels: teamAgg.map((t) => t.code),
              datasets: [
                { label: `Achieved (\u2265 ${TARGET}%)`, data: teamAgg.map((t) => t.above), backgroundColor: GREEN, borderRadius: 4, maxBarThickness: 38 },
                { label: 'Need training (< 70%)', data: teamAgg.map((t) => t.below), backgroundColor: RED, borderRadius: 4, maxBarThickness: 38 },
              ],
            }}
            options={{
              ...noAspect, ...topPad,
              plugins: {
                legend: { position: 'bottom', labels: { boxWidth: 12, padding: 12 } },
                tooltip: { callbacks: { title: (c) => teamAgg[c[0].dataIndex].name, label: (c) => ` ${c.dataset.label}: ${c.parsed.y}` } },
              },
              scales: { x: { stacked: true, grid: { display: false } }, y: { stacked: true, beginAtZero: true, ticks: { precision: 0 }, grid: { color: '#eef2f8' } } },
            }}
            plugins={[countInStack, stackTotalTop]}
          />
        </ChartCard>

        <ChartCard icon="fa-gauge-high" title="Function Achievement vs Target" sub={`Average competency % per function · ${halfLabel}`} span={2} dummy footer={<ScoreLegend />}>
          <Bar
            data={{
              labels: teamAgg.map((t) => t.code),
              datasets: [
                {
                  label: 'Avg competency %',
                  data: teamAgg.map((t) => t.avg),
                  backgroundColor: teamAgg.map((t) => bandColor(t.avg)),
                  borderRadius: 5, maxBarThickness: 46,
                },
                goalLine(teamAgg.map((t) => t.code)),
              ],
            }}
            options={{
              ...noAspect, ...topPad,
              plugins: {
                legend: { display: false },
                tooltip: { callbacks: { title: (c) => teamAgg[c[0].dataIndex].name, label: (c) => ` ${c.dataset.type === 'line' ? 'Target' : 'Avg'}: ${c.parsed.y}%` } },
              },
              scales: { y: pctAxis, x: { grid: { display: false } } },
            }}
            plugins={[pctLabels]}
          />
        </ChartCard>
      </div>

      <div className="comp-drill">
        <div className="comp-drill-head">
          <div>
            <h3>Function drill-down &mdash; who needs training</h3>
            <span className="chart-sub">Select a function to see people below the {TARGET}% target and their focus skills.</span>
          </div>
          <div className="comp-team-tabs">
            {teams.map((t) => {
              const met = teamAgg.find((a) => a.code === t.code).avg >= TARGET
              return (
                <button
                  key={t.code}
                  className={`comp-team-btn${t.code === teamCode ? ' active' : ''}`}
                  onClick={() => setTeamCode(t.code)}
                  title={`${t.name} — ${met ? 'at target' : 'below target'}`}
                >
                  <span className={`comp-dot ${met ? 'ok' : 'bad'}`} />{t.code}
                </button>
              )
            })}
          </div>
        </div>

        <div className="kpi-grid">
          <ChartCard icon="fa-user-check" title={`${team.name} — Proficiency by Person`} sub={`${halfLabel} · colour shows status vs the ${TARGET}% target`} dummy footer={<ScoreLegend />}>
            <Bar
              data={{
                labels: team.people.map((p) => p.name),
                datasets: [
                  {
                    label: 'Competency %',
                    data: team.people.map((p) => p[key]),
                    backgroundColor: team.people.map((p) => bandColor(p[key])),
                    borderRadius: 4, maxBarThickness: 34,
                  },
                  goalLine(team.people.map((p) => p.name)),
                ],
              }}
              options={{
                ...noAspect, ...topPad,
                plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => ` ${c.dataset.type === 'line' ? 'Target' : 'Competency'}: ${c.parsed.y}%` } } },
                scales: { y: pctAxis, x: { grid: { display: false }, ticks: { font: { size: 10 } } } },
              }}
              plugins={[pctLabels]}
            />
          </ChartCard>

          <section className="card chart-card">
            <div className="chart-head">
              <i className="fa-solid fa-graduation-cap" />
              <div>
                <h3>Training list <span className="comp-dummy-tag">DUMMY</span></h3>
                <span className="chart-sub">{needTraining.length} of {team.people.length} below {TARGET}% in {halfLabel}</span>
              </div>
            </div>
            <div className="comp-train-box">
              {needTraining.length === 0 && (
                <div className="comp-train-empty"><i className="fa-solid fa-circle-check" /> Whole function is at or above the {TARGET}% target.</div>
              )}
              {needTraining.map((p) => (
                <div className="comp-train-row" key={p.name}>
                  <div className="comp-train-top">
                    <span className="comp-train-name">{p.name}</span>
                    <span className={`comp-train-score${p.score >= 60 ? ' warn' : ' crit'}`}>{p.score}%</span>
                  </div>
                  <div className="comp-train-bar"><span style={{ width: `${p.score}%` }} /></div>
                  <div className="comp-train-skills">
                    {p.weakSkills.map((s) => <span key={s} className="comp-skill-chip">{s}</span>)}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </>
  )
}
