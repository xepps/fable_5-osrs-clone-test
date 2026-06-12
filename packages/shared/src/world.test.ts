import { describe, expect, it } from 'vitest'
import { buildingTiles } from './buildings'
import { CENTER, CHUNK_SIZE, GAME_MAP, isWalkable, MAP_SIZE } from './world'

describe('the game map', () => {
  it('is a 3x3 grid of 64-tile chunks', () => {
    expect(CHUNK_SIZE).toBe(64)
    expect(CENTER).toBe(CHUNK_SIZE)
    expect(MAP_SIZE).toBe(CHUNK_SIZE * 3)
    expect(GAME_MAP.terrain).toHaveLength(MAP_SIZE)
    GAME_MAP.terrain.forEach((row) => expect(row).toHaveLength(MAP_SIZE))
  })

  it('keeps the original town in the centre chunk', () => {
    expect(GAME_MAP.spawnPoint).toEqual({ x: CENTER + 32, z: CENTER + 32 })
    expect(GAME_MAP.npcSpawns).toContainEqual(
      expect.objectContaining({ npcId: 'npc_guide', x: CENTER + 35, z: CENTER + 35 }),
    )
    expect(GAME_MAP.objects).toContainEqual(
      expect.objectContaining({ id: 'tree_0', x: CENTER + 20, z: CENTER + 20 }),
    )
  })

  it('spawns players on a walkable tile', () => {
    expect(isWalkable(GAME_MAP.spawnPoint)).toBe(true)
  })

  it('blocks walking outside the map', () => {
    expect(isWalkable({ x: -1, z: 0 })).toBe(false)
    expect(isWalkable({ x: MAP_SIZE, z: 10 })).toBe(false)
    expect(isWalkable({ x: 0, z: MAP_SIZE })).toBe(false)
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

  it('runs a river through the east chunk', () => {
    const eastWater = GAME_MAP.terrain.flatMap((row, z) =>
      row.flatMap((terrain, x) =>
        terrain === 'water' && x >= CHUNK_SIZE * 2 && z < CHUNK_SIZE * 2 ? [{ x, z }] : [],
      ),
    )
    expect(eastWater.length).toBeGreaterThan(50)
  })

  it('bridges the river where the east road crosses it', () => {
    for (let x = CENTER; x < MAP_SIZE; x += 1) {
      expect(isWalkable({ x, z: 95 })).toBe(true)
      expect(isWalkable({ x, z: 96 })).toBe(true)
    }
  })

  it('connects all chunks with roads through the spawn crossroads', () => {
    for (let z = 0; z < MAP_SIZE; z += 1) {
      expect(isWalkable({ x: 96, z })).toBe(true)
    }
    for (let x = 0; x < MAP_SIZE; x += 1) {
      expect(isWalkable({ x, z: 96 })).toBe(true)
    }
  })

  it('grows a forest in the north-west chunk', () => {
    const forestTrees = GAME_MAP.objects.filter(
      (object) => object.kind === 'tree' && object.x < CHUNK_SIZE && object.z < CHUNK_SIZE,
    )
    expect(forestTrees.length).toBeGreaterThanOrEqual(15)
  })

  it('camps extra goblins in the south-west chunk', () => {
    const campGoblins = GAME_MAP.npcSpawns.filter(
      (spawn) => spawn.defId === 'goblin' && spawn.x < CHUNK_SIZE && spawn.z >= CHUNK_SIZE * 2,
    )
    expect(campGoblins.length).toBeGreaterThanOrEqual(3)
  })

  it('lays a sandy beach along the southern shore', () => {
    const beachSand = GAME_MAP.terrain.flatMap((row, z) =>
      row.flatMap((terrain, x) => (terrain === 'sand' && z >= MAP_SIZE - 16 ? [{ x, z }] : [])),
    )
    expect(beachSand.length).toBeGreaterThan(200)
    const seaWater = GAME_MAP.terrain.flatMap((row, z) =>
      row.flatMap((terrain, x) => (terrain === 'water' && z >= MAP_SIZE - 8 ? [{ x, z }] : [])),
    )
    expect(seaWater.length).toBeGreaterThan(100)
  })

  it('places every tree, item spawn and npc spawn inside the map on sensible tiles', () => {
    GAME_MAP.objects.forEach((object) => {
      expect(object.x).toBeGreaterThanOrEqual(0)
      expect(object.x).toBeLessThan(MAP_SIZE)
      expect(object.z).toBeGreaterThanOrEqual(0)
      expect(object.z).toBeLessThan(MAP_SIZE)
    })
    GAME_MAP.itemSpawns.forEach((spawn) => expect(isWalkable(spawn)).toBe(true))
    GAME_MAP.npcSpawns.forEach((spawn) => expect(isWalkable(spawn)).toBe(true))
  })

  it('marks fishing spots on water and cooking stations on land', () => {
    const spots = GAME_MAP.objects.filter((object) => object.kind === 'fishing_spot')
    expect(spots.length).toBeGreaterThanOrEqual(2)
    spots.forEach((spot) => expect(GAME_MAP.terrain[spot.z]![spot.x]).toBe('water'))
    expect(GAME_MAP.objects.some((object) => object.kind === 'range')).toBe(true)
    expect(GAME_MAP.objects.some((object) => object.kind === 'campfire')).toBe(true)
  })

  it('gives every world object a unique id', () => {
    const ids = GAME_MAP.objects.map((object) => object.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('buildings', () => {
  it('places enterable buildings around the town', () => {
    expect(GAME_MAP.buildings.length).toBeGreaterThanOrEqual(4)
  })

  it('blocks walls, opens doorways, and floors the interiors', () => {
    const furniture = new Set(GAME_MAP.objects.map((object) => `${object.x},${object.z}`))
    GAME_MAP.buildings.forEach((building) => {
      const { walls, floors } = buildingTiles(building)
      walls.forEach((tile) => expect(isWalkable(tile)).toBe(false))
      building.doors.forEach((door) => expect(isWalkable(door)).toBe(true))
      floors.forEach((tile) => {
        expect(['floor_wood', 'floor_stone']).toContain(GAME_MAP.terrain[tile.z]![tile.x])
        if (!furniture.has(`${tile.x},${tile.z}`)) expect(isWalkable(tile)).toBe(true)
      })
    })
  })

  it('keeps every doorway approachable from outside', () => {
    GAME_MAP.buildings.forEach((building) => {
      building.doors.forEach((door) => {
        const outside = [
          { x: door.x - 1, z: door.z },
          { x: door.x + 1, z: door.z },
          { x: door.x, z: door.z - 1 },
          { x: door.x, z: door.z + 1 },
        ].filter((tile) => isWalkable(tile))
        expect(outside.length).toBeGreaterThanOrEqual(2)
      })
    })
  })
})
