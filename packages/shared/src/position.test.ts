import { describe, expect, it } from 'vitest'
import { chebyshevDistance, isAdjacent, samePosition } from './position'

describe('positions', () => {
  it('treats identical coordinates as the same position', () => {
    expect(samePosition({ x: 3, z: 5 }, { x: 3, z: 5 })).toBe(true)
    expect(samePosition({ x: 3, z: 5 }, { x: 3, z: 6 })).toBe(false)
  })

  it('measures distance as the larger axis difference (chebyshev)', () => {
    expect(chebyshevDistance({ x: 0, z: 0 }, { x: 3, z: 1 })).toBe(3)
    expect(chebyshevDistance({ x: 5, z: 5 }, { x: 5, z: 5 })).toBe(0)
  })

  it('considers diagonal neighbours adjacent but not the same tile', () => {
    expect(isAdjacent({ x: 2, z: 2 }, { x: 3, z: 3 })).toBe(true)
    expect(isAdjacent({ x: 2, z: 2 }, { x: 2, z: 3 })).toBe(true)
    expect(isAdjacent({ x: 2, z: 2 }, { x: 2, z: 2 })).toBe(false)
    expect(isAdjacent({ x: 2, z: 2 }, { x: 4, z: 2 })).toBe(false)
  })
})
