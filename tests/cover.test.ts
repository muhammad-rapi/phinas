import { describe, expect, test, vi } from 'vitest'
import { createCoverFetcher, isAllowedCoverUrl } from '../src/main/music/cover'

describe('isAllowedCoverUrl', () => {
  test('allows known image hosts over https', () => {
    expect(isAllowedCoverUrl('https://yt3.googleusercontent.com/abc=w544-h544')).toBe(true)
    expect(isAllowedCoverUrl('https://lh3.googleusercontent.com/x')).toBe(true)
    expect(isAllowedCoverUrl('https://i.ytimg.com/vi/x/hq.jpg')).toBe(true)
  })
  test('rejects other hosts, http, and garbage', () => {
    expect(isAllowedCoverUrl('https://evil.example.com/a.jpg')).toBe(false)
    expect(isAllowedCoverUrl('http://yt3.googleusercontent.com/a')).toBe(false)
    expect(isAllowedCoverUrl('https://googleusercontent.com.evil.com/a')).toBe(false)
    expect(isAllowedCoverUrl('file:///etc/passwd')).toBe(false)
    expect(isAllowedCoverUrl('not a url')).toBe(false)
  })
})

describe('createCoverFetcher', () => {
  const okResponse = () =>
    new Response(new Uint8Array([1, 2, 3]), { status: 200, headers: { 'content-type': 'image/jpeg' } })

  test('returns a data url and caches it', async () => {
    const fetchFn = vi.fn(async () => okResponse())
    const get = createCoverFetcher(fetchFn as unknown as typeof fetch)
    const url = 'https://i.ytimg.com/vi/x/hq.jpg'
    expect(await get(url)).toBe('data:image/jpeg;base64,AQID')
    expect(await get(url)).toBe('data:image/jpeg;base64,AQID')
    expect(fetchFn).toHaveBeenCalledTimes(1)
  })

  test('refuses disallowed urls without fetching', async () => {
    const fetchFn = vi.fn()
    const get = createCoverFetcher(fetchFn as unknown as typeof fetch)
    await expect(get('https://evil.example.com/a.jpg')).rejects.toThrow('not allowed')
    expect(fetchFn).not.toHaveBeenCalled()
  })

  test('throws on a failed response', async () => {
    const get = createCoverFetcher((async () => new Response('', { status: 404 })) as typeof fetch)
    await expect(get('https://i.ytimg.com/vi/x/hq.jpg')).rejects.toThrow('404')
  })

  test('evicts the oldest entry beyond the cache limit', async () => {
    const fetchFn = vi.fn(async () => okResponse())
    const get = createCoverFetcher(fetchFn as unknown as typeof fetch, 2)
    await get('https://i.ytimg.com/vi/a/hq.jpg')
    await get('https://i.ytimg.com/vi/b/hq.jpg')
    await get('https://i.ytimg.com/vi/c/hq.jpg')
    await get('https://i.ytimg.com/vi/a/hq.jpg')
    expect(fetchFn).toHaveBeenCalledTimes(4)
  })
})
