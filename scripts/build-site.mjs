// Builds the download page. Writes site/index.html (a full page for GitHub Pages) and
// site/artifact.html (the same page without the document tags, for a claude.ai Artifact).
// Run: node scripts/build-site.mjs
import { createHash } from 'node:crypto'
import { readFileSync, statSync, writeFileSync, mkdirSync } from 'node:fs'

const root = new URL('../', import.meta.url)
const read = (p) => readFileSync(new URL(p, root))
const REPO = 'muhammad-rapi/phinas'
const VERSION = '0.4.1'
const files = {
  mac: { name: `Phinas-${VERSION}-arm64.dmg`, path: `dist/Phinas-${VERSION}-arm64.dmg` },
  win: { name: `Phinas-Setup-${VERSION}.exe`, path: `dist/Phinas-Setup-${VERSION}.exe` }
}
for (const f of Object.values(files)) {
  f.mb = Math.round(statSync(new URL(f.path, root)).size / 1024 / 1024)
  f.sha = createHash('sha256').update(read(f.path)).digest('hex')
  f.url = `https://github.com/${REPO}/releases/download/v${VERSION}/${f.name}`
}
const img = (n) => `data:image/jpeg;base64,${read(`site/img/${n}.jpg`).toString('base64')}`
const logo = read('build/icon.svg')
  .toString()
  .replace(/<\?xml[^>]*\?>/, '')
  .replace(/ width="1024" height="1024"/, ' width="64" height="64" aria-hidden="true"')
  .replace(/id="label"/g, 'id="lg-label"')
  .replace(/url\(#label\)/g, 'url(#lg-label)')

const dict = {
  id: {
    nav_dl: 'Unduh',
    h1: 'Musik untuk berdua.',
    lead: 'Phinas memutar lagu dari YouTube Music, menyimpan playlist-mu dan playlist pasanganmu, dan menampilkan lirik yang berjalan mengikuti lagu.',
    dl_mac: 'Unduh untuk Mac',
    dl_win: 'Unduh untuk Windows',
    mac_sub: 'Apple Silicon (M1 sampai M4)',
    win_sub: 'Windows 10 dan 11, 64-bit',
    note_unsigned: 'Installer belum ditandatangani, jadi Mac dan Windows menampilkan peringatan keamanan saat pertama dibuka. Langkah membukanya ada di bawah.',
    f_title: 'Yang bisa dilakukan Phinas',
    f1_t: 'Lirik yang ikut bernyanyi',
    f1_d: 'Baris yang sedang dinyanyikan menyala dan bergulir sendiri. Tekan perbesar untuk tampilan layar penuh.',
    f2_t: 'Playlist berdua',
    f2_d: 'Masuk dengan akunmu sendiri. Lihat playlist pasangan dan salin ke library-mu.',
    f3_t: 'Impor dari Spotify',
    f3_d: 'Tempel link playlist atau album publik. Lagunya dicari otomatis di YouTube Music.',
    f4_t: 'Cari lagu dan playlist',
    f4_d: 'Hasil pencarian menampilkan playlist publik di samping lagu. Satu klik untuk memutar atau menyimpan.',
    f5_t: 'Warna mengikuti sampul',
    f5_d: 'Latar dan aksen berubah mengikuti sampul lagu yang diputar. Ada juga tema gelap dan terang.',
    f6_t: 'Antrean dan pintasan',
    f6_d: 'Putar berikutnya, tambah ke antrean, tombol media di keyboard, dan pintasan seperti spasi untuk jeda atau Cmd/Ctrl+Alt+Panah dari aplikasi mana pun.',
    f7_t: 'Saran lagu yang belajar dari seleramu',
    f7_d: 'Phinas mengingat yang kamu dengarkan, sukai, dan lewati, lalu menyusun Pilihan untukmu. Saat antrean habis, lagu serupa lanjut diputar otomatis.',
    f8_t: 'Notch di layar',
    f8_d: 'Pill kecil di tengah atas layar di Mac dan Windows, lengkap dengan lirik yang berjalan, tombol kontrol, geser posisi lagu, dan tambah ke playlist.',
    f9_t: 'Dengarkan bareng',
    f9_d: 'Ajak pasanganmu mendengarkan lagu yang sama pada detik yang sama. Jeda, putar, dan geser lagu berlaku untuk berdua.',
    f10_t: 'Beranda yang baru',
    f10_d: 'Sidebar, kotak-kotak Lanjutkan, Pilihan untukmu dan Artis favoritmu, tombol Putar acak di setiap daftar, dan ikon di menu bar Mac untuk menampilkan notch.',
    s_title: 'Seperti ini tampilannya',
    s1: 'Beranda dengan lagu yang sedang tren dan playlist-mu',
    s2: 'Pencarian dengan playlist publik dan lagu',
    s3: 'Lirik layar penuh yang bergulir bersama lagu',
    i_title: 'Cara memasang',
    i_mac_t: 'Mac',
    i_mac: ['Buka file .dmg, lalu seret Phinas ke Applications.', 'Buka Phinas dari Applications. macOS akan menolak dengan pesan tidak bisa memverifikasi pengembang. Pilih Selesai.', 'Buka Pengaturan Sistem, lalu Privasi & Keamanan. Gulir ke bawah dan klik Tetap Buka di samping Phinas. Di macOS 14 atau lebih lama, cukup klik kanan Phinas lalu pilih Buka.', 'Jika muncul pesan app rusak, buka Terminal dan jalankan: xattr -cr /Applications/Phinas.app'],
    i_win_t: 'Windows',
    i_win: ['Jalankan file Phinas-Setup, lalu ikuti petunjuknya.', 'Jika muncul layar biru Windows protected your PC, klik More info.', 'Klik Run anyway. Pemasangan lalu berjalan.'],
    sha_t: 'Checksum SHA-256',
    sha_d: 'Cocokkan dengan file yang kamu unduh untuk memastikan isinya utuh.',
    copy: 'Salin',
    copied: 'Tersalin',
    faq_title: 'Perlu diketahui',
    q1: 'Apakah aman dibuka?',
    a1: 'Peringatan muncul karena installer tidak memakai sertifikat pengembang berbayar. Kamu bisa mencocokkan checksum di atas dengan file yang diunduh.',
    q3: 'Bisa di iPhone atau Android?',
    a3: 'Belum. Phinas hanya untuk komputer Mac dan Windows.',
    q4: 'Perlu akun?',
    a4: 'Untuk memutar, mencari, dan lirik, tidak. Akun hanya dipakai untuk menyinkronkan playlist dengan pasangan.',
    foot: 'Dibuat untuk berdua.',
    all_rel: 'Semua versi di GitHub'
  },
  en: {
    nav_dl: 'Download',
    h1: 'Music, for two.',
    lead: 'Phinas plays songs from YouTube Music, keeps your playlists and your partner’s, and shows lyrics that follow the song.',
    dl_mac: 'Download for Mac',
    dl_win: 'Download for Windows',
    mac_sub: 'Apple Silicon (M1 to M4)',
    win_sub: 'Windows 10 and 11, 64-bit',
    note_unsigned: 'The installers are not code-signed, so macOS and Windows show a security warning the first time. How to open them is below.',
    f_title: 'What Phinas does',
    f1_t: 'Lyrics that sing along',
    f1_d: 'The line being sung lights up and scrolls by itself. Expand it for a full-screen view.',
    f2_t: 'Playlists for two',
    f2_d: 'Sign in with your own account. See your partner’s playlists and copy them to your library.',
    f3_t: 'Import from Spotify',
    f3_d: 'Paste a public playlist or album link. The songs are found on YouTube Music for you.',
    f4_t: 'Search songs and playlists',
    f4_d: 'Search shows public playlists next to songs. One click to play or save.',
    f5_t: 'Colors follow the cover',
    f5_d: 'The background and accents follow the cover of the playing song. Dark and light themes too.',
    f6_t: 'Queue and shortcuts',
    f6_d: 'Play next, add to queue, keyboard media keys, and shortcuts like space to pause or Cmd/Ctrl+Alt+Arrow from any app.',
    f7_t: 'Suggestions that learn your taste',
    f7_d: 'Phinas remembers what you play, like and skip, and builds Picks for you from it. When the queue ends, similar songs keep playing on their own.',
    f8_t: 'A notch on your screen',
    f8_d: 'A small pill at the top centre of the screen on Mac and Windows, with live lyrics, controls, seeking, and add to playlist.',
    f9_t: 'Listen together',
    f9_d: 'Invite your partner to hear the same song at the same second. Pause, play and seek apply to both of you.',
    f10_t: 'A new Home',
    f10_d: 'A sidebar, tiles for Continue, Picks for you and Favourite artists, a Shuffle button on every list, and a Mac menu bar icon to show the notch.',
    s_title: 'What it looks like',
    s1: 'Home, with what is trending and your playlists',
    s2: 'Search, with public playlists and songs',
    s3: 'Full-screen lyrics that scroll with the song',
    i_title: 'How to install',
    i_mac_t: 'Mac',
    i_mac: ['Open the .dmg and drag Phinas to Applications.', 'Open Phinas from Applications. macOS refuses and says it cannot verify the developer. Choose Done.', 'Open System Settings, then Privacy & Security. Scroll down and click Open Anyway next to Phinas. On macOS 14 or older, right-click Phinas and choose Open instead.', 'If a message says the app is damaged, open Terminal and run: xattr -cr /Applications/Phinas.app'],
    i_win_t: 'Windows',
    i_win: ['Run the Phinas-Setup file and follow the steps.', 'If a blue “Windows protected your PC” screen appears, click More info.', 'Click Run anyway. The install then continues.'],
    sha_t: 'SHA-256 checksums',
    sha_d: 'Compare with the file you downloaded to check that it is intact.',
    copy: 'Copy',
    copied: 'Copied',
    faq_title: 'Good to know',
    q1: 'Is it safe to open?',
    a1: 'The warning appears because the installers do not use a paid developer certificate. You can compare the checksum above with your download.',
    q3: 'Does it run on iPhone or Android?',
    a3: 'Not yet. Phinas is for Mac and Windows computers only.',
    q4: 'Do I need an account?',
    a4: 'Not for playing, searching or lyrics. An account is only used to sync playlists with your partner.',
    foot: 'Made for two.',
    all_rel: 'All versions on GitHub'
  }
}

const arrow =
  '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4v11m0 0 4.5-4.5M12 15l-4.5-4.5M5 19h14"/></svg>'
const icons = {
  lyrics: '<path d="M4 7h16M4 12h10M4 17h13"/>',
  two: '<circle cx="9" cy="9" r="4"/><circle cx="16" cy="12" r="4"/>',
  import: '<path d="M12 3v12m0 0 4-4m-4 4-4-4M5 20h14"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/>',
  color: '<circle cx="12" cy="12" r="8.5"/><path d="M12 3.5v17M3.5 12h17" opacity=".45"/>',
  queue: '<path d="M4 7h12M4 12h12M4 17h8M18 14v6m-3-3h6"/>',
  taste: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18"/>',
  notch: '<rect x="3" y="4" width="18" height="16" rx="3"/><path d="M8 4v1.5a1.5 1.5 0 0 0 1.5 1.5h5A1.5 1.5 0 0 0 16 5.5V4"/>'
}
const ic = (k) =>
  `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[k]}</svg>`

const t = dict.id
const feature = (n, icon) => `
      <article class="feature">
        <div class="feature-icon">${ic(icon)}</div>
        <h3 data-i18n="f${n}_t">${t[`f${n}_t`]}</h3>
        <p data-i18n="f${n}_d">${t[`f${n}_d`]}</p>
      </article>`
const steps = (key, list) => list.map((s, i) => `<li data-i18n="${key}.${i}">${s}</li>`).join('')
const shot = (n, key) => `
      <figure class="shot">
        <img src="${img(n)}" alt="" width="1280" height="800" loading="lazy" />
        <figcaption data-i18n="${key}">${t[key]}</figcaption>
      </figure>`

const style = `
:root {
  --ink: #12286f;
  --blue: #3a86f0;
  --sky: #bfe0ff;
  --bg: #f4f8ff;
  --surface: #ffffff;
  --surface-2: #e8f0fd;
  --text: #14204d;
  --muted: #53638f;
  --line: #d3e1fa;
  --btn-bg: #12286f;
  --btn-fg: #ffffff;
  --btn-2-bg: #ffffff;
  --btn-2-fg: #12286f;
  --shadow: 0 24px 60px -24px rgba(18, 40, 111, 0.35);
  --display: 'Montserrat', -apple-system, 'Segoe UI', system-ui, sans-serif;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme='light']) {
    --ink: #bfe0ff;
    --blue: #6aa6ff;
    --sky: #27438f;
    --bg: #0a1230;
    --surface: #111b44;
    --surface-2: #17235a;
    --text: #e9f0ff;
    --muted: #9fb0dc;
    --line: #23326e;
    --btn-bg: #3a86f0;
    --btn-fg: #ffffff;
    --btn-2-bg: #17235a;
    --btn-2-fg: #e9f0ff;
    --shadow: 0 24px 60px -24px rgba(0, 0, 0, 0.7);
    color-scheme: dark;
  }
}
:root[data-theme='dark'] {
  --ink: #bfe0ff; --blue: #6aa6ff; --sky: #27438f; --bg: #0a1230; --surface: #111b44; --surface-2: #17235a;
  --text: #e9f0ff; --muted: #9fb0dc; --line: #23326e; --btn-bg: #3a86f0; --btn-fg: #ffffff;
  --btn-2-bg: #17235a; --btn-2-fg: #e9f0ff; --shadow: 0 24px 60px -24px rgba(0, 0, 0, 0.7); color-scheme: dark;
}
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--text); font-family: var(--display); font-size: 16px; line-height: 1.6; -webkit-font-smoothing: antialiased; }
.wrap { max-width: 1120px; margin: 0 auto; padding-left: max(20px, env(safe-area-inset-left, 0px)); padding-right: max(20px, env(safe-area-inset-right, 0px)); }
header.top { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding-block: 20px; }
.brand { display: flex; align-items: center; gap: 12px; font-weight: 800; font-size: 20px; letter-spacing: -0.02em; color: var(--text); text-decoration: none; }
.brand svg { width: 40px; height: 40px; border-radius: 10px; }
.top-actions { display: flex; align-items: center; gap: 10px; }
.lang { display: inline-flex; border: 1px solid var(--line); border-radius: 999px; padding: 3px; background: var(--surface); }
.lang button { font: inherit; font-size: 13px; font-weight: 700; border: 0; background: none; color: var(--muted); padding: 6px 12px; border-radius: 999px; cursor: pointer; }
.lang button[aria-pressed='true'] { background: var(--btn-bg); color: var(--btn-fg); }
.btn { display: inline-flex; align-items: center; gap: 10px; font: inherit; font-weight: 700; text-decoration: none; padding: 14px 22px; border-radius: 14px; background: var(--btn-bg); color: var(--btn-fg); border: 1px solid transparent; transition: transform 0.15s, box-shadow 0.15s; }
.btn:hover { transform: translateY(-2px); box-shadow: 0 10px 24px -10px var(--blue); }
.btn.alt { background: var(--btn-2-bg); color: var(--btn-2-fg); border-color: var(--line); }
.btn.small { padding: 9px 16px; font-size: 14px; border-radius: 12px; }
:focus-visible { outline: 3px solid var(--blue); outline-offset: 3px; }
.hero { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.15fr); gap: 56px; align-items: center; padding-block: 40px 72px; }
.hero h1 { font-size: clamp(40px, 6vw, 68px); line-height: 1.04; letter-spacing: -0.035em; margin: 0 0 20px; text-wrap: balance; font-weight: 800; }
.hero p.lead { font-size: 19px; color: var(--muted); margin: 0 0 32px; max-width: 34em; }
.dl { display: flex; flex-wrap: wrap; gap: 14px; }
.dl-card { display: flex; flex-direction: column; gap: 6px; }
.dl-card span.sub { font-size: 13px; color: var(--muted); padding-left: 4px; }
.note { margin: 24px 0 0; font-size: 14px; color: var(--muted); max-width: 36em; }
.frame { border-radius: 16px; overflow: hidden; background: var(--surface); border: 1px solid var(--line); box-shadow: var(--shadow); }
.frame-bar { display: flex; gap: 7px; padding: 12px 14px; background: var(--surface-2); border-bottom: 1px solid var(--line); }
.frame-bar i { width: 11px; height: 11px; border-radius: 50%; background: var(--line); display: block; }
.frame img { display: block; width: 100%; height: auto; }
section { padding-block: 56px; }
h2 { font-size: clamp(26px, 3.4vw, 38px); letter-spacing: -0.025em; line-height: 1.15; margin: 0 0 32px; text-wrap: balance; font-weight: 800; }
.features { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 300px), 1fr)); gap: 18px; }
.feature { background: var(--surface); border: 1px solid var(--line); border-radius: 18px; padding: 24px; min-width: 0; }
.feature-icon { width: 44px; height: 44px; border-radius: 12px; background: var(--surface-2); color: var(--blue); display: grid; place-items: center; margin-bottom: 16px; }
.feature h3 { margin: 0 0 6px; font-size: 18px; letter-spacing: -0.01em; }
.feature p { margin: 0; color: var(--muted); font-size: 15px; }
.shots { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 24px; }
.shot { margin: 0; min-width: 0; }
.shot.wide { grid-column: 1 / -1; }
.shot img { width: 100%; height: auto; border-radius: 14px; border: 1px solid var(--line); box-shadow: var(--shadow); display: block; }
.shot figcaption { margin-top: 12px; font-size: 14px; color: var(--muted); }
.install { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 340px), 1fr)); gap: 18px; }
.panel { background: var(--surface); border: 1px solid var(--line); border-radius: 18px; padding: 24px; min-width: 0; }
.panel h3 { margin: 0 0 12px; font-size: 18px; }
.panel ol { margin: 0; padding-left: 22px; color: var(--muted); }
.panel li { margin-bottom: 8px; }
.sha { margin-top: 24px; }
.sha p { color: var(--muted); font-size: 14px; margin: 0 0 12px; }
.sha-row { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; padding: 12px 0; border-top: 1px solid var(--line); }
.sha-row b { font-size: 14px; min-width: 0; }
.sha-row code { font-family: ui-monospace, 'SF Mono', Menlo, Consolas, monospace; font-size: 12px; color: var(--muted); overflow-wrap: anywhere; flex: 1 1 260px; min-width: 0; }
details { background: var(--surface); border: 1px solid var(--line); border-radius: 14px; padding: 16px 20px; margin-bottom: 12px; }
summary { cursor: pointer; font-weight: 700; }
details p { margin: 12px 0 0; color: var(--muted); }
footer { border-top: 1px solid var(--line); margin-top: 32px; padding-block: 32px 48px; display: flex; flex-wrap: wrap; gap: 12px 24px; justify-content: space-between; color: var(--muted); font-size: 14px; }
footer a { color: var(--blue); }
@media (max-width: 860px) { .hero { grid-template-columns: minmax(0, 1fr); gap: 36px; padding-top: 12px; } .shots { grid-template-columns: minmax(0, 1fr); } }
@media (prefers-reduced-motion: reduce) { .btn { transition: none; } }
`

const body = `
<div class="wrap">
  <header class="top">
    <a class="brand" href="#top">${logo}<span>Phinas</span></a>
    <div class="top-actions">
      <div class="lang" role="group" aria-label="Language">
        <button type="button" data-lang="id" aria-pressed="true">ID</button>
        <button type="button" data-lang="en" aria-pressed="false">EN</button>
      </div>
      <a class="btn small" href="#unduh" data-i18n="nav_dl">${t.nav_dl}</a>
    </div>
  </header>

  <main id="top">
    <div class="hero">
      <div>
        <h1 data-i18n="h1">${t.h1}</h1>
        <p class="lead" data-i18n="lead">${t.lead}</p>
        <div class="dl" id="unduh">
          <div class="dl-card">
            <a class="btn" href="${files.mac.url}" target="_blank" rel="noopener">${arrow}<span data-i18n="dl_mac">${t.dl_mac}</span></a>
            <span class="sub"><span data-i18n="mac_sub">${t.mac_sub}</span> · ${files.mac.mb} MB</span>
          </div>
          <div class="dl-card">
            <a class="btn alt" href="${files.win.url}" target="_blank" rel="noopener">${arrow}<span data-i18n="dl_win">${t.dl_win}</span></a>
            <span class="sub"><span data-i18n="win_sub">${t.win_sub}</span> · ${files.win.mb} MB</span>
          </div>
        </div>
        <p class="note" data-i18n="note_unsigned">${t.note_unsigned}</p>
      </div>
      <div class="frame" aria-hidden="true">
        <div class="frame-bar"><i></i><i></i><i></i></div>
        <img src="${img('home')}" alt="" width="1280" height="800" />
      </div>
    </div>

    <section>
      <h2 data-i18n="f_title">${t.f_title}</h2>
      <div class="features">
        ${feature(1, 'lyrics')}${feature(2, 'two')}${feature(3, 'import')}${feature(4, 'search')}${feature(5, 'color')}${feature(6, 'queue')}${feature(7, 'taste')}${feature(8, 'notch')}${feature(9, 'two')}${feature(10, 'queue')}
      </div>
    </section>

    <section>
      <h2 data-i18n="s_title">${t.s_title}</h2>
      <div class="shots">
        ${shot('search', 's2')}${shot('lyrics', 's3')}
      </div>
    </section>

    <section>
      <h2 data-i18n="i_title">${t.i_title}</h2>
      <div class="install">
        <div class="panel"><h3 data-i18n="i_mac_t">${t.i_mac_t}</h3><ol>${steps('i_mac', t.i_mac)}</ol></div>
        <div class="panel"><h3 data-i18n="i_win_t">${t.i_win_t}</h3><ol>${steps('i_win', t.i_win)}</ol></div>
      </div>
      <div class="sha">
        <h3 data-i18n="sha_t" style="margin:24px 0 4px">${t.sha_t}</h3>
        <p data-i18n="sha_d">${t.sha_d}</p>
        <div class="sha-row"><b>${files.mac.name}</b><code id="sha-mac">${files.mac.sha}</code><button type="button" class="btn alt small" data-copy="sha-mac" data-i18n="copy">${t.copy}</button></div>
        <div class="sha-row"><b>${files.win.name}</b><code id="sha-win">${files.win.sha}</code><button type="button" class="btn alt small" data-copy="sha-win" data-i18n="copy">${t.copy}</button></div>
      </div>
    </section>

    <section>
      <h2 data-i18n="faq_title">${t.faq_title}</h2>
      ${[1, 3, 4].map((n) => `<details><summary data-i18n="q${n}">${t[`q${n}`]}</summary><p data-i18n="a${n}">${t[`a${n}`]}</p></details>`).join('\n      ')}
    </section>
  </main>

  <footer>
    <span data-i18n="foot">${t.foot}</span>
    <a href="https://github.com/${REPO}/releases" target="_blank" rel="noopener" data-i18n="all_rel">${t.all_rel}</a>
  </footer>
</div>
`

const script = `
(function () {
  var D = ${JSON.stringify(dict)};
  var lang = 'id';
  try { var s = localStorage.getItem('phinas.lang'); if (s === 'id' || s === 'en') lang = s; else if (!/^id/i.test(navigator.language || '')) lang = 'en'; } catch (e) { if (!/^id/i.test(navigator.language || '')) lang = 'en'; }
  function apply() {
    document.documentElement.lang = lang;
    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      var k = el.getAttribute('data-i18n'), v;
      if (k.indexOf('.') > 0) { var p = k.split('.'); v = D[lang][p[0]] && D[lang][p[0]][+p[1]]; } else v = D[lang][k];
      if (typeof v === 'string') el.textContent = v;
    });
    document.querySelectorAll('[data-lang]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-lang') === lang)); });
  }
  document.querySelectorAll('[data-lang]').forEach(function (b) {
    b.addEventListener('click', function () { lang = b.getAttribute('data-lang'); try { localStorage.setItem('phinas.lang', lang); } catch (e) {} apply(); });
  });
  document.querySelectorAll('[data-copy]').forEach(function (b) {
    b.addEventListener('click', function () {
      var el = document.getElementById(b.getAttribute('data-copy'));
      var done = function () { b.textContent = D[lang].copied; setTimeout(function () { b.textContent = D[lang].copy; }, 1600); };
      var fallback = function () { var r = document.createRange(); r.selectNodeContents(el); var sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(r); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(el.textContent).then(done, fallback); else fallback();
    });
  });
  apply();
})();
`

const fonts = '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;700;800&display=swap">'
const title = 'Phinas'
const desc = 'Phinas, pemutar musik desktop untuk berdua. Unduh untuk Mac dan Windows. / A desktop music player for two.'

mkdirSync(new URL('site/', root), { recursive: true })
writeFileSync(
  new URL('site/index.html', root),
  `<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${title}</title>
<meta name="description" content="${desc}">
${fonts}
<style>${style}</style>
</head>
<body>${body}<script>${script}</script>
</body>
</html>
`
)
writeFileSync(
  new URL('site/artifact.html', root),
  `<title>${title}</title>
<meta name="claude:viewport-fit-sides" content="cover">
${fonts}
<style>${style}</style>
${body}<script>${script}</script>
`
)
console.log('wrote site/index.html and site/artifact.html', (statSync(new URL('site/index.html', root)).size / 1024).toFixed(0) + ' KB')
