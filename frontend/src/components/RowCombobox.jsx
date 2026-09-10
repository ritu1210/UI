import { useEffect, useRef, useState } from 'react'

// Inline searchable combobox for a table cell (employee / project).
// `source(query)` returns a promise of [{ value, label, sub }].
export default function RowCombobox({ initialValue = '', placeholder, source, onPick }) {
  const [text, setText] = useState(initialValue)
  const [picked, setPicked] = useState(initialValue)
  const [items, setItems] = useState([])
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ left: 0, top: 0, width: 240 })
  const inputRef = useRef(null)
  const popRef = useRef(null)
  const timer = useRef(null)

  function reposition() {
    const el = inputRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    setPos({ left: r.left, top: r.bottom + 6, width: Math.max(r.width, 340) })
  }

  async function runSource(q) {
    const result = await source(q)
    setItems(result)
  }

  async function openList() {
    reposition()
    await runSource(text === picked ? '' : text)
    setOpen(true)
  }

  function choose(it) {
    setText(it.label)
    setPicked(it.label)
    setOpen(false)
    onPick(it)
  }

  // Reposition on page/ancestor scroll, but let the dropdown's own scroll pass
  // through; close only when the user clicks outside the input and the popup.
  useEffect(() => {
    if (!open) return
    function onScroll(e) {
      if (popRef.current && popRef.current.contains(e.target)) return
      reposition()
    }
    function onDocDown(e) {
      const inInput = inputRef.current && inputRef.current.contains(e.target)
      const inPop = popRef.current && popRef.current.contains(e.target)
      if (!inInput && !inPop) { setOpen(false); setText((t) => (t !== picked ? picked : t)) }
    }
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', reposition)
    document.addEventListener('mousedown', onDocDown)
    return () => {
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', reposition)
      document.removeEventListener('mousedown', onDocDown)
    }
  }, [open, picked])

  return (
    <>
      <input
        ref={inputRef}
        className="combo-cell-input"
        placeholder={placeholder}
        autoComplete="off"
        value={text}
        onFocus={openList}
        onClick={openList}
        onChange={(e) => {
          const v = e.target.value
          setText(v)
          window.clearTimeout(timer.current)
          timer.current = window.setTimeout(async () => { reposition(); await runSource(v); setOpen(true) }, 200)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') { setText(picked); setOpen(false) }
          else if (e.key === 'Enter') {
            if (items.length) { e.preventDefault(); choose(items[0]) }
          }
        }}
      />
      {open && (
        <div ref={popRef} className="combo-pop" style={{ left: pos.left, top: pos.top, width: pos.width }}>
          {items.length === 0 ? (
            <div className="combo-empty">No matches</div>
          ) : (
            items.map((it, i) => (
              <div key={it.value + i} className="combo-opt" onMouseDown={(e) => { e.preventDefault(); choose(it) }}>
                <span className="cp-ic"><i className="fa-solid fa-diagram-project" /></span>
                <span className="cp-text">
                  <span className="cp-id">{it.label}</span>
                  {it.sub && <span className="cp-title">{it.sub}</span>}
                </span>
              </div>
            ))
          )}
        </div>
      )}
    </>
  )
}
