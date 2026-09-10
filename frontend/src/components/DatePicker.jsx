import { useEffect, useMemo, useRef, useState } from 'react'

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December']
const DOW = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

function parseMDY(s) {
  const m = String(s || '').match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (!m) return null
  const d = new Date(Number(m[3]), Number(m[1]) - 1, Number(m[2]))
  return Number.isNaN(d.getTime()) ? null : d
}
function fmtMDY(d) { return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}` }
function fmtLabel(d) { return `${MONTHS[d.getMonth()].slice(0, 3)} ${d.getDate()}, ${d.getFullYear()}` }
function sameDay(a, b) {
  return a && b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

// Professional date picker with month/year dropdowns and a fixed-position popup.
export default function DatePicker({ value, onChange, placeholder = 'Select date' }) {
  const selected = useMemo(() => parseMDY(value), [value])
  const today = new Date()
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState(null)
  const [view, setView] = useState(() => selected || today)
  const inputRef = useRef(null)
  const popRef = useRef(null)

  useEffect(() => { if (selected) setView(selected) }, [value]) // eslint-disable-line react-hooks/exhaustive-deps

  function reposition() {
    const el = inputRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const width = Math.max(r.width, 300)
    let left = r.left
    if (left + width > window.innerWidth - 8) left = window.innerWidth - width - 8
    if (left < 8) left = 8
    setPos({ left, top: r.bottom + 6, width })
  }

  useEffect(() => {
    if (!open) return
    function onScroll(e) { if (popRef.current && popRef.current.contains(e.target)) return; reposition() }
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

  function openCal() { setView(selected || today); reposition(); setOpen(true) }

  const y = view.getFullYear()
  const mo = view.getMonth()
  const years = []
  for (let yy = today.getFullYear() - 10; yy <= today.getFullYear() + 10; yy++) years.push(yy)

  const firstDow = new Date(y, mo, 1).getDay()
  const daysInMonth = new Date(y, mo + 1, 0).getDate()
  const cells = []
  for (let i = 0; i < firstDow; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(y, mo, d))
  while (cells.length % 7 !== 0) cells.push(null)

  function choose(d) { onChange(fmtMDY(d)); setOpen(false) }

  return (
    <>
      <div className={`dp${open ? ' open' : ''}`}>
        <input
          ref={inputRef}
          type="text"
          className="dp-input"
          readOnly
          value={selected ? fmtLabel(selected) : ''}
          placeholder={placeholder}
          onClick={() => (open ? setOpen(false) : openCal())}
        />
        <i className="fa-regular fa-calendar dp-caret" />
      </div>
      {open && pos && (
        <div ref={popRef} className="dp-pop" style={{ left: pos.left, top: pos.top, width: pos.width }}>
          <div className="dp-head">
            <button type="button" className="dp-nav" onClick={() => setView(new Date(y, mo - 1, 1))} aria-label="Previous month">
              <i className="fa-solid fa-chevron-left" />
            </button>
            <div className="dp-selects">
              <select className="dp-sel" value={mo} onChange={(e) => setView(new Date(y, Number(e.target.value), 1))}>
                {MONTHS.map((mn, i) => <option key={mn} value={i}>{mn}</option>)}
              </select>
              <select className="dp-sel dp-sel-year" value={y} onChange={(e) => setView(new Date(Number(e.target.value), mo, 1))}>
                {years.map((yy) => <option key={yy} value={yy}>{yy}</option>)}
              </select>
            </div>
            <button type="button" className="dp-nav" onClick={() => setView(new Date(y, mo + 1, 1))} aria-label="Next month">
              <i className="fa-solid fa-chevron-right" />
            </button>
          </div>
          <div className="dp-dow">{DOW.map((d) => <span key={d}>{d}</span>)}</div>
          <div className="dp-grid">
            {cells.map((d, i) => (d ? (
              <button
                type="button"
                key={i}
                className={`dp-day${sameDay(d, selected) ? ' selected' : ''}${sameDay(d, today) ? ' today' : ''}`}
                onClick={() => choose(d)}
              >
                {d.getDate()}
              </button>
            ) : <span key={i} className="dp-day empty" />))}
          </div>
          <div className="dp-foot">
            <button type="button" className="dp-foot-btn" onClick={() => choose(today)}>Today</button>
            <button type="button" className="dp-foot-btn ghost" onClick={() => { onChange(''); setOpen(false) }}>Clear</button>
          </div>
        </div>
      )}
    </>
  )
}
