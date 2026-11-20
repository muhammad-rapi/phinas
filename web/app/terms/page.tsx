import type { Metadata } from 'next'
import Link from 'next/link'
import { CONTACT_EMAIL, LEGAL_UPDATED } from '@/lib/site'

export const metadata: Metadata = { title: 'Syarat & Ketentuan' }

export default function Terms(): React.JSX.Element {
  return (
    <main className="legal">
      <div className="wrap">
        <div className="label">Phinas</div>
        <h1>Syarat &amp; Ketentuan</h1>
        <p className="updated">Terakhir diperbarui {LEGAL_UPDATED}</p>

        <p>
          Dengan mendaftar atau memakai Phinas, kamu menyetujui syarat di bawah ini dan{' '}
          <Link href="/privacy">Kebijakan Privasi</Link>. Phinas adalah proyek pribadi yang gratis, dibuat untuk dipakai bersama teman.
        </p>

        <h2>Akun</h2>
        <ul>
          <li>Pendaftaran hanya dengan kode undangan. Satu orang, satu akun.</li>
          <li>Kamu bertanggung jawab menjaga password-mu. Phinas belum punya reset password lewat email; hubungi admin kalau lupa.</li>
          <li>Kamu boleh memberi kode undangan kepada orang yang kamu kenal. Kamu menjadi pengundang mereka.</li>
          <li>Kamu harus berusia minimal 13 tahun, atau memakai Phinas dengan izin orang tua atau wali.</li>
        </ul>

        <h2>Pemakaian yang wajar</h2>
        <ul>
          <li>Phinas untuk mendengarkan musik secara pribadi, bukan untuk diputar ulang di tempat umum atau dijual kembali.</li>
          <li>
            Lagu, sampul, dan lirik milik pemegang haknya masing-masing dan dimuat dari YouTube Music dan LRCLIB. Phinas tidak menyimpan atau
            membagikan file lagu.
          </li>
          <li>Jangan memakai nama tampilan atau nama playlist yang menyinggung, menipu, atau melanggar hukum.</li>
          <li>Jangan mencoba membobol, membebani, atau menyalahgunakan server Phinas atau akun orang lain.</li>
        </ul>

        <h2>Penonaktifan</h2>
        <p>
          Admin dapat menonaktifkan akun yang melanggar syarat ini. Akun yang dinonaktifkan tidak bisa masuk, tidak terlihat oleh teman, dan
          tidak bisa dengar bareng. Kamu bisa menghapus akunmu sendiri kapan saja dari Profil.
        </p>

        <h2>Tanpa jaminan</h2>
        <p>
          Phinas diberikan apa adanya. Layanan bisa berhenti, berubah, atau terganggu kapan saja, misalnya saat YouTube mengubah sistemnya.
          Sejauh diizinkan hukum, pembuat Phinas tidak bertanggung jawab atas kerugian karena memakai atau tidak bisa memakai Phinas.
        </p>

        <h2>Perubahan dan hukum</h2>
        <p>
          Syarat ini dapat diperbarui; tanggal di atas ikut berubah, dan perubahan besar diumumkan di aplikasi atau di situs ini. Syarat ini
          tunduk pada hukum Republik Indonesia. Pertanyaan: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
        </p>
      </div>
    </main>
  )
}
