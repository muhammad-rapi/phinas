export type DayPart = 'pagi' | 'siang' | 'sore' | 'malam'

const DAYS = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']

/** Malam before 4, pagi before 11, siang before 15, sore before 18, malam otherwise. */
export function dayPart(hour: number): DayPart {
  if (hour < 4) return 'malam'
  if (hour < 11) return 'pagi'
  if (hour < 15) return 'siang'
  if (hour < 18) return 'sore'
  return 'malam'
}

/** useProfile shows "Kamu" when no name was set; that counts as no name here. */
const NO_NAME = /^(kamu)?$/i

/** Beranda's label, e.g. "KAMIS SORE · UNTUK RAFI", or "… · UNTUKMU" without a name. */
export function homeLabel(now: Date, name: string): string {
  const who = NO_NAME.test(name.trim()) ? 'untukmu' : `untuk ${name.trim()}`
  return `${DAYS[now.getDay()]} ${dayPart(now.getHours())} · ${who}`.toUpperCase()
}
