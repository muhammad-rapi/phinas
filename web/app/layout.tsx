import type { Metadata, Viewport } from 'next'
import { Montserrat, Newsreader } from 'next/font/google'
import Link from 'next/link'
import { SITE_URL } from '@/lib/site'
import './globals.css'

const serif = Newsreader({ subsets: ['latin'], style: ['normal', 'italic'], variable: '--font-serif' })
const sans = Montserrat({ subsets: ['latin'], weight: ['400', '600', '700'], variable: '--font-sans' })

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: 'Phinas', template: '%s · Phinas' },
  description: 'Pemutar musik untuk Mac dan Windows: lirik yang berjalan, playlist, dan dengar bareng teman.',
  icons: { icon: '/icon.png' }
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f4efe6' },
    { media: '(prefers-color-scheme: dark)', color: '#1c1714' }
  ]
}

export default function RootLayout({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <html lang="id" className={`${serif.variable} ${sans.variable}`}>
      <body>
        <header className="top">
          <Link href="/" className="brand">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icon.png" alt="" width={28} height={28} />
            <span>Phinas</span>
          </Link>
          <nav className="top-nav">
            <Link href="/#unduh">Unduh</Link>
            <Link href="/privacy">Privasi</Link>
          </nav>
        </header>
        {children}
        <footer className="foot">
          <span>Phinas · dibuat untuk dengar bareng.</span>
          <nav>
            <Link href="/terms">Syarat &amp; Ketentuan</Link>
            <Link href="/privacy">Kebijakan Privasi</Link>
          </nav>
        </footer>
      </body>
    </html>
  )
}
