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
