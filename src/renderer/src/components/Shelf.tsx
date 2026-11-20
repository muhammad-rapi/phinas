import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useRef, type ReactNode } from 'react'

/** A titled section whose cards scroll sideways, with arrows (mouse users cannot scroll sideways). */
export function Shelf({ title, children }: { title: string; children: ReactNode }): React.JSX.Element {
  const row = useRef<HTMLDivElement>(null)
  const scroll = (dir: 1 | -1): void => {
    const el = row.current
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: 'smooth' })
  }
  return (
    <section className="shelf">
      <div className="shelf-head">
        <h3 className="shelf-title">{title}</h3>
        <div className="shelf-nav">
          <button className="icon-btn" onClick={() => scroll(-1)} aria-label="Geser ke kiri">
            <ChevronLeft size={22} />
          </button>
          <button className="icon-btn" onClick={() => scroll(1)} aria-label="Geser ke kanan">
            <ChevronRight size={22} />
          </button>
        </div>
      </div>
      <div ref={row} className="shelf-row">
        {children}
      </div>
    </section>
  )
}
