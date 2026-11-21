/** Which screen the main area is showing. */
export type View =
  | { name: 'home' }
  | { name: 'explore' }
  | { name: 'search' }
  | { name: 'profile' }
  | { name: 'settings' }
  | { name: 'import' }
  | { name: 'liked' }
  | { name: 'recent' }
  | { name: 'friends' }
  /** A friend's profile; `id` is their user id. */
  | { name: 'friend'; id: string }
  | { name: 'playlist'; id: string }
  /** A friend's shared playlist or a public one (read-only). */
  | { name: 'friendPlaylist'; id: string }
  | { name: 'public'; id: string; author?: string }
  /** `id` is the artist's name as shown on tracks. */
  | { name: 'artist'; id: string }
  | { name: 'album'; id: string }
  /** `id` is the genre's browse params. */
  | { name: 'genre'; id: string; title: string }

export type Nav = (view: View) => void

export const sameView = (a: View, b: View): boolean =>
  a.name === b.name && ('id' in a ? 'id' in b && a.id === b.id : true)

/** Splits "A, B & C" into the artists it names. */
export const splitArtists = (artist: string): string[] =>
  artist
    .split(/\s*(?:,|&|\bfeat\.?|\bft\.?)\s+/i)
    .map((a) => a.trim())
    .filter((a) => a && a !== 'Unknown artist')
