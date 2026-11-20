'use client'
import { useState } from 'react'
import { inviteState, shortDate, type AdminInvite, type InviteState } from '@/lib/admin'
import { friendlyError } from '@/lib/errors'
import { supabase } from '@/lib/supabase'

const STATE_TEXT: Record<InviteState, string> = { open: 'Aktif', used: 'Dipakai', expired: 'Kedaluwarsa', revoked: 'Dicabut' }

export function Invites({ invites, now, onChanged }: { invites: AdminInvite[]; now: Date; onChanged: () => Promise<void> }): React.JSX.Element {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fresh, setFresh] = useState<string | null>(null)

  const run = async (fn: () => Promise<{ error: { message: string } | null; data?: unknown }>): Promise<unknown> => {
    setBusy(true)
    setError(null)
    const { data, error } = await fn()
    setBusy(false)
    if (error) {
      setError(friendlyError(new Error(error.message)))
      return null
    }
    await onChanged()
    return data
  }

  const create = async (): Promise<void> => {
    const sb = supabase()
    if (!sb) return
    const code = await run(async () => await sb.rpc('create_invite'))
    if (typeof code === 'string') {
      setFresh(code)
      void navigator.clipboard?.writeText(code).catch(() => undefined)
    }
  }

  const revoke = async (code: string): Promise<void> => {
    const sb = supabase()
    if (!sb || !window.confirm(`Cabut kode ${code}?`)) return
    await run(async () => await sb.rpc('revoke_invite', { p_code: code }))
  }

  return (
    <section>
      <div className="admin-bar">
        <h2>Undangan</h2>
        <button className="btn small" disabled={busy} onClick={() => void create()}>
          Buat kode
        </button>
      </div>
      {fresh && (
        <p>
          Kode baru <code>{fresh}</code> sudah disalin. Berlaku 14 hari, sekali pakai.
        </p>
      )}
      {error && <p className="notice">{error}</p>}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Kode</th>
              <th>Status</th>
              <th>Dibuat oleh</th>
              <th>Dibuat</th>
              <th>Dipakai oleh</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {invites.map((i) => {
              const state = inviteState(i, now)
              return (
                <tr key={i.code} className={state === 'open' ? undefined : 'off'}>
                  <td>
                    <code>{i.code}</code>
                  </td>
                  <td>
                    {STATE_TEXT[state]}
                    {state === 'open' && <span className="muted"> · s.d. {shortDate(i.expiresAt)}</span>}
                  </td>
                  <td>{i.createdByName}</td>
                  <td>{shortDate(i.createdAt)}</td>
                  <td>{i.usedByName ?? '—'}</td>
                  <td>
                    {/* revoke_invite only takes the caller's own codes; the database refuses the rest. */}
                    {state === 'open' && (
                      <button className="btn small danger" disabled={busy} onClick={() => void revoke(i.code)}>
                        Cabut
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
            {invites.length === 0 && (
              <tr>
                <td colSpan={6} className="muted">
                  Belum ada kode undangan.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}
