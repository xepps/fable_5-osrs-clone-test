import { describe, expect, it } from 'vitest'
import { levelForXp, xpForLevel } from './xp'

describe('OSRS experience table', () => {
  it('matches known XP thresholds from the wiki', () => {
    expect(xpForLevel(1)).toBe(0)
    expect(xpForLevel(2)).toBe(83)
    expect(xpForLevel(10)).toBe(1154)
    expect(xpForLevel(50)).toBe(101333)
    expect(xpForLevel(99)).toBe(13034431)
  })

  it('derives the level from accumulated XP', () => {
    expect(levelForXp(0)).toBe(1)
    expect(levelForXp(82)).toBe(1)
    expect(levelForXp(83)).toBe(2)
    expect(levelForXp(1154)).toBe(10)
    expect(levelForXp(13034431)).toBe(99)
  })

  it('caps the level at 99 no matter how much XP is gained', () => {
    expect(levelForXp(200_000_000)).toBe(99)
  })
})
