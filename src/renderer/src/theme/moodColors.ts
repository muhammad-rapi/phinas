/** A mood's colour: it tints the app (accent and wash) while you listen from that mood. */
export interface MoodColors {
  accent: string
}

/** Each mood's colour: calm, mid-saturation tones (no neon). useTheme makes them readable per mode. */
const MOOD_COLORS: Record<string, MoodColors> = {
  chill: { accent: '#5b8def' },
  commute: { accent: '#3fa7a0' },
  energize: { accent: '#e8932a' },
  energise: { accent: '#e8932a' },
  'feel good': { accent: '#d9a93a' },
  focus: { accent: '#6366f1' },
  gaming: { accent: '#3fae6a' },
  party: { accent: '#b05bd6' },
  romance: { accent: '#e0607e' },
  sad: { accent: '#64748b' },
  sleep: { accent: '#4f5bb3' },
  workout: { accent: '#e4572e' }
}

export const moodColors = (title: string): MoodColors | null => MOOD_COLORS[title.trim().toLowerCase()] ?? null
