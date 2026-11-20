import { expect, test } from 'vitest'
import type { SyncMessage } from '../src/shared/sync/protocol'
import { createFriendTransport } from '../src/renderer/src/sync/friendTransport'

const m: SyncMessage = { type: 'end', from: 'b', ts: 1 }

test('send goes to the function it was made with', () => {
  const sent: SyncMessage[] = []
  const t = createFriendTransport((x) => sent.push(x))
  t.send(m)
  expect(sent).toEqual([m])
})

test('delivered messages reach subscribers until they unsubscribe', () => {
  const got: SyncMessage[] = []
  const t = createFriendTransport(() => {})
  const off = t.onMessage((x) => got.push(x))
  t.deliver(m)
  off()
  t.deliver(m)
  expect(got).toEqual([m])
})

test('presence and connection report the current value at once, then only changes', () => {
  const t = createFriendTransport(() => {}, { up: true, here: false })
  const ups: boolean[] = []
  const heres: boolean[] = []
  t.onConnection((u) => ups.push(u))
  t.onPartnerPresence((h) => heres.push(h))
  t.setLink({ up: true, here: true })
  t.setLink({ up: false, here: true })
  expect(ups).toEqual([true, false])
  expect(heres).toEqual([false, true])
})
