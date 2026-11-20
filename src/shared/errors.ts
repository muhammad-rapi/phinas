/** Indonesian text for the `phinas:<code>` errors raised by the Supabase RPCs. */
const MESSAGES: Record<string, string> = {
  invite_invalid: 'Kode undangan tidak ditemukan.',
  invite_used: 'Kode undangan ini sudah dipakai.',
  invite_expired: 'Kode undangan ini sudah kedaluwarsa.',
  invite_revoked: 'Kode undangan ini sudah dicabut.',
  registration_closed: 'Pendaftaran sedang ditutup.',
  terms_required: 'Setujui Syarat & Ketentuan dan Kebijakan Privasi dulu.',
  signup_failed: 'Pendaftaran gagal. Periksa kode undangan lalu coba lagi.',
  quota_exceeded: 'Jatah kode undanganmu sudah habis.',
  friend_code_invalid: 'Kode teman tidak ditemukan.',
  already_friends: 'Kalian sudah berteman.',
  self_friend: 'Itu kode temanmu sendiri.',
  partner_taken: 'Salah satu dari kalian sudah punya pasangan.',
  request_not_found: 'Permintaan ini sudah tidak ada.',
  not_friends: 'Kalian belum berteman.',
  listen_not_allowed: 'Dengar Bareng tidak diizinkan untuk teman ini.',
  account_disabled: 'Akunmu dinonaktifkan. Hubungi admin.',
  not_admin: 'Hanya admin yang bisa melakukan ini.',
  not_signed_in: 'Masuk dulu.',
  name_invalid: 'Nama harus 1 sampai 30 karakter.',
  scope_invalid: 'Pilihan Dengar Bareng tidak dikenal.',
  self_disable: 'Admin tidak bisa menonaktifkan dirinya sendiri.',
  config_unknown: 'Pengaturan tidak dikenal.',
  too_many_requests: 'Terlalu banyak permintaan pertemanan yang belum dijawab.',
  last_admin: 'Kamu admin terakhir. Jadikan orang lain admin dulu sebelum menghapus akun.',
  invalid_args: 'Permintaan tidak valid.',
  config_invalid: 'Nilai pengaturan tidak valid.',
  user_not_found: 'User tidak ditemukan.',
  not_owner: 'Playlist ini milik akun lain.'
}

const GENERIC = 'Terjadi kesalahan. Coba lagi.'

export function friendlyError(e: unknown): string {
  const raw = e instanceof Error ? e.message : typeof e === 'string' ? e : ''
  if (!raw) return GENERIC
  const code = /phinas:([a-z_]+)/.exec(raw)?.[1]
  if (code) {
    const msg = MESSAGES[code]
    if (msg) return msg
    console.warn('[phinas] unknown error code', code)
    return GENERIC
  }
  return raw.replace(/^Error invoking remote method '[^']+': (Error: )?/, '') || GENERIC
}
