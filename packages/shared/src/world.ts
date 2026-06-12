import { buildingTiles, type BuildingSpec } from './buildings'
import type { ItemId } from './items'
import type { NpcDefId } from './npcs'
import type { Position } from './position'

export const CHUNK_SIZE = 64
export const MAP_SIZE = CHUNK_SIZE * 3
export const CENTER = CHUNK_SIZE

export type Terrain = 'grass' | 'path' | 'sand' | 'water' | 'floor_wood' | 'floor_stone'

export type WorldObjectKind = 'tree' | 'fishing_spot' | 'range' | 'campfire' | 'bank_booth'

export type WorldObject = Readonly<{
  id: string
  kind: WorldObjectKind
  name: string
  examine: string
  x: number
  z: number
}>

export type ItemSpawn = Readonly<{
  x: number
  z: number
  itemId: ItemId
  quantity: number
  respawnTicks: number
}>

export type NpcSpawn = Readonly<{
  npcId: string
  defId: NpcDefId
  x: number
  z: number
  wanderRadius: number
}>

export type GameMap = Readonly<{
  terrain: ReadonlyArray<ReadonlyArray<Terrain>>
  objects: readonly WorldObject[]
  itemSpawns: readonly ItemSpawn[]
  npcSpawns: readonly NpcSpawn[]
  buildings: readonly BuildingSpec[]
  spawnPoint: Position
}>

const BUILDINGS: readonly BuildingSpec[] = [
  {
    id: 'bank',
    x: CENTER + 34,
    z: CENTER + 21,
    width: 8,
    depth: 8,
    doors: [{ x: CENTER + 37, z: CENTER + 28 }],
    floor: 'stone',
    chimney: { x: CENTER + 41, z: CENTER + 21 },
  },
  {
    id: 'general_store',
    x: CENTER + 22,
    z: CENTER + 34,
    width: 7,
    depth: 7,
    doors: [{ x: CENTER + 28, z: CENTER + 37 }],
    floor: 'wood',
    chimney: { x: CENTER + 22, z: CENTER + 34 },
  },
  {
    id: 'cottage_range',
    x: CENTER + 35,
    z: CENTER + 48,
    width: 6,
    depth: 6,
    doors: [{ x: CENTER + 37, z: CENTER + 48 }],
    floor: 'wood',
    chimney: { x: CENTER + 40, z: CENTER + 53 },
  },
  {
    id: 'cottage_south',
    x: CENTER + 22,
    z: CENTER + 44,
    width: 6,
    depth: 6,
    doors: [{ x: CENTER + 24, z: CENTER + 49 }],
    floor: 'wood',
    chimney: { x: CENTER + 22, z: CENTER + 44 },
  },
  {
    id: 'fisher_hut',
    x: CENTER + 54,
    z: CENTER + 20,
    width: 5,
    depth: 5,
    doors: [{ x: CENTER + 54, z: CENTER + 22 }],
    floor: 'wood',
    chimney: { x: CENTER + 58, z: CENTER + 24 },
  },
]

type TerrainStamp = (x: number, z: number) => Terrain | null

const buildingFloorTiles = new Map<number, Terrain>(
  BUILDINGS.flatMap((building) => {
    const floor: Terrain = building.floor === 'wood' ? 'floor_wood' : 'floor_stone'
    return Array.from({ length: building.depth }, (_, dz) =>
      Array.from({ length: building.width }, (_, dx) => {
        const tile = { x: building.x + dx, z: building.z + dz }
        return [tile.z * MAP_SIZE + tile.x, floor] as const
      }),
    ).flat()
  }),
)

const buildingAt: TerrainStamp = (x, z) => buildingFloorTiles.get(z * MAP_SIZE + x) ?? null

const ROAD_LINES: readonly number[] = [CENTER + 31, CENTER + 32]

const roadAt: TerrainStamp = (x, z) =>
  ROAD_LINES.includes(x) || ROAD_LINES.includes(z) ? 'path' : null

const POND_CENTRE = { x: CENTER + 48, z: CENTER + 14 }
const POND_RADIUS = 5

const pondAt: TerrainStamp = (x, z) => {
  const distance = Math.hypot(x - POND_CENTRE.x, z - POND_CENTRE.z)
  if (distance <= POND_RADIUS) return 'water'
  if (distance <= POND_RADIUS + 1.5) return 'sand'
  return null
}

const RIVER_X = CHUNK_SIZE * 2 + 42

const riverAt: TerrainStamp = (x, z) => {
  if (z >= MAP_SIZE - 16) return null
  const centre = RIVER_X + Math.round(Math.sin(z * 0.07) * 4)
  const offset = Math.abs(x - centre)
  if (offset <= 2) return 'water'
  if (offset <= 3) return 'sand'
  return null
}

const shoreAt: TerrainStamp = (x, z) => {
  if (z >= MAP_SIZE - 6) return 'water'
  if (z >= MAP_SIZE - 14) return 'sand'
  return null
}

const terrainAt = (x: number, z: number): Terrain =>
  buildingAt(x, z) ?? roadAt(x, z) ?? pondAt(x, z) ?? riverAt(x, z) ?? shoreAt(x, z) ?? 'grass'

const TOWN_TREES: readonly Position[] = [
  { x: 20, z: 20 },
  { x: 22, z: 25 },
  { x: 18, z: 28 },
  { x: 40, z: 40 },
  { x: 43, z: 44 },
  { x: 46, z: 40 },
  { x: 38, z: 46 },
  { x: 25, z: 41 },
  { x: 50, z: 28 },
  { x: 54, z: 36 },
  { x: 8, z: 20 },
  { x: 12, z: 16 },
].map(({ x, z }) => ({ x: CENTER + x, z: CENTER + z }))

const FOREST_TREES: readonly Position[] = [
  { x: 10, z: 10 },
  { x: 14, z: 12 },
  { x: 8, z: 18 },
  { x: 18, z: 8 },
  { x: 22, z: 14 },
  { x: 26, z: 10 },
  { x: 12, z: 24 },
  { x: 20, z: 22 },
  { x: 28, z: 18 },
  { x: 34, z: 12 },
  { x: 6, z: 30 },
  { x: 16, z: 32 },
  { x: 24, z: 30 },
  { x: 32, z: 26 },
  { x: 38, z: 20 },
  { x: 40, z: 30 },
  { x: 30, z: 38 },
  { x: 44, z: 40 },
  { x: 36, z: 44 },
  { x: 48, z: 34 },
]

const MEADOW_TREES: readonly Position[] = [
  { x: 150, z: 150 },
  { x: 156, z: 144 },
  { x: 144, z: 156 },
  { x: 40, z: 110 },
  { x: 48, z: 120 },
  { x: 130, z: 40 },
]

const TREE_POSITIONS: readonly Position[] = [...TOWN_TREES, ...FOREST_TREES, ...MEADOW_TREES]

const INTERACTABLES: readonly WorldObject[] = [
  {
    id: 'fishing_spot_0',
    kind: 'fishing_spot',
    name: 'Fishing spot',
    examine: 'Fish are leaping out of the water here.',
    x: CENTER + 44,
    z: CENTER + 11,
  },
  {
    id: 'fishing_spot_1',
    kind: 'fishing_spot',
    name: 'Fishing spot',
    examine: 'Fish are leaping out of the water here.',
    x: CENTER + 52,
    z: CENTER + 16,
  },
  {
    id: 'fishing_spot_2',
    kind: 'fishing_spot',
    name: 'Fishing spot',
    examine: 'Fish are leaping out of the river here.',
    x: 171,
    z: 100,
  },
  {
    id: 'range_0',
    kind: 'range',
    name: 'Cooking range',
    examine: 'A hot range, perfect for cooking food.',
    x: CENTER + 39,
    z: CENTER + 49,
  },
  {
    id: 'campfire_0',
    kind: 'campfire',
    name: 'Campfire',
    examine: 'A crackling fire. Goblins gather around it at night.',
    x: 29,
    z: 163,
  },
  {
    id: 'bank_booth_0',
    kind: 'bank_booth',
    name: 'Bank booth',
    examine: 'A sturdy booth where bankers keep valuables safe.',
    x: CENTER + 36,
    z: CENTER + 24,
  },
  {
    id: 'bank_booth_1',
    kind: 'bank_booth',
    name: 'Bank booth',
    examine: 'A sturdy booth where bankers keep valuables safe.',
    x: CENTER + 38,
    z: CENTER + 24,
  },
]

export const GAME_MAP: GameMap = {
  terrain: Array.from({ length: MAP_SIZE }, (_, z) =>
    Array.from({ length: MAP_SIZE }, (_, x) => terrainAt(x, z)),
  ),
  objects: [
    ...TREE_POSITIONS.map(
      (position, index): WorldObject => ({
        id: `tree_${index}`,
        kind: 'tree',
        name: 'Tree',
        examine: 'A leafy tree. I could chop it down with an axe.',
        x: position.x,
        z: position.z,
      }),
    ),
    ...INTERACTABLES,
  ],
  itemSpawns: [
    { x: CENTER + 34, z: CENTER + 30, itemId: 'bronze_sword', quantity: 1, respawnTicks: 50 },
    { x: CENTER + 34, z: CENTER + 33, itemId: 'bronze_med_helm', quantity: 1, respawnTicks: 50 },
    { x: CENTER + 30, z: CENTER + 34, itemId: 'bronze_axe', quantity: 1, respawnTicks: 50 },
    { x: CENTER + 30, z: CENTER + 30, itemId: 'coins', quantity: 25, respawnTicks: 100 },
    {
      x: CENTER + 56,
      z: CENTER + 22,
      itemId: 'small_fishing_net',
      quantity: 1,
      respawnTicks: 100,
    },
  ],
  npcSpawns: [
    { npcId: 'npc_guide', defId: 'guide', x: CENTER + 35, z: CENTER + 35, wanderRadius: 0 },
    { npcId: 'npc_goblin_0', defId: 'goblin', x: CENTER + 12, z: CENTER + 48, wanderRadius: 4 },
    { npcId: 'npc_goblin_1', defId: 'goblin', x: CENTER + 15, z: CENTER + 47, wanderRadius: 4 },
    { npcId: 'npc_goblin_2', defId: 'goblin', x: CENTER + 11, z: CENTER + 45, wanderRadius: 4 },
    { npcId: 'npc_goblin_3', defId: 'goblin', x: 28, z: 162, wanderRadius: 4 },
    { npcId: 'npc_goblin_4', defId: 'goblin', x: 33, z: 165, wanderRadius: 4 },
    { npcId: 'npc_goblin_5', defId: 'goblin', x: 25, z: 167, wanderRadius: 4 },
    { npcId: 'npc_goblin_6', defId: 'goblin', x: 30, z: 158, wanderRadius: 4 },
    { npcId: 'npc_fisherman', defId: 'fisherman', x: CENTER + 52, z: CENTER + 23, wanderRadius: 0 },
    { npcId: 'npc_banker', defId: 'banker', x: CENTER + 37, z: CENTER + 23, wanderRadius: 0 },
    {
      npcId: 'npc_shopkeeper',
      defId: 'shopkeeper',
      x: CENTER + 25,
      z: CENTER + 37,
      wanderRadius: 0,
    },
    { npcId: 'npc_cow_0', defId: 'cow', x: 140, z: 52, wanderRadius: 5 },
    { npcId: 'npc_cow_1', defId: 'cow', x: 143, z: 48, wanderRadius: 5 },
    { npcId: 'npc_cow_2', defId: 'cow', x: 137, z: 47, wanderRadius: 5 },
    { npcId: 'npc_cow_3', defId: 'cow', x: 141, z: 44, wanderRadius: 5 },
  ],
  buildings: BUILDINGS,
  spawnPoint: { x: CENTER + 32, z: CENTER + 32 },
}

const buildCollisionGrid = (): Uint8Array => {
  const grid = new Uint8Array(MAP_SIZE * MAP_SIZE)
  GAME_MAP.terrain.forEach((row, z) =>
    row.forEach((terrain, x) => {
      if (terrain === 'water') grid[z * MAP_SIZE + x] = 1
    }),
  )
  GAME_MAP.objects.forEach((object) => {
    grid[object.z * MAP_SIZE + object.x] = 1
  })
  GAME_MAP.buildings.forEach((building) => {
    buildingTiles(building).walls.forEach((wall) => {
      grid[wall.z * MAP_SIZE + wall.x] = 1
    })
  })
  return grid
}

const collisionGrid = buildCollisionGrid()

export const isWalkable = (position: Position): boolean => {
  if (position.x < 0 || position.x >= MAP_SIZE || position.z < 0 || position.z >= MAP_SIZE) {
    return false
  }
  return collisionGrid[position.z * MAP_SIZE + position.x] === 0
}
