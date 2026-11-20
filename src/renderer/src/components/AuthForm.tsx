import { useState, type FormEvent, type MouseEvent } from 'react'
import { friendlyError } from '../../../shared/errors'
import type { LegalPage } from '../../../shared/links'

export type AuthMode = 'in' | 'up'

/** "Syarat & Ketentuan dan Kebijakan Privasi", opened in the browser. */
export function LegalLinks(): React.JSX.Element {
  const open =
    (page: LegalPage) =>
    (e: MouseEvent): void => {
      e.preventDefault()
      void window.phinas.openLegal(page)
    }
  return (
    <>
      <a href="#" onClick={open('terms')}>
        Syarat &amp; Ketentuan
      </a>{' '}
      dan{' '}
      <a href="#" onClick={open('privacy')}>
        Kebijakan Privasi
      </a>
    </>
  )
}

interface Props {
  mode: AuthMode
  onMode: (mode: AuthMode) => void
  /** After a successful sign-in or sign-up; the main process has already opened that account's library. */
  onDone: () => void
}

/** Sign in, or sign up with an invite code. Shared by the welcome screen and Teman. */
export function AuthForm({ mode, onMode, onDone }: Props): React.JSX.Element {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [accepted, setAccepted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent): Promise<void> => {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      if (mode === 'up') {
        await window.phinas.syncSignUp({ email, password, displayName, inviteCode, acceptedTerms: accepted })
      } else {
        await window.phinas.syncSignIn(email, password)
      }
      setPassword('')
      setInviteCode('')
      onDone()
    } catch (err) {
      // Signed in, but opening the account's library failed: Profil shows that error; don't trap the user here.
      const s = await window.phinas.syncStatus().catch(() => null)
      if (s?.signedIn) {
        setPassword('')
        setInviteCode('')
        onDone()
        return
      }
      setError(friendlyError(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="auth-form" onSubmit={submit}>
      {mode === 'up' && (
        <>
          <input
            className="field"
            placeholder="Kode undangan"
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
            aria-label="Kode undangan"
            required
            autoFocus
          />
          <input
            className="field"
            placeholder="Nama"
            value={displayName}
            maxLength={30}
            onChange={(e) => setDisplayName(e.target.value)}
            aria-label="Nama"
            required
          />
        </>
      )}
      <input
        className="field"
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        aria-label="Email"
        required
        autoFocus={mode === 'in'}
      />
      <input
        className="field"
        type="password"
        placeholder="Password"
        value={password}
        minLength={mode === 'up' ? 6 : undefined}
        onChange={(e) => setPassword(e.target.value)}
        aria-label="Password"
        required
      />
      {mode === 'up' && (
        <label className="auth-check">
          <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} required />
          <span>
            Saya setuju dengan <LegalLinks />.
          </span>
        </label>
      )}
      {error && (
        <div className="notice" role="alert">
          {error}
        </div>
      )}
      <div className="auth-actions">
        <button className="btn" type="submit" disabled={busy}>
          {busy ? 'Sebentar…' : mode === 'up' ? 'Daftar' : 'Masuk'}
        </button>
        <button
          type="button"
          className="text-link"
          onClick={() => {
            setError(null)
            onMode(mode === 'up' ? 'in' : 'up')
          }}
        >
          {mode === 'up' ? 'Sudah punya akun? Masuk' : 'Punya kode undangan? Daftar'}
        </button>
      </div>
    </form>
  )
}
