import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { friendlyError } from '../../../shared/errors'
import type { MyProfile, SyncStatus } from '../../../shared/types'
import { useLibrary } from '../library/LibraryProvider'
import { useNotchEnabled } from '../notch/useNotchEnabled'
import type { ThemeName } from '../theme/useTheme'
import { useUpdate } from '../update/useUpdate'

const THEMES: { id: ThemeName; label: string; hint: string }[] = [
  { id: 'dynamic', label: 'Dynamic', hint: 'Warna mengikuti sampul lagu' },
  { id: 'dark', label: 'Dark', hint: 'Gelap, aksen ungu tetap' },
  { id: 'light', label: 'Light', hint: 'Terang, aksen biru' }
]

const PROFILE_REFRESH_MS = 60_000

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
  const [notch, setNotch] = useNotchEnabled()
  const [mode, setMode] = useState<'in' | 'up'>('in')
  const [displayName, setDisplayName] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [accepted, setAccepted] = useState(false)
  const [profile, setProfile] = useState<MyProfile | null>(null)

  // The status is cheap and local; the profile is a server call, so it is fetched less often.
  const profileAt = useRef(0)
  const wasSignedIn = useRef(false)
  const load = useCallback(async (forceProfile = false) => {
    const s = await window.phinas.syncStatus()
    setStatus(s)
    const justSignedIn = s.signedIn && !wasSignedIn.current
    wasSignedIn.current = s.signedIn
    if (!s.signedIn) {
      setProfile(null)
      return
    }
    if (!forceProfile && !justSignedIn && Date.now() - profileAt.current < PROFILE_REFRESH_MS) return
    profileAt.current = Date.now()
    setProfile(await window.phinas.myProfile().catch(() => null))
  }, [])

  useEffect(() => {
    void load()
    const t = setInterval(() => void load(), 5000)
    return () => clearInterval(t)
  }, [load])

  const submit = async (e: FormEvent): Promise<void> => {
    e.preventDefault()
    setError(null)
    try {
      if (mode === 'up') {
        await window.phinas.syncSignUp({ email, password, displayName, inviteCode, acceptedTerms: accepted })
      } else {
        await window.phinas.syncSignIn(email, password)
      }
      setPassword('')
      setInviteCode('')
      await load(true)
      await lib.refreshPartner()
    } catch (err) {
      setError(friendlyError(err))
    }
  }

  const deleteAccount = async (): Promise<void> => {
    const ok = window.confirm(
      'Hapus akun Phinas? Playlist dan lagu yang disukai di server ikut terhapus, dan teman-temanmu tidak bisa melihatnya lagi. Data di komputer ini tetap ada.'
    )
    if (!ok) return
    try {
      await window.phinas.deleteAccount()
      await load(true)
      await lib.refreshPartner()
    } catch (err) {
      setError(friendlyError(err))
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
            onChange={(e) => setNotch(e.target.checked)}
          />
          <span>Tampilkan notch</span>
        </label>
        <p className="muted">Pill kecil di tengah atas layar saat ada lagu. Arahkan kursor untuk membuka kontrolnya.</p>
      </section>

      <UpdateSection />

      <section className="profile-section">
        <h3>Akun</h3>
        {status && !status.configured && (
          <div className="notice">Supabase belum dikonfigurasi. Isi file .env lalu jalankan ulang app.</div>
        )}
        {status?.configured && status.signedIn && (
          <>
            {profile?.disabled && <div className="notice">{friendlyError(new Error('phinas:account_disabled'))}</div>}
            <p>
              Masuk sebagai <strong>{status.email}</strong>.{' '}
              {status.pending === 0 ? 'Semua perubahan sudah tersinkron.' : `${status.pending} perubahan belum tersinkron.`}
            </p>
            {profile && (
              <p>
                Kode temanmu: <strong style={{ userSelect: 'text' }}>{profile.friendCode}</strong>
              </p>
            )}
            {status.lastError && <div className="notice">Sync gagal: {status.lastError}. Akan dicoba lagi otomatis.</div>}
            {error && <div className="notice">{error}</div>}
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                className="btn secondary"
                onClick={async () => {
                  await window.phinas.syncSignOut()
                  await load(true)
                  await lib.refreshPartner()
                }}
              >
                Keluar
              </button>
              <button className="btn secondary" onClick={() => void deleteAccount()}>
                Hapus akun
              </button>
            </div>
          </>
        )}
        {status?.configured && !status.signedIn && (
          <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 320 }}>
            {mode === 'up' && (
              <input
                placeholder="Nama"
                value={displayName}
                maxLength={30}
                onChange={(e) => setDisplayName(e.target.value)}
                required
              />
            )}
            <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <input
              type="password"
              placeholder="Password"
              value={password}
              minLength={mode === 'up' ? 6 : undefined}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            {mode === 'up' && (
              <>
                <input
                  placeholder="Kode undangan"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                  required
                />
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                  <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} required />
                  <span>
                    Saya setuju dengan{' '}
                    <a
                      href="#"
                      onClick={(e) => {
                        e.preventDefault()
                        void window.phinas.openLegal('terms')
                      }}
                    >
                      Syarat &amp; Ketentuan
                    </a>{' '}
                    dan{' '}
                    <a
                      href="#"
                      onClick={(e) => {
                        e.preventDefault()
                        void window.phinas.openLegal('privacy')
                      }}
                    >
                      Kebijakan Privasi
                    </a>
                    .
                  </span>
                </label>
              </>
            )}
            {error && <div className="notice">{error}</div>}
            <button className="btn" type="submit">
              {mode === 'up' ? 'Daftar' : 'Masuk'}
            </button>
            <button
              type="button"
              className="btn secondary"
              onClick={() => {
                setMode(mode === 'up' ? 'in' : 'up')
                setError(null)
              }}
            >
              {mode === 'up' ? 'Sudah punya akun? Masuk' : 'Punya kode undangan? Daftar'}
            </button>
          </form>
        )}
      </section>
    </>
  )
}

/** Version, and a manual "check for updates". */
function UpdateSection(): React.JSX.Element {
  const u = useUpdate()
  const [checking, setChecking] = useState(false)
  const [checked, setChecked] = useState(false)
  const check = async (): Promise<void> => {
    setChecking(true)
    try {
      await window.phinas.checkForUpdate()
    } finally {
      setChecking(false)
      setChecked(true)
    }
  }
  let line = u ? `Phinas ${u.current}` : 'Phinas'
  if (u?.state === 'available' || u?.state === 'ready') line += ` · versi ${u.latest} tersedia`
  else if (u?.state === 'downloading') line += ` · mengunduh ${u.latest} (${u.progress ?? 0}%)`
  else if (checked) line += ' · sudah versi terbaru'
  return (
    <section className="profile-section">
      <h3>Pembaruan</h3>
      <p className="muted">{line}</p>
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn secondary" onClick={() => void check()} disabled={checking || u?.state === 'downloading'}>
          {checking ? 'Memeriksa...' : 'Cek pembaruan'}
        </button>
        {(u?.state === 'available' || u?.state === 'ready') && (
          <button className="btn" onClick={() => void window.phinas.installUpdate()}>
            {u.state === 'ready' ? 'Mulai ulang & perbarui' : 'Unduh versi baru'}
          </button>
        )}
      </div>
    </section>
  )
}
