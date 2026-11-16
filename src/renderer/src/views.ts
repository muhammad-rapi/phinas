/** Which screen the main area is showing. */
export type View =
  | { name: 'home' }
  | { name: 'search' }
  | { name: 'profile' }
  | { name: 'import' }
  | { name: 'liked' }
  | { name: 'playlist'; id: string }
  | { name: 'partner'; id: string }

export type Nav = (view: View) => void

export const sameView = (a: View, b: View): boolean =>
  a.name === b.name && ('id' in a ? 'id' in b && a.id === b.id : true)
