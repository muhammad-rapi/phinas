import { expect, test } from 'vitest'
import type { EndReason } from '../src/shared/sync/session'
import { endedText } from '../src/renderer/src/sync/status'

test('a busy friend is named', () => {
  expect(endedText('busy', 'Sari')).toBe('Sari sedang dengar bareng orang lain.')
})

test('the other reasons name the friend where it helps', () => {
  expect(endedText('declined', 'Sari')).toBe('Sari menolak ajakan.')
  expect(endedText('partner-ended', 'Sari')).toBe('Sari mengakhiri sesi.')
  expect(endedText('ended', 'Sari')).toBe('Sesi diakhiri.')
})

test('every end reason has a text', () => {
  const all: EndReason[] = ['ended', 'declined', 'expired', 'timeout', 'version', 'partner-ended', 'busy']
  for (const r of all) expect(endedText(r, 'Sari')).not.toBe('')
})
