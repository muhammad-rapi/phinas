import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { friendlyError } from './errors'

describe('errors', () => {
  it('is the same file as the desktop app copy', () => {
    const app = readFileSync(new URL('../../src/shared/errors.ts', import.meta.url), 'utf8')
    const web = readFileSync(new URL('./errors.ts', import.meta.url), 'utf8')
    expect(web).toBe(app)
  })

  it('maps a phinas code to Indonesian text', () => {
    expect(friendlyError(new Error('phinas:not_admin'))).toBe('Hanya admin yang bisa melakukan ini.')
  })
})
