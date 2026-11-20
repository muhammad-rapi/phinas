import type { Metadata } from 'next'
import { CONTACT_EMAIL, LEGAL_UPDATED } from '@/lib/site'

export const metadata: Metadata = { title: 'Kebijakan Privasi' }

export default function Privacy(): React.JSX.Element {
  return (
    <main className="legal">
      <div className="wrap">
        <div className="label">Phinas</div>
        <h1>Kebijakan Privasi</h1>
        <p className="updated">Terakhir diperbarui {LEGAL_UPDATED}</p>

        <p>
          Phinas adalah aplikasi musik kecil yang dibuat untuk dipakai bersama teman. Halaman ini menjelaskan data apa yang disimpan, siapa
          yang bisa melihatnya, dan cara menghapusnya. Phinas tidak memasang iklan, tidak memakai pelacak analitik, dan tidak menjual data
          siapa pun.
        </p>

        <h2>Tanpa akun</h2>
        <p>
          Kamu bisa memutar, mencari, dan melihat lirik tanpa akun. Playlist, lagu yang disukai, dan riwayat putar disimpan hanya di
          komputermu.
        </p>

        <h2>Data yang disimpan di server saat kamu punya akun</h2>
        <ul>
          <li>Email dan password. Password disimpan dalam bentuk hash, jadi tidak bisa dibaca siapa pun, termasuk admin.</li>
          <li>Nama tampilan, kode teman, siapa yang mengundangmu, dan kapan kamu menyetujui Syarat &amp; Ketentuan.</li>
          <li>Teman, permintaan pertemanan, dan pasangan.</li>
          <li>Kode undangan yang kamu buat dan siapa yang memakainya.</li>
          <li>Playlist (nama, daftar lagu, dan siapa yang boleh melihatnya) dan lagu yang kamu sukai.</li>
          <li>Pilihan siapa yang boleh mengajakmu dengar bareng.</li>
          <li>Kapan akun dibuat dan kapan terakhir masuk.</li>
        </ul>
        <p>
          Riwayat putar dan data yang dipakai untuk saran lagu <b>tidak</b> dikirim ke server; semuanya tetap di komputermu.
        </p>

        <h2>Siapa yang bisa melihat apa</h2>
        <ul>
          <li>
            <b>Temanmu</b> melihat nama tampilanmu, lagu yang kamu sukai, dan playlist yang kamu atur ke &ldquo;Teman&rdquo; atau
            &ldquo;Publik&rdquo;.
          </li>
          <li>
            <b>Status online:</b> temanmu bisa melihat saat Phinas terbuka di komputermu. Ini tetap terlihat walaupun pilihan dengar bareng
            kamu atur ke &ldquo;Tidak ada&rdquo;.
          </li>
          <li>
            <b>Semua pengguna Phinas</b> bisa melihat playlist yang kamu atur ke &ldquo;Publik&rdquo;, beserta nama tampilanmu. Playlist publik
            tidak ditampilkan di situs web ini.
          </li>
          <li>Playlist &ldquo;Pribadi&rdquo; hanya bisa dilihat olehmu.</li>
          <li>
            <b>Saat dengar bareng</b>, lagu yang diputar dan posisinya dikirim langsung ke teman yang ikut. Pesan ini tidak disimpan.
          </li>
          <li>
            <b>Admin Phinas</b> melihat daftar pengguna: email, nama tampilan, tanggal daftar, terakhir masuk, siapa yang mengundang, dan jumlah
            teman. Pengelola Phinas juga punya akses teknis ke database untuk perawatan dan tidak memakainya untuk hal lain.
          </li>
        </ul>

        <h2>Layanan pihak ketiga</h2>
        <ul>
          <li>
            <b>Supabase</b> menyimpan akun dan data di atas.
          </li>
          <li>
            <b>YouTube Music</b>: pencarian dan pemutaran lagu terhubung langsung dari komputermu ke YouTube. Sampul lagu dimuat dari server
            Google.
          </li>
          <li>
            <b>LRCLIB</b>: judul dan artis lagu dikirim untuk mencari lirik.
          </li>
          <li>
            <b>Spotify</b>: hanya saat kamu mengimpor, link yang kamu tempel dibuka untuk membaca daftar lagunya.
          </li>
          <li>
            <b>GitHub</b>: aplikasi memeriksa versi terbaru di GitHub dan mengunduh pembaruan dari sana.
          </li>
          <li>
            <b>Vercel</b> menjalankan situs web ini dan mencatat log akses standar.
          </li>
        </ul>

        <h2>Menghapus data</h2>
        <p>
          Buka <b>Profil → Hapus akun</b> di aplikasi. Akun, teman, playlist, lagu yang disukai, dan kode undanganmu langsung dihapus dari
          server. Data yang tersimpan di komputermu tetap ada sampai kamu menghapus aplikasinya. Kalau tidak bisa masuk lagi, kirim email ke{' '}
          <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> dari alamat yang terdaftar.
        </p>

        <h2>Perubahan</h2>
        <p>
          Kalau kebijakan ini berubah, tanggal di atas ikut diperbarui. Pertanyaan bisa dikirim ke{' '}
          <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
        </p>
      </div>
    </main>
  )
}
