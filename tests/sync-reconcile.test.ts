import { expect, test } from 'vitest'
import { expectedPosition, reconcile } from '../src/shared/sync/reconcile'

test('small drift needs nothing', () => {
  expect(reconcile(0.1)).toEqual({ kind: 'none' })
  expect(reconcile(-0.19)).toEqual({ kind: 'none' })
})

test('ahead of the partner slows down, behind speeds up', () => {
  expect(reconcile(0.3)).toEqual({ kind: 'rate', rate: 0.97 })
  expect(reconcile(-0.3)).toEqual({ kind: 'rate', rate: 1.03 })
})

test('one second or more is a seek', () => {
  expect(reconcile(1)).toEqual({ kind: 'seek' })
  expect(reconcile(-4)).toEqual({ kind: 'seek' })
})

test('once correcting, it keeps going until the drift is nearly gone', () => {
  expect(reconcile(0.1, { correcting: true })).toEqual({ kind: 'rate', rate: 0.97 })
  expect(reconcile(0.04, { correcting: true })).toEqual({ kind: 'none' })
})

test('loose mode doubles every threshold', () => {
  expect(reconcile(0.3, { loose: true })).toEqual({ kind: 'none' })
  expect(reconcile(0.5, { loose: true })).toEqual({ kind: 'rate', rate: 0.97 })
  expect(reconcile(1.5, { loose: true })).toEqual({ kind: 'rate', rate: 0.97 })
  expect(reconcile(2, { loose: true })).toEqual({ kind: 'seek' })
})

test('expectedPosition advances a playing heartbeat by its age', () => {
  expect(expectedPosition({ position: 10, playing: true }, 1000, 1500)).toBe(10.5)
})

test('expectedPosition does not advance a paused heartbeat', () => {
  expect(expectedPosition({ position: 10, playing: false }, 1000, 1500)).toBe(10)
})

test('expectedPosition ignores a heartbeat that seems to be from the future', () => {
  expect(expectedPosition({ position: 10, playing: true }, 2000, 1500)).toBe(10)
})
