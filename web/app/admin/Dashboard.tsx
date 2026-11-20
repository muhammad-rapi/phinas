'use client'
import { useCallback, useEffect, useState } from 'react'
import { summarize, toSettings, type AdminInvite, type AdminUser, type AppSettings } from '@/lib/admin'
import { friendlyError } from '@/lib/errors'
import { supabase } from '@/lib/supabase'
import { Invites } from './Invites'
import { Settings } from './Settings'
import { Users } from './Users'

export interface Data {
  users: AdminUser[]
  invites: AdminInvite[]
  settings: AppSettings
}

async function load(): Promise<Data> {
  const sb = supabase()
  if (!sb) throw new Error('Supabase belum diatur.')
  const [u, i, c] = await Promise.all([sb.rpc('admin_list_users'), sb.rpc('admin_list_invites'), sb.from('app_config').select('key, value')])
  const err = u.error ?? i.error ?? c.error
  if (err) throw new Error(err.message)
  return { users: u.data as AdminUser[], invites: i.data as AdminInvite[], settings: toSettings(c.data ?? []) }
}

export function Dashboard({ name, onSignOut }: { name: string; onSignOut: () => void }): React.JSX.Element {
  const [data, setData] = useState<Data | null>(null)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    try {
      setData(await load())
      setError(null)
    } catch (e) {
      setError(friendlyError(e))
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  const now = new Date()
  const s = data ? summarize(data.users, data.invites, now) : null

  return (
    <>
      <div className="admin-bar">
        <div>
          <div className="label">Admin · {name}</div>
          <h1>
            Panel <em>Phinas</em>
          </h1>
        </div>
        <div className="row-actions">
          <button className="btn ghost small" onClick={() => void reload()}>
            Muat ulang
          </button>
          <button className="btn ghost small" onClick={onSignOut}>
            Keluar
          </button>
        </div>
      </div>
      {error && <p className="notice">{error}</p>}
      {!data && !error && <p className="muted">Memuat…</p>}
      {data && s && (
        <>
          <div className="stats">
            <Stat n={s.users} label="Pengguna" />
            <Stat n={s.activeWeek} label="Aktif 7 hari" />
            <Stat n={s.disabled} label="Dinonaktifkan" />
            <Stat n={s.openInvites} label="Undangan terbuka" />
          </div>
          <Users users={data.users} now={now} onChanged={reload} />
          <Invites invites={data.invites} now={now} onChanged={reload} />
          <Settings settings={data.settings} onChanged={reload} />
        </>
      )}
    </>
  )
}

function Stat({ n, label }: { n: number; label: string }): React.JSX.Element {
  return (
    <div className="stat">
      <b>{n}</b>
      <span className="label">{label}</span>
    </div>
  )
}
