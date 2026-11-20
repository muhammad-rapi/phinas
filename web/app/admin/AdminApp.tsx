'use client'
import type { Session } from '@supabase/supabase-js'
import { useEffect, useState } from 'react'
import { friendlyError } from '@/lib/errors'
import { supabase } from '@/lib/supabase'
import { Dashboard } from './Dashboard'

type Gate = { kind: 'loading' } | { kind: 'signedOut' } | { kind: 'notAdmin' } | { kind: 'admin'; name: string }

/** Signs the admin in and checks the role with my_profile(); everything else is enforced by the RPCs. */
export function AdminApp(): React.JSX.Element {
  const sb = supabase()
  const [gate, setGate] = useState<Gate>({ kind: 'loading' })

  useEffect(() => {
    if (!sb) return
    const check = async (session: Session | null): Promise<void> => {
      if (!session) return setGate({ kind: 'signedOut' })
      const { data, error } = await sb.rpc('my_profile')
      const p = data as { role?: string; disabled?: boolean; displayName?: string } | null
      if (error || !p || p.role !== 'admin' || p.disabled) {
        await sb.auth.signOut()
        return setGate({ kind: 'notAdmin' })
      }
      setGate({ kind: 'admin', name: p.displayName ?? '' })
    }
    void sb.auth.getSession().then(({ data }) => check(data.session))
    const { data: sub } = sb.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') void check(session)
    })
    return () => sub.subscription.unsubscribe()
  }, [sb])

  if (!sb) return <p className="notice">Supabase belum diatur (NEXT_PUBLIC_SUPABASE_URL dan NEXT_PUBLIC_SUPABASE_ANON_KEY).</p>
  if (gate.kind === 'loading') return <p className="muted">Memuat…</p>
  if (gate.kind === 'admin') return <Dashboard name={gate.name} onSignOut={() => void sb.auth.signOut()} />
  return <Login notAdmin={gate.kind === 'notAdmin'} />
}

function Login({ notAdmin }: { notAdmin: boolean }): React.JSX.Element {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    const sb = supabase()
    if (!sb) return
    setBusy(true)
    setError(null)
    const { error } = await sb.auth.signInWithPassword({ email: email.trim(), password })
    setBusy(false)
    if (error) setError(error.message === 'Invalid login credentials' ? 'Email atau password salah.' : friendlyError(error))
  }

  return (
    <form className="login" onSubmit={submit}>
      <div className="label">Phinas</div>
      <h1>
        Panel <em>admin</em>
      </h1>
      <p className="muted">Masuk dengan akun admin Phinas.</p>
      {notAdmin && <p className="notice">Akun ini bukan admin.</p>}
      {error && <p className="notice">{error}</p>}
      <label className="field">
        <span className="label">Email</span>
        <input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </label>
      <label className="field">
        <span className="label">Password</span>
        <input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
      </label>
      <button className="btn" disabled={busy}>
        {busy ? 'Masuk…' : 'Masuk'}
      </button>
    </form>
  )
}
