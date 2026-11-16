import http from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterAll, beforeAll, expect, test } from 'vitest'
import { createStreamProxy } from '../src/main/music/proxy'

const BODY = Buffer.from('0123456789abcdefghij')
let upstream: http.Server
let upstreamUrl = ''
let proxy: ReturnType<typeof createStreamProxy>
let port = 0
let resolveCalls = 0

beforeAll(async () => {
  upstream = http.createServer((req, res) => {
    const range = /bytes=(\d+)-(\d*)/.exec(req.headers.range ?? '')
    if (!range) {
      res.writeHead(200, { 'content-type': 'audio/mp4', 'content-length': BODY.length })
      res.end(BODY)
      return
    }
    const start = Number(range[1])
    const end = range[2] ? Number(range[2]) : BODY.length - 1
    const part = BODY.subarray(start, end + 1)
    res.writeHead(206, {
      'content-type': 'audio/mp4',
      'content-length': part.length,
      'content-range': `bytes ${start}-${end}/${BODY.length}`
    })
    res.end(part)
  })
  await new Promise<void>((r) => upstream.listen(0, '127.0.0.1', r))
  upstreamUrl = `http://127.0.0.1:${(upstream.address() as AddressInfo).port}/a`

  proxy = createStreamProxy(async (id) => {
    resolveCalls++
    if (id === 'badvideo000') throw new Error('nope')
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

test('caches the resolved url', async () => {
  const before = resolveCalls
  await (await get('/stream/video000001')).arrayBuffer()
  await (await get('/stream/video000001')).arrayBuffer()
  expect(resolveCalls).toBe(before)
})

test('404 for unknown paths, 502 when resolving fails', async () => {
  expect((await get('/nope')).status).toBe(404)
  expect((await get('/stream/badvideo000')).status).toBe(502)
})
