'use client'
import { useState } from 'react'
import { filterUsers, relativeTime, shortDate, type AdminUser } from '@/lib/admin'
import { friendlyError } from '@/lib/errors'
import { supabase } from '@/lib/supabase'

export function Users({ users, now, onChanged }: { users: AdminUser[]; now: Date; onChanged: () => Promise<void> }): React.JSX.Element {
  const [query, setQuery] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const shown = filterUsers(users, query)

  const toggle = async (u: AdminUser): Promise<void> => {
    const disable = !u.disabled
    const ask = disable
      ? `Nonaktifkan ${u.displayName}? Dia langsung keluar dari semua perangkat dan tidak terlihat oleh teman.`
      : `Aktifkan lagi ${u.displayName}?`
    if (!window.confirm(ask)) return
    const sb = supabase()
    if (!sb) return
    setBusy(u.id)
    setError(null)
    const { error } = await sb.rpc('admin_set_disabled', { p_user: u.id, p_disabled: disable })
    setBusy(null)
    if (error) setError(friendlyError(new Error(error.message)))
    else await onChanged()
  }

  return (
    <section>
      <div className="admin-bar">
        <h2>Pengguna</h2>
        <input className="search" type="search" placeholder="Cari nama atau email" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Cari pengguna" />
      </div>
      {error && <p className="notice">{error}</p>}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Nama</th>
              <th>Email</th>
              <th>Daftar</th>
              <th>Terakhir masuk</th>
              <th>Diundang oleh</th>
              <th>Teman</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {shown.map((u) => (
              <tr key={u.id} className={u.disabled ? 'off' : undefined}>
                <td>
                  {u.displayName}
                  {u.role === 'admin' && <span className="tag">Admin</span>}
                  {u.disabled && <span className="tag off">Nonaktif</span>}
                </td>
                <td>{u.email ?? '—'}</td>
                <td>{shortDate(u.createdAt)}</td>
                <td>{relativeTime(u.lastSignInAt, now)}</td>
                <td>{u.invitedByName ?? '—'}</td>
                <td className="num">{u.friendCount}</td>
                <td>
                  {u.role !== 'admin' && (
                    <button className={`btn small ${u.disabled ? 'ghost' : 'danger'}`} disabled={busy === u.id} onClick={() => void toggle(u)}>
                      {u.disabled ? 'Aktifkan' : 'Nonaktifkan'}
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {shown.length === 0 && (
              <tr>
                <td colSpan={7} className="muted">
                  {users.length === 0 ? 'Belum ada pengguna.' : 'Tidak ada yang cocok.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}
