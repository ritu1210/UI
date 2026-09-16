import { useEffect, useRef, useState } from 'react'

// Compact checkbox dropdown used as a Power BI-style slicer.
export default function MultiSelect({ label, icon, options = [], selected, onChange, width = 190 }) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const ref = useRef(null)

  useEffect(() => {
    function onDoc(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const count = selected ? selected.size : 0
  const filtered = q
    ? options.filter((o) => o.toLowerCase().includes(q.toLowerCase()))
    : options

  function toggle(v) {
    const next = new Set(selected)
    if (next.has(v)) next.delete(v)
    else next.add(v)
    onChange(next)
  }

  return (
    <div className={`ms${count ? ' has-value' : ''}`} ref={ref} style={{ width }}>
      <button type="button" className="ms-btn" onClick={() => setOpen((v) => !v)}>
        <i className={`fa-solid ${icon} ms-ic`} />
        <span className="ms-label">{label}</span>
        {count > 0 && <span className="ms-badge">{count}</span>}
        <i className="fa-solid fa-chevron-down ms-caret" />
      </button>
      {open && (
        <div className="ms-pop">
          <div className="ms-search">
            <i className="fa-solid fa-magnifying-glass" />
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search ${label}…`} />
          </div>
          <div className="ms-quick">
            <button type="button" onClick={() => onChange(new Set(options))}>Select all</button>
            <button type="button" onClick={() => onChange(new Set())}>Clear</button>
          </div>
          <div className="ms-list">
            {filtered.length === 0
              ? <div className="ms-empty">No matches</div>
              : filtered.map((o) => (
                <label key={o} className="ms-item">
                  <input type="checkbox" checked={selected.has(o)} onChange={() => toggle(o)} />
                  <span title={o}>{o}</span>
                </label>
              ))}
          </div>
        </div>
      )}
    </div>
  )
}
