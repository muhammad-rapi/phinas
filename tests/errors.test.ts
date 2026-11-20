import { expect, test } from 'vitest'
import { friendlyError } from '../src/shared/errors'

test('maps a phinas code to Indonesian text', () => {
  expect(friendlyError(new Error('phinas:invite_used'))).toBe('Kode undangan ini sudah dipakai.')
})

test('finds the code inside an Electron IPC error', () => {
  const e = new Error("Error invoking remote method 'syncSignUp': Error: phinas:quota_exceeded")
  expect(friendlyError(e)).toBe('Jatah kode undanganmu sudah habis.')
})

test('unknown phinas codes get a generic message', () => {
  expect(friendlyError(new Error('phinas:something_new'))).toBe('Terjadi kesalahan. Coba lagi.')
})

test('other errors keep their text without the IPC prefix', () => {
  const e = new Error("Error invoking remote method 'syncSignIn': Error: Invalid login credentials")
  expect(friendlyError(e)).toBe('Invalid login credentials')
})

test('non-Error values', () => {
  expect(friendlyError('boom')).toBe('boom')
  expect(friendlyError(undefined)).toBe('Terjadi kesalahan. Coba lagi.')
})
