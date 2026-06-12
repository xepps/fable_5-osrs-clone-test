import { describe, expect, it } from 'vitest'
import { buildingTiles, type BuildingSpec } from './buildings'

const hut: BuildingSpec = {
  id: 'hut',
  x: 10,
  z: 20,
  width: 5,
  depth: 4,
  doors: [{ x: 12, z: 23 }],
  floor: 'wood',
}

describe('building tiles', () => {
  it('walls the perimeter except at door gaps', () => {
    const { walls } = buildingTiles(hut)
    expect(walls).toContainEqual({ x: 10, z: 20 })
    expect(walls).toContainEqual({ x: 14, z: 23 })
    expect(walls).toContainEqual({ x: 12, z: 20 })
    expect(walls).not.toContainEqual({ x: 12, z: 23 })
    expect(walls).toHaveLength(2 * (5 + 4) - 4 - 1)
  })

  it('floors the interior and the door gaps', () => {
    const { floors } = buildingTiles(hut)
    expect(floors).toContainEqual({ x: 12, z: 22 })
    expect(floors).toContainEqual({ x: 12, z: 23 })
    expect(floors).not.toContainEqual({ x: 10, z: 20 })
    expect(floors).toHaveLength((5 - 2) * (4 - 2) + 1)
  })

  it('never floors a tile outside the building footprint', () => {
    const { floors, walls } = buildingTiles(hut)
    const inside = (tile: { x: number; z: number }) =>
      tile.x >= hut.x && tile.x < hut.x + hut.width && tile.z >= hut.z && tile.z < hut.z + hut.depth
    floors.forEach((tile) => expect(inside(tile)).toBe(true))
    walls.forEach((tile) => expect(inside(tile)).toBe(true))
  })
})
