import type { Metadata } from 'next'
import { AdminApp } from './AdminApp'

export const metadata: Metadata = { title: 'Admin', robots: { index: false, follow: false } }

export default function AdminPage(): React.JSX.Element {
  return (
    <main className="admin">
      <div className="wrap">
        <AdminApp />
      </div>
    </main>
  )
}
