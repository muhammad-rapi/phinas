'use client'
import { useEffect, useState } from 'react'
import { parseQuota, type AppSettings } from '@/lib/admin'
import { friendlyError } from '@/lib/errors'
import { supabase } from '@/lib/supabase'

export function Settings({ settings, onChanged }: { settings: AppSettings; onChanged: () => Promise<void> }): React.JSX.Element {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [quota, setQuota] = useState(String(settings.invite_quota))

  useEffect(() => setQuota(String(settings.invite_quota)), [settings.invite_quota])

  const save = async (key: keyof AppSettings, value: boolean | number): Promise<void> => {
    const sb = supabase()
    if (!sb) return
    setBusy(true)
    setError(null)
    const { error } = await sb.rpc('admin_set_config', { p_key: key, p_value: value })
    setBusy(false)
    if (error) setError(friendlyError(new Error(error.message)))
    else await onChanged()
  }

  const parsed = parseQuota(quota)

  return (
    <section>
      <h2>Pengaturan</h2>
      {error && <p className="notice">{error}</p>}
      <div className="settings">
        <Toggle
          title="Pendaftaran dibuka"
          note="Kalau ditutup, kode undangan tidak bisa dipakai untuk daftar."
          on={settings.registration_open}
          busy={busy}
          onChange={(v) => void save('registration_open', v)}
        />
        <Toggle
          title="Dengar Bareng aktif"
          note="Kalau dimatikan, tidak ada yang bisa dengar bareng. Status online tetap terlihat."
          on={settings.listen_together_enabled}
          busy={busy}
          onChange={(v) => void save('listen_together_enabled', v)}
        />
        <div className="setting">
          <div>
            <b>Kuota undangan per pengguna</b>
            <p>Jumlah kode yang boleh dibuat setiap pengguna seumur akun. 0 menutup undangan dari pengguna. Admin tidak dibatasi.</p>
          </div>
          <form
            className="quota"
            onSubmit={(e) => {
              e.preventDefault()
              if (parsed !== null) void save('invite_quota', parsed)
            }}
          >
            <input inputMode="numeric" value={quota} onChange={(e) => setQuota(e.target.value)} aria-label="Kuota undangan" aria-invalid={parsed === null} />
            <button className="btn small" disabled={busy || parsed === null || parsed === settings.invite_quota}>
              Simpan
            </button>
          </form>
        </div>
      </div>
    </section>
  )
}

function Toggle(p: { title: string; note: string; on: boolean; busy: boolean; onChange: (v: boolean) => void }): React.JSX.Element {
  return (
    <div className="setting">
      <div>
        <b>{p.title}</b>
        <p>{p.note}</p>
      </div>
      <button className="switch" role="switch" aria-checked={p.on} aria-label={p.title} disabled={p.busy} onClick={() => p.onChange(!p.on)} />
    </div>
  )
}
