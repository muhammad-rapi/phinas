import { useEffect, useState } from 'react'
import type { GenrePage } from '../../../shared/types'
import { CoverArt, MediaCard } from '../components/MediaCard'
import { Shelf } from '../components/Shelf'
import type { Nav } from '../views'

type State = { status: 'loading' } | { status: 'error' } | { status: 'ready'; page: GenrePage }

/** A mood or genre from YouTube Music: shelves of playlists and albums. */
export function GenreView({ params, title, nav }: { params: string; title: string; nav: Nav }): React.JSX.Element {
  const [state, setState] = useState<State>({ status: 'loading' })

  useEffect(() => {
    let cancelled = false
    setState({ status: 'loading' })
    window.phinas
      .getGenre(params)
      .then((page) => !cancelled && setState({ status: 'ready', page }))
      .catch(() => !cancelled && setState({ status: 'error' }))
    return () => {
      cancelled = true
    }
  }, [params])

  return (
    <>
      <h2 className="page-title">{title}</h2>
      {state.status === 'loading' && (
        <div className="cover-grid" aria-busy="true">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="cover-card-art skeleton" />
          ))}
        </div>
      )}
      {state.status === 'error' && <div className="notice">{title} tidak bisa dibuka. Cek koneksi internet kamu.</div>}
      {state.status === 'ready' && state.page.shelves.length === 0 && <p className="muted">Belum ada isi untuk {title}.</p>}
      {state.status === 'ready' &&
        state.page.shelves.map((sh) => (
          <Shelf key={sh.title} title={sh.title}>
            {sh.playlists.map((p) => (
              <MediaCard
                key={p.id}
                art={<CoverArt url={p.coverUrl} />}
                title={p.title}
                subtitle={p.author}
                onOpen={() => nav(sh.album ? { name: 'album', id: p.id } : { name: 'public', id: p.id, author: p.author })}
              />
            ))}
          </Shelf>
        ))}
    </>
  )
}
