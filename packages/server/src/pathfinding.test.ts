import { describe, expect, it } from 'vitest'
import { GAME_MAP, isWalkable, type Position } from '@osrs/shared'
import { findPath, findPathToAdjacent } from './pathfinding'

const openGrid = () => true

const gridFrom = (rows: string[]) => (position: Position) => rows[position.z]?.[position.x] === '.'

describe('finding a path to a tile', () => {
  it('returns an empty path when already at the destination', () => {
    expect(findPath({ x: 3, z: 3 }, { x: 3, z: 3 }, openGrid)).toEqual([])
  })

  it('walks in a straight line on open ground, one entry per tile', () => {
    const path = findPath({ x: 0, z: 0 }, { x: 4, z: 0 }, openGrid)
    expect(path).toEqual([
      { x: 1, z: 0 },
      { x: 2, z: 0 },
      { x: 3, z: 0 },
      { x: 4, z: 0 },
    ])
  })

  it('uses diagonals so distance is chebyshev on open ground', () => {
    const path = findPath({ x: 0, z: 0 }, { x: 3, z: 3 }, openGrid)
    expect(path).toHaveLength(3)
    expect(path[2]).toEqual({ x: 3, z: 3 })
  })

  it('routes around obstacles', () => {
    const grid = gridFrom(['...', 'XX.', '...'])
    const path = findPath({ x: 0, z: 0 }, { x: 0, z: 2 }, grid)
    expect(path[path.length - 1]).toEqual({ x: 0, z: 2 })
    expect(path.every((tile) => grid(tile))).toBe(true)
  })

  it('does not cut corners diagonally past a blocked tile', () => {
    const grid = gridFrom(['..', 'X.'])
    const path = findPath({ x: 0, z: 0 }, { x: 1, z: 1 }, grid)
    expect(path).toEqual([
      { x: 1, z: 0 },
      { x: 1, z: 1 },
    ])
  })

  it('stops at the nearest reachable tile when the target is unreachable', () => {
    const pondCentre = { x: 48, z: 14 }
    const path = findPath(GAME_MAP.spawnPoint, pondCentre, isWalkable)
    const end = path[path.length - 1]
    expect(end).toBeDefined()
    expect(isWalkable(end!)).toBe(true)
    expect(Math.hypot(end!.x - pondCentre.x, end!.z - pondCentre.z)).toBeLessThan(8)
  })
})

describe('finding a path adjacent to a target', () => {
  it('returns an empty path when already cardinally adjacent', () => {
    expect(findPathToAdjacent({ x: 5, z: 5 }, { x: 5, z: 6 }, openGrid)).toEqual([])
  })

  it('ends on a cardinal neighbour of the target, not on top of it', () => {
    const path = findPathToAdjacent({ x: 0, z: 0 }, { x: 5, z: 5 }, openGrid) ?? []
    expect(path.length).toBeGreaterThan(0)
    const end = path[path.length - 1] ?? { x: 0, z: 0 }
    const dx = Math.abs(end.x - 5)
    const dz = Math.abs(end.z - 5)
    expect(dx + dz).toBe(1)
  })

  it('returns null when no adjacent tile is reachable', () => {
    const grid = gridFrom(['.X.', 'XXX', '.X.'])
    expect(findPathToAdjacent({ x: 0, z: 0 }, { x: 2, z: 2 }, grid)).toBeNull()
  })
})
