import { useEffect, useRef, useState } from 'react'
import { friendlyError } from '../../../shared/errors'
import type { ListenScope, SyncStatus } from '../../../shared/types'
import { useLibrary } from '../library/LibraryProvider'
import { useNotchEnabled } from '../notch/useNotchEnabled'
import { useSocial } from '../social/SocialProvider'
import type { ThemeMode } from '../theme/mode'
import { useUpdate } from '../update/useUpdate'
import type { Nav } from '../views'

const THEMES: { id: ThemeMode; label: string; hint: string }[] = [
  { id: 'system', label: 'Ikuti sistem', hint: 'Siang atau malam mengikuti komputer' },
  { id: 'day', label: 'Siang', hint: 'Kertas terang' },
  { id: 'night', label: 'Malam', hint: 'Tinta gelap' }
]

const SCOPES: { id: ListenScope; label: string; hint: string }[] = [
  { id: 'friends', label: 'Semua teman', hint: 'Teman mana pun yang online' },
  { id: 'partner', label: 'Pasangan saja', hint: 'Hanya pasanganmu' },
  { id: 'off', label: 'Tidak ada', hint: 'Tidak ada yang bisa mengajak' }
]

/** Typing pauses this long before the name goes to the server. */
const NAME_SAVE_MS = 800
const STATUS_REFRESH_MS = 5000

interface Props {
  nav: Nav
  /** The name kept on this computer (used while signed out). */
  name: string
  onName: (n: string) => void
  theme: ThemeMode
  onTheme: (t: ThemeMode) => void
}

export function Profile({ nav, name, onName, theme, onTheme }: Props): React.JSX.Element {
  const lib = useLibrary()
  const social = useSocial()
  const [status, setStatus] = useState<SyncStatus | null>(null)
  const [notch, setNotch] = useNotchEnabled()
  const [error, setError] = useState<string | null>(null)
  const [nameError, setNameError] = useState<string | null>(null)
  const [scopeError, setScopeError] = useState<string | null>(null)
  /** What is typed while signed in, until the server has it. */
  const [draft, setDraft] = useState<string | null>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const signedIn = social.signedIn

  const load = async (): Promise<void> => {
    setStatus(await window.phinas.syncStatus().catch(() => null))
  }

  // The status is local and cheap (pending changes, library errors); poll it while Profil is open.
  useEffect(() => {
    void load()
    const t = setInterval(() => void load(), STATUS_REFRESH_MS)
    return () => clearInterval(t)
  }, [])

  const shownName = signedIn ? (draft ?? social.me?.displayName ?? '') : name
  const initial = (shownName.trim()[0] ?? 'K').toUpperCase()

  const changeName = (value: string): void => {
    if (!signedIn) {
      onName(value)
      return
    }
    setDraft(value)
    setNameError(null)
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      const trimmed = value.trim()
      if (!trimmed) {
        setNameError(friendlyError(new Error('phinas:name_invalid')))
        return
      }
      window.phinas
        .updateMyProfile(trimmed, null)
        .then(() => social.refresh())
        .then(() => setDraft((d) => (d === value ? null : d)))
        .catch((e: unknown) => setNameError(friendlyError(e)))
    }, NAME_SAVE_MS)
  }

  const changeScope = async (scope: ListenScope): Promise<void> => {
    setScopeError(null)
    try {
      await window.phinas.updateMyProfile(null, scope)
      await social.refresh()
    } catch (e) {
      setScopeError(friendlyError(e))
    }
  }

  const signOut = async (): Promise<void> => {
    setError(null)
    try {
      await window.phinas.syncSignOut()
      await load()
    } catch (e) {
      setError(friendlyError(e))
    }
  }

  const deleteAccount = async (): Promise<void> => {
    const ok = window.confirm(
      'Hapus akun Phinas? Playlist dan lagu yang disukai di server ikut terhapus, dan teman-temanmu tidak bisa melihatnya lagi. Data di komputer ini tetap ada.'
    )
    if (!ok) return
    setError(null)
    try {
      await window.phinas.deleteAccount()
      await load()
    } catch (e) {
      setError(friendlyError(e))
    }
  }

  return (
    <>
      <header className="pf-head">
        <div className="pf-avatar">{initial}</div>
        <div className="pf-who">
          <span className="label accent">Profil</span>
          <input className="pf-name" value={shownName} maxLength={30} onChange={(e) => changeName(e.target.value)} aria-label="Nama tampilan" />
          {nameError && (
            <div className="notice" role="alert">
              {nameError}
            </div>
          )}
          <div className="pf-stats">
            <span>
              <strong>{lib.playlists.length}</strong> playlist
            </span>
            <span>
              <strong>{lib.likes.length}</strong> lagu disukai
            </span>
            {signedIn && social.email && <span>{social.email}</span>}
          </div>
        </div>
      </header>

      <section className="sec pf-sec">
        <h2 className="section-title">Tema</h2>
        <div className="pf-themes" role="radiogroup" aria-label="Tema">
          {THEMES.map((t) => (
            <button
              key={t.id}
              role="radio"
              aria-checked={theme === t.id}
              className={`pf-theme${theme === t.id ? ' active' : ''}`}
              onClick={() => onTheme(t.id)}
            >
              <strong>{t.label}</strong>
              <span className="small">{t.hint}</span>
            </button>
          ))}
        </div>
      </section>

      {signedIn && (
        <section className="sec pf-sec">
          <h2 className="section-title">Siapa yang boleh mengajak dengar bareng</h2>
          <div className="pf-themes" role="radiogroup" aria-label="Siapa yang boleh mengajak dengar bareng">
            {SCOPES.map((s) => {
              const on = social.me?.listenScope === s.id
              return (
                <button
                  key={s.id}
                  role="radio"
                  aria-checked={on}
                  className={`pf-theme${on ? ' active' : ''}`}
                  disabled={social.offline || !social.me}
                  onClick={() => void changeScope(s.id)}
                >
                  <strong>{s.label}</strong>
                  <span className="small">{s.hint}</span>
                </button>
              )
            })}
          </div>
          <p className="small pf-note">Teman tetap bisa melihat kamu sedang online.</p>
          {scopeError && (
            <div className="notice" role="alert">
              {scopeError}
            </div>
          )}
        </section>
      )}

      <section className="sec pf-sec">
        <h2 className="section-title">Notch</h2>
        <label className="pf-check">
          <input type="checkbox" checked={notch ?? true} disabled={notch === null} onChange={(e) => setNotch(e.target.checked)} />
          <span>Tampilkan notch</span>
        </label>
        <p>Pill kecil di tengah atas layar saat ada lagu. Arahkan kursor untuk membuka kontrolnya.</p>
      </section>

      <UpdateSection />

      <section className="sec pf-sec">
        <h2 className="section-title">Akun</h2>
        {status && !status.configured && <div className="notice">Supabase belum dikonfigurasi. Isi file .env lalu jalankan ulang app.</div>}
        {status?.libraryError && (
          <div className="notice">
            Library akun tidak bisa dibuka ({status.libraryError}). Library sebelumnya tetap dipakai; tidak ada yang dihapus.
          </div>
        )}
        {status?.configured && status.signedIn && (
          <>
            {social.me?.disabled && <div className="notice">{friendlyError(new Error('phinas:account_disabled'))}</div>}
            <p>
              Masuk sebagai <strong>{status.email}</strong>.{' '}
              {status.pending === 0 ? 'Semua perubahan sudah tersinkron.' : `${status.pending} perubahan belum tersinkron.`}
            </p>
            {social.me && (
              <p>
                Kode temanmu: <strong className="pf-code">{social.me.friendCode}</strong>
              </p>
            )}
            {status.lastError && <div className="notice">Sync gagal: {status.lastError}. Akan dicoba lagi otomatis.</div>}
            {error && <div className="notice">{error}</div>}
            <div className="pf-row">
              <button className="btn secondary" onClick={() => void signOut()}>
                Keluar
              </button>
              <button className="btn secondary" onClick={() => void deleteAccount()}>
                Hapus akun
              </button>
            </div>
          </>
        )}
        {status?.configured && !status.signedIn && (
          <p>
            Belum masuk. Playlist dan lagu yang kamu sukai tersimpan di komputer ini.{' '}
            <button className="text-link" onClick={() => nav({ name: 'friends' })}>
              Masuk atau daftar di halaman Teman
            </button>
          </p>
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
    <section className="sec pf-sec">
      <h2 className="section-title">Pembaruan</h2>
      <p>{line}</p>
      <div className="pf-row">
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
