import { useEffect, useMemo, useRef, useState } from 'react'

function normalize(items) {
  return items.map((i) => (typeof i === 'string' ? { value: i, label: i } : i))
}

function initials(label) {
  return label.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase()
}

// Searchable filter combobox. Items may be strings or {value, label, sub}.
// Controlled by the parent through `value` (selected value, '' = none).
export default function Combobox({ items, value, onSelect, allLabel = 'All', placeholder = 'Search…', width = 240, icon, avatar = false }) {
  const norm = useMemo(() => normalize(items), [items])
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [typing, setTyping] = useState(false)
  const wrapRef = useRef(null)

  const selectedLabel = useMemo(() => {
    const found = norm.find((i) => i.value === value)
    return found ? found.label : ''
  }, [norm, value])

  useEffect(() => {
    function onDocDown(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false)
        setTyping(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', onDocDown)
    return () => document.removeEventListener('mousedown', onDocDown)
  }, [])

  const needle = query.trim().toLowerCase()
  const matches = needle
    ? norm.filter((i) => i.label.toLowerCase().includes(needle) || i.value.toLowerCase().includes(needle))
    : norm

  function choose(val, label) {
    onSelect(val, label)
    setOpen(false)
    setTyping(false)
    setQuery('')
  }

  const display = typing ? query : selectedLabel

  return (
    <div className={`combo${open ? ' open' : ''}${icon ? ' has-icon' : ''}${value ? ' has-value' : ''}`} ref={wrapRef} style={{ width }}>
      {icon && <i className={`fa-solid ${icon} combo-lead`} />}
      <input
        className="combo-input"
        style={{ width }}
        value={display}
        placeholder={placeholder}
        autoComplete="off"
        onFocus={() => setOpen(true)}
        onClick={() => setOpen(true)}
        onChange={(e) => { setQuery(e.target.value); setTyping(true); setOpen(true) }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') { setOpen(false); setTyping(false); setQuery('') }
          else if (e.key === 'Enter') {
            e.preventDefault()
            if (matches.length) choose(matches[0].value, matches[0].label)
          }
        }}
      />
      <i className="fa-solid fa-chevron-down combo-caret" />
      {open && (
        <div className="combo-list">
          <div className="combo-opt combo-all" onMouseDown={(e) => { e.preventDefault(); choose('', '') }}>
            <i className="fa-solid fa-xmark combo-all-icon" />
            <span>{allLabel}</span>
          </div>
          {matches.length === 0 && needle ? (
            <div className="combo-empty">No matches</div>
          ) : (
            matches.map((i) => {
              const selected = i.value === value
              return (
                <div
                  key={i.value}
                  className={`combo-opt${avatar ? ' with-avatar' : ''}${selected ? ' selected' : ''}`}
                  onMouseDown={(e) => { e.preventDefault(); choose(i.value, i.label) }}
                >
                  {avatar && <span className="combo-avatar">{initials(i.label)}</span>}
                  <span className="combo-opt-text">
                    <span className="co-main">{i.label}</span>
                    {i.sub && <span className="co-sub">{i.sub}</span>}
                  </span>
                  {selected && <i className="fa-solid fa-check combo-opt-check" />}
                </div>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
