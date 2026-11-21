import { Equal, Feather, Mic, Sparkles, Waves, type LucideIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { AppSettings, AudioQuality } from '../../../shared/types'
import { getEffects, setEffects } from '../audio/fx'
import { EQ_ORDER, EQ_PRESETS, type EqPreset } from '../audio/presets'
import { usePlayer } from '../player/PlayerProvider'
import { UpdateSection } from './Profile'

const EQ_ICONS: Record<EqPreset, LucideIcon> = { flat: Equal, bass: Waves, vocal: Mic, treble: Sparkles }

const QUALITIES: { id: AudioQuality; label: string; hint: string; Icon: LucideIcon }[] = [
  { id: 'auto', label: 'Otomatis', hint: 'Suara terbaik yang tersedia', Icon: Sparkles },
  { id: 'saver', label: 'Hemat data', hint: 'File lebih kecil, cocok untuk kuota terbatas', Icon: Feather }
]

/** Pengaturan: audio, sistem, and version. (Tema and notch stay on the profile page.) */
export function Settings(): React.JSX.Element {
  const player = usePlayer()
  const [fx, setFx] = useState(getEffects)
  const [app, setApp] = useState<AppSettings | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    window.phinas
      .getAppSettings()
      .then((s) => alive && setApp(s))
      .catch(() => alive && setError('Pengaturan tidak bisa dibaca.'))
    return () => {
      alive = false
    }
  }, [])

  const changeEq = (eq: EqPreset): void => {
    const next = { ...fx, eq }
    setFx(next)
    setEffects(next)
  }
  const changeLeveler = (leveler: boolean): void => {
    const next = { ...fx, leveler }
    setFx(next)
    setEffects(next)
  }
  const save = async (change: Partial<AppSettings>, call: () => Promise<void>): Promise<void> => {
    if (!app) return
    const before = app
    setApp({ ...app, ...change })
    setError(null)
    try {
      await call()
    } catch {
      setApp(before)
      setError('Pengaturan tidak tersimpan. Coba lagi.')
    }
  }

  return (
    <>
      <h1 className="page-title">
        <em>Pengaturan</em>
      </h1>
      {error && (
        <div className="notice" role="alert">
          {error}
        </div>
      )}

      <section className="sec pf-sec">
        <h2 className="section-title">Equalizer</h2>
        <div className="pf-themes pf-four" role="radiogroup" aria-label="Equalizer">
          {EQ_ORDER.map((id) => {
            const Icon = EQ_ICONS[id]
            return (
              <button key={id} role="radio" aria-checked={fx.eq === id} className={`pf-theme${fx.eq === id ? ' active' : ''}`} onClick={() => changeEq(id)}>
                <span className="pf-theme-icon" aria-hidden="true">
                  <Icon size={18} />
                </span>
                <strong>{EQ_PRESETS[id].label}</strong>
                <span className="small">{EQ_PRESETS[id].hint}</span>
              </button>
            )
          })}
        </div>
        <label className="pf-check" style={{ marginTop: 18 }}>
          <input type="checkbox" checked={fx.leveler} onChange={(e) => changeLeveler(e.target.checked)} />
          <span>Penyeimbang volume</span>
        </label>
        <p className="small pf-note">Meratakan bagian yang keras dan pelan, supaya tidak perlu sering mengubah volume. Berlaku langsung.</p>
      </section>

      <section className="sec pf-sec">
        <h2 className="section-title">Kualitas audio</h2>
        <div className="pf-themes" role="radiogroup" aria-label="Kualitas audio">
          {QUALITIES.map(({ id, label, hint, Icon }) => {
            const on = app?.audioQuality === id
            return (
              <button
                key={id}
                role="radio"
                aria-checked={on}
                className={`pf-theme${on ? ' active' : ''}`}
                disabled={!app}
                onClick={() => void save({ audioQuality: id }, () => window.phinas.setAudioQuality(id))}
              >
                <span className="pf-theme-icon" aria-hidden="true">
                  <Icon size={18} />
                </span>
                <strong>{label}</strong>
                <span className="small">{hint}</span>
              </button>
            )
          })}
        </div>
        <p className="small pf-note">Berlaku mulai lagu berikutnya.</p>
        <label className="pf-check" style={{ marginTop: 18 }}>
          <input type="checkbox" checked={player.autoplay} onChange={player.toggleAutoplay} />
          <span>Lanjutkan dengan lagu serupa</span>
        </label>
        <p className="small pf-note">Saat antrean habis, Phinas memutar lagu yang mirip dengan yang barusan.</p>
      </section>

      <section className="sec pf-sec">
        <h2 className="section-title">Sistem</h2>
        <label className="pf-check">
          <input
            type="checkbox"
            checked={app?.openAtLogin ?? false}
            disabled={!app}
            onChange={(e) => void save({ openAtLogin: e.target.checked }, () => window.phinas.setOpenAtLogin(e.target.checked))}
          />
          <span>Buka Phinas saat komputer menyala</span>
        </label>
        <p className="small pf-note">Hanya berlaku di app yang sudah dipasang, bukan saat dijalankan untuk pengembangan.</p>
      </section>

      <UpdateSection />

      <section className="sec pf-sec">
        <h2 className="section-title">Tentang</h2>
        <div className="pf-row">
          <button className="text-link" onClick={() => void window.phinas.openLegal('terms')}>
            Syarat &amp; Ketentuan
          </button>
          <button className="text-link" onClick={() => void window.phinas.openLegal('privacy')}>
            Kebijakan Privasi
          </button>
        </div>
      </section>
    </>
  )
}
