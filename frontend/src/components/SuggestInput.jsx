import { useEffect, useMemo, useRef, useState } from 'react'

// Free-text input with a styled, fixed-position suggestion dropdown.
// Replaces the browser's native <datalist> so every field opens consistently.
export default function SuggestInput({ value, onChange, options = [], placeholder }) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState(null)
  const inputRef = useRef(null)
  const popRef = useRef(null)

  function reposition() {
    const el = inputRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    setPos({ left: r.left, top: r.bottom + 6, width: r.width })
  }

  useEffect(() => {
    if (!open) return
    function onScroll(e) {
      if (popRef.current && popRef.current.contains(e.target)) return
      reposition()
    }
    function onDown(e) {
      const inInput = inputRef.current && inputRef.current.contains(e.target)
      const inPop = popRef.current && popRef.current.contains(e.target)
      if (!inInput && !inPop) setOpen(false)
    }
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', reposition)
    document.addEventListener('mousedown', onDown)
    return () => {
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', reposition)
      document.removeEventListener('mousedown', onDown)
    }
  }, [open])

  const needle = (value || '').toLowerCase()
  const matches = useMemo(() => {
    const list = needle ? options.filter((o) => o.toLowerCase().includes(needle)) : options
    return list.slice(0, 60)
  }, [options, needle])

  function openList() { reposition(); setOpen(true) }

  return (
    <>
      <div className="suggest-wrap">
        <input
          ref={inputRef}
          type="text"
          autoComplete="off"
          value={value}
          placeholder={placeholder}
          onFocus={openList}
          onClick={openList}
          onChange={(e) => { onChange(e.target.value); reposition(); setOpen(true) }}
          onKeyDown={(e) => { if (e.key === 'Escape') setOpen(false) }}
        />
        {value && (
          <button
            type="button"
            className="suggest-clear"
            title="Clear"
            tabIndex={-1}
            onMouseDown={(e) => { e.preventDefault(); onChange(''); setOpen(false) }}
          >
            <i className="fa-solid fa-xmark" />
          </button>
        )}
      </div>
      {open && pos && matches.length > 0 && (
        <div ref={popRef} className="combo-pop suggest-pop" style={{ left: pos.left, top: pos.top, width: pos.width }}>
          {matches.map((o, i) => (
            <div
              key={o + i}
              className={`suggest-opt${o === value ? ' selected' : ''}`}
              onMouseDown={(e) => { e.preventDefault(); onChange(o); setOpen(false) }}
            >
              {o}
            </div>
          ))}
        </div>
      )}
    </>
  )
}
