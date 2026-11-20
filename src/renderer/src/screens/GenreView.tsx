import { useEffect, useState } from 'react'
import type { GenrePage } from '../../../shared/types'
import { AccentTitle } from '../components/CollectionHeader'
import { CoverGrid, CoverGridSkeleton } from '../components/CoverGrid'
import type { Nav } from '../views'

type State = { status: 'loading' } | { status: 'error' } | { status: 'ready'; page: GenrePage }

/** A mood or genre from YouTube Music: sections of playlists and albums. */
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
      <h1 className="page-title">
        <AccentTitle text={title} />
      </h1>
      {state.status === 'loading' && <CoverGridSkeleton count={6} />}
      {state.status === 'error' && <div className="notice">{title} tidak bisa dibuka. Cek koneksi internet kamu.</div>}
      {state.status === 'ready' && state.page.shelves.length === 0 && <p className="muted">Belum ada isi untuk {title}.</p>}
      {state.status === 'ready' &&
        state.page.shelves.map((sh) => (
          <section key={sh.title} className="sec">
            <h2 className="section-title">{sh.title}</h2>
            <CoverGrid
              items={sh.playlists.map((p) => ({
                key: p.id,
                art: p.coverUrl,
                title: p.title,
                meta: p.author,
                onOpen: () => nav(sh.album ? { name: 'album', id: p.id } : { name: 'public', id: p.id, author: p.author })
              }))}
            />
          </section>
        ))}
    </>
  )
}
