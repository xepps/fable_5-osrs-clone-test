import { describe, expect, it } from 'vitest'
import { MAP_SIZE } from '@osrs/shared'
import { MINIMAP_SIZE, minimapToWorld, PX_PER_TILE, terrainColor, worldToMinimap } from './minimap'

const centre = { x: 96, z: 96 }

describe('minimap projection', () => {
  it('projects the centre tile to the middle of the viewport', () => {
    expect(worldToMinimap(centre, centre)).toEqual({ x: MINIMAP_SIZE / 2, y: MINIMAP_SIZE / 2 })
  })

  it('projects north as up and east as right', () => {
    const projected = worldToMinimap({ x: 98, z: 94 }, centre)
    expect(projected.x).toBe(MINIMAP_SIZE / 2 + 2 * PX_PER_TILE)
    expect(projected.y).toBe(MINIMAP_SIZE / 2 - 2 * PX_PER_TILE)
  })

  it('round-trips a viewport point back to the tile it shows', () => {
    const tile = { x: 104, z: 88 }
    expect(minimapToWorld(worldToMinimap(tile, centre), centre)).toEqual(tile)
  })

  it('maps the viewport middle back to the centre tile', () => {
    expect(minimapToWorld({ x: MINIMAP_SIZE / 2, y: MINIMAP_SIZE / 2 }, centre)).toEqual(centre)
  })

  it('clamps clicks beyond the map edge to the nearest tile', () => {
    const nearOrigin = { x: 1, z: 1 }
    expect(minimapToWorld({ x: 0, y: 0 }, nearOrigin)).toEqual({ x: 0, z: 0 })
    const nearFarCorner = { x: MAP_SIZE - 2, z: MAP_SIZE - 2 }
    expect(minimapToWorld({ x: MINIMAP_SIZE, y: MINIMAP_SIZE }, nearFarCorner)).toEqual({
      x: MAP_SIZE - 1,
      z: MAP_SIZE - 1,
    })
  })
})

describe('minimap terrain colors', () => {
  it('gives each terrain a distinct css color', () => {
    const colors = (['grass', 'path', 'sand', 'water', 'floor_wood', 'floor_stone'] as const).map(
      terrainColor,
    )
    expect(new Set(colors).size).toBe(colors.length)
    colors.forEach((color) => expect(color).toMatch(/^#[0-9a-f]{6}$/i))
  })
})
