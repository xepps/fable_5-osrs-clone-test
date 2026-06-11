import type { ItemId } from './items'
import type { NpcDefId } from './npcs'
import type { Position } from './position'

export const MAP_SIZE = 64

export type Terrain = 'grass' | 'path' | 'sand' | 'water'

export type WorldObject = Readonly<{
  id: string
  kind: 'tree'
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
  spawnPoint: Position
}>

const POND_CENTRE = { x: 48, z: 14 }
const POND_RADIUS = 5

const terrainAt = (x: number, z: number): Terrain => {
  const pondDistance = Math.hypot(x - POND_CENTRE.x, z - POND_CENTRE.z)
  if (pondDistance <= POND_RADIUS) return 'water'
  if (pondDistance <= POND_RADIUS + 1.5) return 'sand'
  const onVerticalPath = (x === 31 || x === 32) && z >= 6 && z <= 56
  const onHorizontalPath = (z === 31 || z === 32) && x >= 8 && x <= 56
  if (onVerticalPath || onHorizontalPath) return 'path'
  return 'grass'
}

const TREE_POSITIONS: readonly Position[] = [
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
]

export const GAME_MAP: GameMap = {
  terrain: Array.from({ length: MAP_SIZE }, (_, z) =>
    Array.from({ length: MAP_SIZE }, (_, x) => terrainAt(x, z)),
  ),
  objects: TREE_POSITIONS.map((position, index) => ({
    id: `tree_${index}`,
    kind: 'tree',
    name: 'Tree',
    examine: 'A leafy tree. I could chop it down with an axe.',
    x: position.x,
    z: position.z,
  })),
  itemSpawns: [
    { x: 34, z: 30, itemId: 'bronze_sword', quantity: 1, respawnTicks: 50 },
    { x: 34, z: 33, itemId: 'bronze_med_helm', quantity: 1, respawnTicks: 50 },
    { x: 30, z: 34, itemId: 'bronze_axe', quantity: 1, respawnTicks: 50 },
    { x: 30, z: 30, itemId: 'coins', quantity: 25, respawnTicks: 100 },
  ],
  npcSpawns: [
    { npcId: 'npc_guide', defId: 'guide', x: 35, z: 35, wanderRadius: 0 },
    { npcId: 'npc_goblin_0', defId: 'goblin', x: 12, z: 48, wanderRadius: 4 },
    { npcId: 'npc_goblin_1', defId: 'goblin', x: 15, z: 47, wanderRadius: 4 },
    { npcId: 'npc_goblin_2', defId: 'goblin', x: 11, z: 45, wanderRadius: 4 },
  ],
  spawnPoint: { x: 32, z: 32 },
}

const treeTiles = new Set(GAME_MAP.objects.map((object) => `${object.x},${object.z}`))

export const isWalkable = (position: Position): boolean => {
  if (position.x < 0 || position.x >= MAP_SIZE || position.z < 0 || position.z >= MAP_SIZE) {
    return false
  }
  const terrain = GAME_MAP.terrain[position.z]?.[position.x]
  if (terrain === 'water') return false
  return !treeTiles.has(`${position.x},${position.z}`)
}
