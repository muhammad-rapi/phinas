const MAX_RECENT = 8
const STORAGE_KEY = 'phinas.recentSearches'

const norm = (s: string): string => s.trim().toLowerCase()

export function addRecent(list: string[], query: string): string[] {
  const q = query.trim()
  if (!q) return list
  return [q, ...list.filter((x) => norm(x) !== norm(q))].slice(0, MAX_RECENT)
}

export function removeRecent(list: string[], query: string): string[] {
  return list.filter((x) => norm(x) !== norm(query))
}

export function loadRecent(): string[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}

export function saveRecent(list: string[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
  } catch {
    /* storage unavailable: history just will not persist */
  }
}
