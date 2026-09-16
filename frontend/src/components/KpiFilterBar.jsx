import MultiSelect from './MultiSelect'
import { FILTER_DEFS } from '../lib/kpi'

// Row of slicers shared by the KPI dashboard views.
export default function KpiFilterBar({ options, selected, setSelected, matched, total, defs = FILTER_DEFS }) {
  const activeCount = Object.values(selected).reduce((s, set) => s + (set ? set.size : 0), 0)

  function update(key, next) {
    setSelected((prev) => ({ ...prev, [key]: next }))
  }
  function resetAll() {
    const cleared = {}
    defs.forEach((f) => { cleared[f.key] = new Set() })
    setSelected(cleared)
  }

  return (
    <div className="kpi-filterbar card">
      <div className="kpi-filterbar-head">
        <span className="kpi-filterbar-title"><i className="fa-solid fa-filter" /> Filters</span>
        <span className="kpi-filterbar-count">
          <strong>{matched.toLocaleString()}</strong> of {total.toLocaleString()} {defs === FILTER_DEFS ? 'projects' : 'records'}
        </span>
        <button className="btn btn-ghost kpi-reset" onClick={resetAll} disabled={!activeCount}>
          <i className="fa-solid fa-rotate-left" /> Reset{activeCount ? ` (${activeCount})` : ''}
        </button>
      </div>
      <div className="kpi-filters">
        {defs.map((f) => (
          <MultiSelect
            key={f.key}
            label={f.label}
            icon={f.icon}
            options={options[f.key] || []}
            selected={selected[f.key] || new Set()}
            onChange={(next) => update(f.key, next)}
          />
        ))}
      </div>
    </div>
  )
}
