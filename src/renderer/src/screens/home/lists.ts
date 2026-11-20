import type { HomeFeed, Track } from '../../../../shared/types'

/** `tracks` is null while loading; `failed` shows the error line instead. */
export interface ListState {
  tracks: Track[] | null
  failed: boolean
}

/**
 * Untukmu: personal recommendations when there are any, otherwise the feed's picks.
 * `recs` is null until the recommendations request settles ([] when none or on failure).
 */
export function forYouList(recs: Track[] | null, feed: HomeFeed | null, feedFailed: boolean): ListState {
  if (recs === null) return { tracks: null, failed: false }
  if (recs.length > 0) return { tracks: recs, failed: false }
  if (feed) return { tracks: feed.picks, failed: false }
  return { tracks: null, failed: feedFailed }
}

/** Lagi ramai: the feed's trending chart. */
export function trendingList(feed: HomeFeed | null, feedFailed: boolean): ListState {
  if (feed) return { tracks: feed.trending, failed: false }
  return { tracks: null, failed: feedFailed }
}
