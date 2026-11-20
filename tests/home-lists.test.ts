import { describe, expect, test } from 'vitest'
import { forYouList, trendingList } from '../src/renderer/src/screens/home/lists'
import type { HomeFeed, Track } from '../src/shared/types'

const t = (id: string): Track => ({ videoId: id, title: id, artist: 'A', coverUrl: '', durationSec: 200 })
const feed = (over: Partial<HomeFeed> = {}): HomeFeed => ({
  trending: [t('trend')],
  picks: [t('pick')],
  genres: [],
  releases: [],
  videos: [],
  ...over
})

describe('forYouList', () => {
  test('personal recommendations win', () => {
    expect(forYouList([t('rec')], feed(), false)).toEqual({ tracks: [t('rec')], failed: false })
  })
  test('loading while the recommendations request is pending', () => {
    expect(forYouList(null, feed(), false)).toEqual({ tracks: null, failed: false })
  })
  test("no recommendations: the feed's picks", () => {
    expect(forYouList([], feed(), false)).toEqual({ tracks: [t('pick')], failed: false })
  })
  test('no recommendations and the feed still loading', () => {
    expect(forYouList([], null, false)).toEqual({ tracks: null, failed: false })
  })
  test('no recommendations and the feed failed', () => {
    expect(forYouList([], null, true)).toEqual({ tracks: null, failed: true })
  })
})

describe('trendingList', () => {
  test('the feed’s chart once loaded', () => {
    expect(trendingList(feed(), false)).toEqual({ tracks: [t('trend')], failed: false })
  })
  test('loading', () => {
    expect(trendingList(null, false)).toEqual({ tracks: null, failed: false })
  })
  test('failed', () => {
    expect(trendingList(null, true)).toEqual({ tracks: null, failed: true })
  })
})
