import { Music } from 'lucide-react'
import { coverStyle } from './cover'

/** Playlist thumbnail: one cover, a 2x2 collage, or a placeholder when empty. */
export function PlaylistCover({
  covers,
  size
}: {
  covers: string[]
  size?: number
}): React.JSX.Element {
  const style = size ? { width: size, height: size } : undefined
  if (covers.length === 0) {
    return (
      <div className="pcover pcover-empty" style={style}>
        <Music size={size ? Math.round(size / 2.5) : 28} />
      </div>
    )
  }
  if (covers.length < 4) {
    return <div className="pcover cover-bg" style={{ ...style, ...coverStyle(covers[0]) }} />
  }
  return (
    <div className="pcover pcover-grid" style={style}>
      {covers.slice(0, 4).map((c, i) => (
        <div key={i} className="cover-bg" style={coverStyle(c)} />
      ))}
    </div>
  )
}
