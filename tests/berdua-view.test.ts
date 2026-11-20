import { describe, expect, test } from 'vitest'
import { berduaView } from '../src/renderer/src/components/berduaView'

const base = { status: 'idle', connected: true, partnerHere: true, partnerError: false } as const

describe('berduaView', () => {
  test('invited: the partner invites you, accept or decline', () => {
    const v = berduaView({ ...base, status: 'invited' }, 'Nadia')
    expect(v.text).toBe('Nadia mengajak kamu')
    expect(v.actions.map((a) => a.kind)).toEqual(['accept', 'decline'])
  })

  test('inviting: waiting for the partner, cancel', () => {
    const v = berduaView({ ...base, status: 'inviting' }, 'Nadia')
    expect(v.text).toBe('Menunggu Nadia…')
    expect(v.actions).toEqual([{ kind: 'cancel', label: 'Batalkan' }])
  })

  test('active: the live label, end', () => {
    expect(berduaView({ ...base, status: 'active' }, 'Nadia').text).toBe('Tersambung')
    expect(berduaView({ ...base, status: 'active', partnerHere: false }, 'Nadia').text).toBe('Nadia terputus')
    expect(berduaView({ ...base, status: 'active', partnerError: true }, 'Nadia').text).toBe('Nadia: gagal memutar')
    expect(berduaView({ ...base, status: 'active', connected: false }, 'Nadia').text).toBe('Koneksi terputus')
    expect(berduaView({ ...base, status: 'active' }, 'Nadia').actions.map((a) => a.kind)).toEqual(['end'])
  })

  test.each(['idle', 'ended'] as const)('%s, partner online: invite enabled', (status) => {
    const v = berduaView({ ...base, status }, 'Nadia')
    expect(v.text).toBe('sedang online')
    expect(v.online).toBe(true)
    expect(v.actions).toEqual([{ kind: 'invite', label: 'Ajak dengar bareng', disabled: false }])
  })

  test('partner offline: invite disabled', () => {
    const v = berduaView({ ...base, partnerHere: false }, 'Nadia')
    expect(v.text).toBe('offline')
    expect(v.online).toBe(false)
    expect(v.actions[0]).toMatchObject({ kind: 'invite', disabled: true })
  })

  test('not connected: invite disabled', () => {
    const v = berduaView({ ...base, connected: false }, 'Nadia')
    expect(v.text).toBe('tidak terhubung')
    expect(v.online).toBe(false)
    expect(v.actions[0]).toMatchObject({ kind: 'invite', disabled: true })
  })
})
