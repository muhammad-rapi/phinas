import http from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterAll, beforeAll, expect, test } from 'vitest'
import { createStreamProxy } from '../src/main/music/proxy'

const BODY = Buffer.from('0123456789abcdefghij')
const MAX_RANGE = 1024 * 1024
const BIG = Buffer.alloc(3 * MAX_RANGE, 7)
let upstream: http.Server
let upstreamUrl = ''
let proxy: ReturnType<typeof createStreamProxy>
let port = 0
let resolveCalls = 0

beforeAll(async () => {
  // Mimics googlevideo: open-ended or over-large ranges are rejected with 403.
  upstream = http.createServer((req, res) => {
    if (req.url === '/stale') {
      res.writeHead(403).end()
      return
    }
    const data = req.url === '/big' ? BIG : BODY
    const range = /bytes=(\d+)-(\d*)/.exec(req.headers.range ?? '')
    if (!range) {
      res.writeHead(200, { 'content-type': 'audio/mp4', 'content-length': data.length })
      res.end(data)
      return
    }
    const start = Number(range[1])
    if (!range[2] || Number(range[2]) - start + 1 > MAX_RANGE) {
      res.writeHead(403).end()
      return
    }
    const end = Math.min(Number(range[2]), data.length - 1)
    const part = data.subarray(start, end + 1)
    res.writeHead(206, {
      'content-type': 'audio/mp4',
      'content-length': part.length,
      'content-range': `bytes ${start}-${end}/${data.length}`
    })
    res.end(part)
  })
  await new Promise<void>((r) => upstream.listen(0, '127.0.0.1', r))
  upstreamUrl = `http://127.0.0.1:${(upstream.address() as AddressInfo).port}/a`

  proxy = createStreamProxy(async (id, fresh) => {
    resolveCalls++
    if (id === 'badvideo000') throw new Error('nope')
    // A stale signed url is rejected; a freshly resolved one works.
    if (id === 'stalevideo0') return fresh ? upstreamUrl : upstreamUrl.replace('/a', '/stale')
    if (id === 'bigvideo000') return upstreamUrl.replace('/a', '/big')
    return upstreamUrl
  })
  port = await proxy.start()
})

afterAll(async () => {
  await proxy.stop()
  await new Promise((r) => upstream.close(r))
})

const get = (path: string, headers: Record<string, string> = {}) =>
  fetch(`http://127.0.0.1:${port}${path}`, { headers })

test('returns the full body when no Range is sent (as 206 from bytes=0-)', async () => {
  const res = await get('/stream/video000001')
  expect([200, 206]).toContain(res.status)
  expect(Buffer.from(await res.arrayBuffer()).toString()).toBe(BODY.toString())
})

test('passes a Range header through', async () => {
  const res = await get('/stream/video000001', { range: 'bytes=2-5' })
  expect(res.status).toBe(206)
  expect(res.headers.get('content-range')).toBe('bytes 2-5/20')
  expect(Buffer.from(await res.arrayBuffer()).toString()).toBe('2345')
})

test('open-ended Range on a big file is clamped to one chunk', async () => {
  const res = await get('/stream/bigvideo000', { range: 'bytes=0-' })
  expect(res.status).toBe(206)
  expect(res.headers.get('content-range')).toBe(`bytes 0-${MAX_RANGE - 1}/${BIG.length}`)
  expect((await res.arrayBuffer()).byteLength).toBe(MAX_RANGE)
})

test('an over-large explicit Range is clamped too, and later chunks work', async () => {
  const big = await get('/stream/bigvideo000', { range: `bytes=0-${3 * MAX_RANGE - 1}` })
  expect(big.status).toBe(206)
  expect((await big.arrayBuffer()).byteLength).toBe(MAX_RANGE)
  const next = await get('/stream/bigvideo000', { range: `bytes=${MAX_RANGE}-` })
  expect(next.status).toBe(206)
  expect(next.headers.get('content-range')).toBe(`bytes ${MAX_RANGE}-${2 * MAX_RANGE - 1}/${BIG.length}`)
  await next.arrayBuffer()
})

test('caches the resolved url', async () => {
  const before = resolveCalls
  await (await get('/stream/video000001')).arrayBuffer()
  await (await get('/stream/video000001')).arrayBuffer()
  expect(resolveCalls).toBe(before)
})

test('a 403 from a stale url is retried once with a fresh url', async () => {
  const res = await get('/stream/stalevideo0', { range: 'bytes=2-5' })
  expect(res.status).toBe(206)
  expect(Buffer.from(await res.arrayBuffer()).toString()).toBe('2345')
  // The fresh url is remembered, so the next request needs no new resolve.
  const before = resolveCalls
  await (await get('/stream/stalevideo0', { range: 'bytes=6-7' })).arrayBuffer()
  expect(resolveCalls).toBe(before)
})

test('404 for unknown paths, 502 when resolving fails', async () => {
  expect((await get('/nope')).status).toBe(404)
  expect((await get('/stream/badvideo000')).status).toBe(502)
})
