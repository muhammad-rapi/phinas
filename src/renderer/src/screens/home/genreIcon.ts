import {
  AudioLines,
  Brain,
  Clapperboard,
  CloudRain,
  Coffee,
  Disc3,
  Drum,
  Dumbbell,
  Earth,
  Flame,
  Gamepad2,
  Guitar,
  Headphones,
  Heart,
  Mic,
  MicVocal,
  Moon,
  Music,
  Music4,
  PartyPopper,
  Piano,
  Radio,
  Smile,
  Star,
  TrainFront,
  TreePalm,
  Users,
  Zap,
  type LucideIcon
} from 'lucide-react'

/** First matching keyword wins, so the more specific ones come first. */
const ICONS: [RegExp, LucideIcon][] = [
  [/chill/, Coffee],
  [/commute/, TrainFront],
  [/energi[sz]e/, Zap],
  [/feel good/, Smile],
  [/focus/, Brain],
  [/gaming/, Gamepad2],
  [/party/, PartyPopper],
  [/romance/, Heart],
  [/sad/, CloudRain],
  [/sleep/, Moon],
  [/workout/, Dumbbell],
  [/soundtrack|musical/, Clapperboard],
  [/dance|electronic/, Disc3],
  [/hip-?hop|rap/, Mic],
  [/r&b|soul/, AudioLines],
  [/metal/, Flame],
  [/rock|blues|country|folk|acoustic/, Guitar],
  [/classical/, Piano],
  [/jazz/, Music4],
  [/reggae|caribbean/, TreePalm],
  [/dangdut|african/, Drum],
  [/decades/, Radio],
  [/family/, Users],
  [/indie|alternative/, Headphones],
  [/pop/, MicVocal],
  [/arabic|bollywood|indian|latin|thai|j-|k-|mandopop|cantopop/, Earth],
  [/./, Star]
]

/** A lucide icon for a YouTube Music mood or genre title. */
export function genreIcon(title: string): LucideIcon {
  const t = title.toLowerCase()
  return ICONS.find(([re]) => re.test(t))?.[1] ?? Music
}

/** YouTube lists moods first; these titles are moods, everything else is a genre. */
const MOODS = /^(chill|commute|energi[sz]e|feel good|focus|gaming|party|romance|sad|sleep|workout)$/i
export const isMood = (title: string): boolean => MOODS.test(title.trim())

export interface MoodColors {
  accent: string
  accentText: string
  gradTop: string
}

/** Each mood's colours: calm, mid-saturation tones (no neon). */
const MOOD_COLORS: Record<string, MoodColors> = {
  chill: { accent: '#5b8def', accentText: '#9dbcf7', gradTop: '#1d2a4a' },
  commute: { accent: '#3fa7a0', accentText: '#8fd6d0', gradTop: '#173533' },
  energize: { accent: '#e8932a', accentText: '#f6c27a', gradTop: '#3d2a0a' },
  energise: { accent: '#e8932a', accentText: '#f6c27a', gradTop: '#3d2a0a' },
  'feel good': { accent: '#d9a93a', accentText: '#f1d38a', gradTop: '#3b2e12' },
  focus: { accent: '#6366f1', accentText: '#a5a7f8', gradTop: '#1f2050' },
  gaming: { accent: '#3fae6a', accentText: '#8fd6a8', gradTop: '#16331f' },
  party: { accent: '#b05bd6', accentText: '#d4a2ec', gradTop: '#33183f' },
  romance: { accent: '#e0607e', accentText: '#f0a3b5', gradTop: '#3d1822' },
  sad: { accent: '#64748b', accentText: '#a9b4c4', gradTop: '#1e232c' },
  sleep: { accent: '#4f5bb3', accentText: '#9aa2db', gradTop: '#171a36' },
  workout: { accent: '#e4572e', accentText: '#f2a088', gradTop: '#3d1a0f' }
}

export const moodColors = (title: string): MoodColors | null => MOOD_COLORS[title.trim().toLowerCase()] ?? null
