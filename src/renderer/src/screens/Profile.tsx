import { useCallback, useEffect, useState, type FormEvent } from 'react'
import type { SyncStatus } from '../../../shared/types'
import { useLibrary } from '../library/LibraryProvider'
import type { ThemeName } from '../theme/useTheme'

const THEMES: { id: ThemeName; label: string; hint: string }[] = [
  { id: 'dynamic', label: 'Dynamic', hint: 'Warna mengikuti sampul lagu' },
  { id: 'dark', label: 'Dark', hint: 'Gelap, aksen ungu tetap' },
  { id: 'light', label: 'Light', hint: 'Terang, aksen biru' }
]

interface Props {
  name: string
  onName: (n: string) => void
  initial: string
  theme: ThemeName
  onTheme: (t: ThemeName) => void
}

export function Profile({ name, onName, initial, theme, onTheme }: Props): React.JSX.Element {
  const lib = useLibrary()
  const [status, setStatus] = useState<SyncStatus | null>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [notch, setNotch] = useState<boolean | null>(null)

  useEffect(() => {
    window.phinas.getNotchEnabled().then(setNotch).catch(() => setNotch(null))
  }, [])

  const load = useCallback(() => window.phinas.syncStatus().then(setStatus), [])

  useEffect(() => {
    void load()
    const t = setInterval(load, 5000)
    return () => clearInterval(t)
  }, [load])

  const signIn = async (e: FormEvent): Promise<void> => {
    e.preventDefault()
    setError(null)
    try {
      await window.phinas.syncSignIn(email, password)
      setPassword('')
      await load()
      await lib.refreshPartner()
    } catch (err) {
      setError(err instanceof Error ? err.message.replace(/^Error invoking remote method '\w+': Error: /, '') : 'Login gagal')
    }
  }

  return (
    <>
      <div className="profile-head">
        <div className="avatar-lg">{initial}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <span className="muted">Profil</span>
          <input
            className="profile-name"
            value={name}
            maxLength={30}
            onChange={(e) => onName(e.target.value)}
            aria-label="Nama tampilan"
          />
          <div className="profile-stats">
            <span>
              <strong>{lib.playlists.length}</strong> playlist
            </span>
            <span>
              <strong>{lib.likes.length}</strong> lagu disukai
            </span>
            {status?.signedIn && <span>{status.email}</span>}
          </div>
        </div>
      </div>

      <section className="profile-section">
        <h3>Tema</h3>
        <div className="grid">
          {THEMES.map((t) => (
            <button
              key={t.id}
              className={`card${theme === t.id ? ' active' : ''}`}
              style={theme === t.id ? { outline: '2px solid var(--accent)' } : undefined}
              onClick={() => onTheme(t.id)}
            >
              <strong>{t.label}</strong>
              <span className="muted">{t.hint}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="profile-section">
        <h3>Notch</h3>
        <label style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <input
            type="checkbox"
            checked={notch ?? true}
            disabled={notch === null}
            onChange={(e) => {
              setNotch(e.target.checked)
              void window.phinas.setNotchEnabled(e.target.checked)
            }}
          />
          <span>Tampilkan notch</span>
        </label>
        <p className="muted">Pill kecil di tengah atas layar saat ada lagu. Arahkan kursor untuk membuka kontrolnya.</p>
      </section>

      <section className="profile-section">
        <h3>Akun dan sync dengan pasangan</h3>
        {status && !status.configured && (
          <div className="notice">Supabase belum dikonfigurasi. Isi file .env lalu jalankan ulang app.</div>
        )}
        {status?.configured && status.signedIn && (
          <>
            <p>
              Masuk sebagai <strong>{status.email}</strong>.{' '}
              {status.pending === 0 ? 'Semua perubahan sudah tersinkron.' : `${status.pending} perubahan belum tersinkron.`}
            </p>
            {status.lastError && <div className="notice">Sync gagal: {status.lastError}. Akan dicoba lagi otomatis.</div>}
            <button
              className="btn secondary"
              onClick={async () => {
                await window.phinas.syncSignOut()
                await load()
                await lib.refreshPartner()
              }}
            >
              Keluar
            </button>
          </>
        )}
        {status?.configured && !status.signedIn && (
          <form onSubmit={signIn} style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 320 }}>
            <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            {error && <div className="notice">{error}</div>}
            <button className="btn" type="submit">Masuk</button>
          </form>
        )}
      </section>
    </>
  )
}
