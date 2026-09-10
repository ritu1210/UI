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
  const [pos, setPos] = useState(null)
  const wrapRef = useRef(null)
  const inputRef = useRef(null)

  const selectedLabel = useMemo(() => {
    const found = norm.find((i) => i.value === value)
    return found ? found.label : ''
  }, [norm, value])

  function openList() {
    const el = inputRef.current
    if (el) {
      const r = el.getBoundingClientRect()
      setPos({ left: r.left, top: r.bottom + 6, width: r.width })
    }
    setOpen(true)
  }

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

  // Keep the fixed-position dropdown pinned to the input while open.
  useEffect(() => {
    if (!open) return
    function reposition() {
      const el = inputRef.current
      if (!el) return
      const r = el.getBoundingClientRect()
      setPos({ left: r.left, top: r.bottom + 6, width: r.width })
    }
    window.addEventListener('scroll', reposition, true)
    window.addEventListener('resize', reposition)
    return () => {
      window.removeEventListener('scroll', reposition, true)
      window.removeEventListener('resize', reposition)
    }
  }, [open])

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
        ref={inputRef}
        className="combo-input"
        style={{ width }}
        value={display}
        placeholder={placeholder}
        autoComplete="off"
        onFocus={openList}
        onClick={openList}
        onChange={(e) => { setQuery(e.target.value); setTyping(true); openList() }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') { setOpen(false); setTyping(false); setQuery('') }
          else if (e.key === 'Enter') {
            e.preventDefault()
            if (matches.length) choose(matches[0].value, matches[0].label)
          }
        }}
      />
      <i className="fa-solid fa-chevron-down combo-caret" />
      {open && pos && (
        <div className="combo-list" style={{ position: 'fixed', left: pos.left, top: pos.top, width: pos.width, right: 'auto' }}>
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
