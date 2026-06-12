import { describe, expect, it } from 'vitest'
import { burnChance, COOKABLES, cookableFor } from './cooking'

const shrimps = cookableFor('raw_shrimps')!

describe('burn chance', () => {
  it('burns often at level 1', () => {
    expect(burnChance(1, shrimps)).toBeCloseTo(0.535, 5)
  })

  it('falls as the cooking level rises', () => {
    expect(burnChance(20, shrimps)).toBeLessThan(burnChance(5, shrimps))
  })

  it('never burns at or beyond the stop level', () => {
    expect(burnChance(shrimps.burnStopLevel, shrimps)).toBe(0)
    expect(burnChance(99, shrimps)).toBe(0)
  })
})

describe('cookables', () => {
  it('maps every raw food to a cooked and burnt result', () => {
    COOKABLES.forEach((cookable) => {
      expect(cookable.cooked).not.toBe(cookable.raw)
      expect(cookable.burnt).toBeDefined()
    })
  })

  it('finds nothing for items that cannot be cooked', () => {
    expect(cookableFor('logs')).toBeUndefined()
  })
})
