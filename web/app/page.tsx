import { latestRelease, type Download } from '@/lib/release'
import { RELEASES_URL } from '@/lib/site'

/** Rebuilt at most once an hour, so a new GitHub release shows up without a deploy. */
export const revalidate = 3600

const FEATURES: [string, string][] = [
  ['Dengar bareng', 'Ajak teman atau pasanganmu mendengarkan lagu yang sama di detik yang sama. Jeda, putar, dan geser berlaku untuk berdua.'],
  ['Teman dan pasangan', 'Lihat siapa yang sedang online, buka playlist yang mereka bagikan, dan tandai satu teman sebagai pasangan.'],
  ['Lirik yang ikut bernyanyi', 'Baris yang sedang dinyanyikan menyala dan bergulir sendiri, juga di notch kecil di atas layar.'],
  ['Playlist milikmu', 'Atur siapa yang boleh melihat setiap playlist: hanya kamu, semua temanmu, atau semua pengguna Phinas.'],
  ['Warna mengikuti sampul', 'Latar dan aksen berubah mengikuti sampul lagu. Mode Siang dan Malam mengikuti komputermu.'],
  ['Saran yang belajar', 'Phinas mengingat yang kamu putar, sukai, dan lewati, lalu menyusun lagu untukmu. Antrean habis, lagu serupa lanjut sendiri.'],
  ['Impor dari Spotify', 'Tempel link playlist atau album publik. Lagunya dicari otomatis di YouTube Music.'],
  ['Pembaruan otomatis', 'Di Windows pembaruan terpasang sendiri. Di Mac, Phinas memberi tahu saat versi baru tersedia.']
]

const SHOTS: [string, string][] = [
  ['home', 'Beranda dengan lagu yang sedang ramai dan playlist-mu'],
  ['search', 'Pencarian lagu dan playlist publik'],
  ['lyrics', 'Lirik layar penuh yang bergulir bersama lagu']
]

function DownloadButton({ d, label, sub }: { d: Download | null; label: string; sub: string }): React.JSX.Element {
  if (!d) {
    return (
      <a className="btn ghost dl" href={RELEASES_URL}>
        {label}
        <small>Lihat di GitHub</small>
      </a>
    )
  }
  return (
    <a className="btn dl" href={d.url}>
      {label}
      <small>
        {sub} · {d.mb} MB
      </small>
    </a>
  )
}

export default async function Home(): Promise<React.JSX.Element> {
  const release = await latestRelease()
  const sums = [release?.mac, release?.win].filter((d): d is Download => Boolean(d?.sha256))

  return (
    <main>
      <section className="hero" id="unduh">
        <div className="wrap">
          <div className="label">{release ? `Versi ${release.version}` : 'Mac dan Windows'}</div>
          <h1>
            Musik, <em>dengar bareng.</em>
          </h1>
          <p className="lead">
            Phinas memutar lagu dari YouTube Music, menyimpan playlist-mu, dan mengajak teman atau pasanganmu mendengarkan lagu yang sama di
            saat yang sama.
          </p>
          <div className="dl-row">
            <DownloadButton d={release?.mac ?? null} label="Unduh untuk Mac" sub="Apple Silicon" />
            <DownloadButton d={release?.win ?? null} label="Unduh untuk Windows" sub="Windows 10/11, 64-bit" />
          </div>
          <p className="dl-note">
            Memutar, mencari, dan lirik bisa dipakai tanpa akun. Untuk berteman dan dengar bareng, kamu perlu kode undangan dari teman yang
            sudah memakai Phinas. Installer belum ditandatangani, jadi saat pertama dibuka muncul peringatan keamanan; caranya ada di bawah.
          </p>
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <h2>
            Yang bisa dilakukan <em>Phinas</em>
          </h2>
          <div className="features">
            {FEATURES.map(([t, d]) => (
              <article className="feature" key={t}>
                <h3>{t}</h3>
                <p>{d}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <h2>Seperti ini tampilannya</h2>
          <div className="shots">
            {SHOTS.map(([img, caption]) => (
              <figure className="shot" key={img}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/img/${img}.jpg`} alt={caption} width={1280} height={800} loading="lazy" />
                <figcaption>{caption}</figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <h2>Cara memasang</h2>
          <div className="steps">
            <div>
              <h3>Mac</h3>
              <ol>
                <li>Buka file .dmg, lalu seret Phinas ke Applications.</li>
                <li>Buka Phinas dari Applications. macOS menolak karena pengembang tidak bisa diverifikasi. Pilih Selesai.</li>
                <li>
                  Buka Pengaturan Sistem → Privasi &amp; Keamanan, gulir ke bawah, klik <b>Tetap Buka</b> di samping Phinas. Di macOS 14 atau lebih
                  lama, klik kanan Phinas lalu pilih Buka.
                </li>
                <li>
                  Jika muncul pesan app rusak, buka Terminal dan jalankan <code>xattr -cr /Applications/Phinas.app</code>
                </li>
              </ol>
            </div>
            <div>
              <h3>Windows</h3>
              <ol>
                <li>Jalankan file Phinas-Setup, lalu ikuti petunjuknya.</li>
                <li>
                  Jika muncul layar biru <i>Windows protected your PC</i>, klik <b>More info</b>.
                </li>
                <li>
                  Klik <b>Run anyway</b>. Pemasangan lalu berjalan.
                </li>
              </ol>
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <h2>Perlu diketahui</h2>
          <dl className="faq">
            <dt>Apakah aman dibuka?</dt>
            <dd>
              Peringatan muncul karena installer tidak memakai sertifikat pengembang berbayar. Kamu bisa mencocokkan checksum SHA-256 di bawah
              dengan file yang diunduh.
            </dd>
            <dt>Bagaimana cara daftar?</dt>
            <dd>Minta kode undangan dari teman yang sudah memakai Phinas, lalu pilih Daftar di aplikasi. Kalian otomatis berteman.</dd>
            <dt>Bisa di iPhone atau Android?</dt>
            <dd>Belum. Phinas hanya untuk komputer Mac dan Windows.</dd>
          </dl>
          {sums.length > 0 && (
            <div className="sha" style={{ marginTop: 28 }}>
              <div className="label">Checksum SHA-256</div>
              {sums.map((d) => (
                <div key={d.name}>
                  <span>{d.name}</span>
                  <code>{d.sha256}</code>
                </div>
              ))}
            </div>
          )}
          <p style={{ marginTop: 24 }}>
            <a href={RELEASES_URL}>Semua versi di GitHub</a>
          </p>
        </div>
      </section>
    </main>
  )
}
