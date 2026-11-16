import http from 'node:http'
import type { AddressInfo } from 'node:net'
import { Readable } from 'node:stream'

const TTL_MS = 10 * 60 * 1000
const PASS_HEADERS = ['content-type', 'content-length', 'content-range', 'accept-ranges']

export function createStreamProxy(resolveUrl: (videoId: string) => Promise<string>): {
  start(): Promise<number>
  stop(): Promise<void>
} {
  const cache = new Map<string, { url: string; at: number }>()

  async function urlFor(id: string): Promise<string> {
    const hit = cache.get(id)
    if (hit && Date.now() - hit.at < TTL_MS) return hit.url
    const url = await resolveUrl(id)
    cache.set(id, { url, at: Date.now() })
    return url
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
      const url = await urlFor(id)
      const upstream = await fetch(url, {
        headers: { range: req.headers.range ?? 'bytes=0-' },
        signal: ac.signal
      })
      if (upstream.status >= 400 || !upstream.body) {
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
    } catch {
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
