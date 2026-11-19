import { Download, RefreshCw, X } from 'lucide-react'
import { useState } from 'react'
import { useUpdate } from '../update/useUpdate'

/** Top-of-page notice when a newer Phinas is out: download it (Mac) or restart to install (Windows). */
export function UpdateBanner(): React.JSX.Element | null {
  const u = useUpdate()
  // Dismissed for this version only: a later one shows again.
  const [hidden, setHidden] = useState<string | null>(null)
  if (!u || u.state === 'idle' || !u.latest || hidden === u.latest) return null

  const install = (): void => void window.phinas.installUpdate()
  let text: string
  let action: React.ReactNode = null
  if (u.state === 'downloading') {
    text = `Mengunduh Phinas ${u.latest}… ${u.progress ?? 0}%`
  } else if (u.state === 'ready') {
    text = `Phinas ${u.latest} siap dipasang.`
    action = (
      <button className="listen-action" onClick={install}>
        <RefreshCw size={13} /> Mulai ulang & perbarui
      </button>
    )
  } else {
    text = `Phinas ${u.latest} sudah tersedia (kamu pakai ${u.current}).`
    action = (
      <button className="listen-action" onClick={install}>
        <Download size={13} /> Unduh
      </button>
    )
  }
  return (
    <div className="notice update-banner" role="status">
      <span>{text}</span>
      {action}
      <button className="icon-btn" onClick={() => setHidden(u.latest!)} aria-label="Tutup" title="Nanti saja">
        <X size={14} />
      </button>
    </div>
  )
}
