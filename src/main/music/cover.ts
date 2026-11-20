const ALLOWED_HOSTS = [/(^|\.)googleusercontent\.com$/, /(^|\.)ggpht\.com$/, /(^|\.)ytimg\.com$/]

export function isAllowedCoverUrl(raw: string): boolean {
  try {
    const u = new URL(raw)
    return u.protocol === 'https:' && ALLOWED_HOSTS.some((re) => re.test(u.hostname))
  } catch {
    return false
  }
}

/**
 * Downloads cover art in the main process and hands the renderer a data URL.
 * A data URL is same-origin, so drawing it to a canvas can never taint it
 * (which would block reading the pixels for the Dynamic theme).
 */
export function createCoverFetcher(
  fetchFn: typeof fetch = fetch,
  maxEntries = 200
): (url: string) => Promise<string> {
  const cache = new Map<string, string>()
  return async (url) => {
    if (!isAllowedCoverUrl(url)) throw new Error('Cover host not allowed')
    const hit = cache.get(url)
    if (hit) return hit
    const res = await fetchFn(url)
    if (!res.ok) throw new Error(`Cover request failed: ${res.status}`)
    const type = res.headers.get('content-type') ?? 'image/jpeg'
    const data = `data:${type};base64,${Buffer.from(await res.arrayBuffer()).toString('base64')}`
    cache.set(url, data)
    if (cache.size > maxEntries) cache.delete(cache.keys().next().value as string)
    return data
  }
}
