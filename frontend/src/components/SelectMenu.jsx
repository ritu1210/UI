import { useEffect, useRef, useState } from 'react'

// Styled fixed-options dropdown that matches the SuggestInput look used for
// list fields (e.g. Project Type), so <select> fields render consistently.
export default function SelectMenu({ value, onChange, options = [], placeholder = '— select —' }) {
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

  function toggle() {
    if (open) { setOpen(false); return }
    reposition()
    setOpen(true)
  }

  return (
    <>
      <div className={`selectmenu${open ? ' open' : ''}`}>
        <input
          ref={inputRef}
          type="text"
          className="selectmenu-input"
          readOnly
          value={value || ''}
          placeholder={placeholder}
          onClick={toggle}
        />
        <i className="fa-solid fa-chevron-down selectmenu-caret" />
      </div>
      {open && pos && (
        <div ref={popRef} className="combo-pop suggest-pop" style={{ left: pos.left, top: pos.top, width: pos.width }}>
          <div className={`suggest-opt${!value ? ' selected' : ''}`}
            onMouseDown={(e) => { e.preventDefault(); onChange(''); setOpen(false) }}>
            <span className="sm-placeholder">{placeholder}</span>
          </div>
          {options.map((o) => (
            <div
              key={o}
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
