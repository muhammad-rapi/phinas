import { useState } from 'react'
import { AuthForm, LegalLinks, type AuthMode } from '../components/AuthForm'

/** First launch: sign up, sign in, or go on without an account. Covers the whole window. */
export function Welcome({ onDone }: { onDone: () => void }): React.JSX.Element {
  const [mode, setMode] = useState<AuthMode | null>(null)

  const skip = async (): Promise<void> => {
    await window.phinas.finishWelcome().catch(() => undefined)
    onDone()
  }

  return (
    <div className="welcome" role="dialog" aria-modal="true" aria-label="Selamat datang">
      <div className="welcome-drag" aria-hidden="true" />
      <div className="welcome-body">
        <h1 className="welcome-title">
          Selamat datang di <em>Phinas.</em>
        </h1>
        <p className="welcome-line">Dengar musik bareng teman dan pasanganmu.</p>
        {mode === null ? (
          <div className="welcome-actions">
            <button className="btn" onClick={() => setMode('up')}>
              Punya kode undangan? Daftar
            </button>
            <button className="btn secondary" onClick={() => setMode('in')}>
              Sudah punya akun? Masuk
            </button>
            <button className="text-link" onClick={() => void skip()}>
              Pakai tanpa akun
            </button>
          </div>
        ) : (
          <>
            <AuthForm mode={mode} onMode={setMode} onDone={onDone} />
            <button className="text-link welcome-back" onClick={() => setMode(null)}>
              Kembali
            </button>
          </>
        )}
        <p className="welcome-legal small muted">
          <LegalLinks />
        </p>
      </div>
    </div>
  )
}
