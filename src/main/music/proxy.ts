import http from 'node:http'
import type { AddressInfo } from 'node:net'
import { Readable } from 'node:stream'

const TTL_MS = 10 * 60 * 1000
const PASS_HEADERS = ['content-type', 'content-length', 'content-range', 'accept-ranges']
/** googlevideo rejects (403) ranges larger than 1 MiB, so every request is cut to this size. */
export const MAX_CHUNK = 1024 * 1024

/** Turns the client's Range header into a bounded range of at most MAX_CHUNK bytes. */
export function clampRange(header: string | undefined): string {
  const m = /^bytes=(\d*)-(\d*)$/.exec(header ?? '')
  const start = m && m[1] ? Number(m[1]) : 0
  const requestedEnd = m && m[2] ? Number(m[2]) : Infinity
  const end = Math.min(requestedEnd, start + MAX_CHUNK - 1)
  return `bytes=${start}-${end}`
}

/**
 * `resolveUrl(id, fresh)`: with `fresh` true the caller must not reuse anything cached, because
 * the previous URL was just rejected.
 */
export function createStreamProxy(resolveUrl: (videoId: string, fresh?: boolean) => Promise<string>): {
  start(): Promise<number>
  stop(): Promise<void>
} {
  const cache = new Map<string, { url: string; at: number }>()

  async function urlFor(id: string, fresh = false): Promise<string> {
    const hit = cache.get(id)
    if (!fresh && hit && Date.now() - hit.at < TTL_MS) return hit.url
    const url = await resolveUrl(id, fresh)
    cache.set(id, { url, at: Date.now() })
    return url
  }

  /** A 403 usually means the signed URL went stale, so retry once with a freshly resolved one. */
  async function fetchUpstream(id: string, range: string, signal: AbortSignal): Promise<Response> {
    let upstream = await fetch(await urlFor(id), { headers: { range }, signal })
    if (upstream.status === 403) {
      await upstream.body?.cancel()
      console.error(`[stream-proxy] ${id}: 403 for ${range}, retrying with a fresh url`)
      upstream = await fetch(await urlFor(id, true), { headers: { range }, signal })
    }
    return upstream
  }

  const server = http.createServer(async (req, res) => {
    const m = /^\/stream\/([\w-]{11})$/.exec(req.url ?? '')
    if (!m) {
      res.writeHead(404).end()
      return
    }
    const id = m[1]
    const ac = new AbortController()
    res.on('close', () => ac.abort())
    try {
      const upstream = await fetchUpstream(id, clampRange(req.headers.range), ac.signal)
      if (upstream.status >= 400 || !upstream.body) {
        console.error(`[stream-proxy] ${id}: upstream returned ${upstream.status} for ${clampRange(req.headers.range)}`)
        cache.delete(id)
        res.writeHead(502).end()
        return
      }
      const headers: Record<string, string> = { 'access-control-allow-origin': '*' }
      for (const h of PASS_HEADERS) {
        const v = upstream.headers.get(h)
        if (v) headers[h] = v
      }
      res.writeHead(upstream.status, headers)
      const body = Readable.fromWeb(upstream.body as never)
      body.on('error', () => res.destroy())
      body.pipe(res)
    } catch (e) {
      if (!ac.signal.aborted) console.error(`[stream-proxy] ${id}:`, e instanceof Error ? e.message : e)
      cache.delete(id)
      if (!res.headersSent) res.writeHead(502)
      res.end()
    }
  })

  return {
    start: () =>
      new Promise((resolve) => {
        server.listen(0, '127.0.0.1', () => resolve((server.address() as AddressInfo).port))
      }),
    stop: () =>
      new Promise((resolve) => {
        server.closeAllConnections()
        server.close(() => resolve())
      })
  }
}
