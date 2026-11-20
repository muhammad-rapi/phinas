import { describe, expect, it } from 'vitest'
import { squareCrop } from '../src/renderer/src/profile/avatarImage'

describe('squareCrop', () => {
  it('takes the middle of a wide image', () => {
    expect(squareCrop(400, 200)).toEqual({ sx: 100, sy: 0, size: 200 })
  })
  it('takes the middle of a tall image', () => {
    expect(squareCrop(300, 501)).toEqual({ sx: 0, sy: 100, size: 300 })
  })
  it('keeps a square as it is', () => {
    expect(squareCrop(160, 160)).toEqual({ sx: 0, sy: 0, size: 160 })
  })
})
