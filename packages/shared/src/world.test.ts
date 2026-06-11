import { describe, expect, it } from 'vitest'
import { GAME_MAP, isWalkable, MAP_SIZE } from './world'

describe('the game map', () => {
  it('is a single 64x64 chunk', () => {
    expect(MAP_SIZE).toBe(64)
    expect(GAME_MAP.terrain).toHaveLength(64)
    GAME_MAP.terrain.forEach((row) => expect(row).toHaveLength(64))
  })

  it('spawns players on a walkable tile', () => {
    expect(isWalkable(GAME_MAP.spawnPoint)).toBe(true)
  })

  it('blocks walking outside the chunk', () => {
    expect(isWalkable({ x: -1, z: 0 })).toBe(false)
    expect(isWalkable({ x: 64, z: 10 })).toBe(false)
    expect(isWalkable({ x: 0, z: 64 })).toBe(false)
  })

  it('blocks water tiles', () => {
    const waterTile = GAME_MAP.terrain.flatMap((row, z) =>
      row.flatMap((terrain, x) => (terrain === 'water' ? [{ x, z }] : [])),
    )[0]
    expect(waterTile).toBeDefined()
    expect(isWalkable(waterTile!)).toBe(false)
  })

  it('blocks tiles occupied by trees', () => {
    const tree = GAME_MAP.objects.find((object) => object.kind === 'tree')
    expect(tree).toBeDefined()
    expect(isWalkable({ x: tree!.x, z: tree!.z })).toBe(false)
  })

  it('places every tree, item spawn and npc spawn inside the chunk on sensible tiles', () => {
    GAME_MAP.objects.forEach((object) => {
      expect(object.x).toBeGreaterThanOrEqual(0)
      expect(object.x).toBeLessThan(64)
      expect(object.z).toBeGreaterThanOrEqual(0)
      expect(object.z).toBeLessThan(64)
    })
    GAME_MAP.itemSpawns.forEach((spawn) => expect(isWalkable(spawn)).toBe(true))
    GAME_MAP.npcSpawns.forEach((spawn) => expect(isWalkable(spawn)).toBe(true))
  })

  it('gives every world object a unique id', () => {
    const ids = GAME_MAP.objects.map((object) => object.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})
