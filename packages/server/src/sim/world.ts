import {
  GAME_MAP,
  initialSkillXp,
  INVENTORY_SIZE,
  levelForXp,
  NPCS,
  type Facing,
  type ItemId,
  type ItemStack,
  type NpcDefId,
  type Position,
  type SkillXp,
} from '@osrs/shared'

export type PlayerAction =
  | Readonly<{ kind: 'take'; x: number; z: number; itemId: ItemId }>
  | Readonly<{ kind: 'talk'; npcId: string }>
  | Readonly<{ kind: 'attack'; npcId: string }>
  | Readonly<{ kind: 'chop'; objectId: string }>

export type SimPlayer = {
  id: string
  name: string
  position: Position
  facing: Facing
  path: Position[]
  inventory: (ItemStack | null)[]
  equipment: { head: ItemStack | null; weapon: ItemStack | null }
  skills: SkillXp
  hp: number
  action: PlayerAction | null
  attackCooldown: number
  overhead: { text: string; expiresTick: number } | null
}

export type SimNpc = {
  id: string
  defId: NpcDefId
  home: Position
  wanderRadius: number
  position: Position
  facing: Facing
  hp: number
  respawnAtTick: number | null
  attackCooldown: number
  targetPlayerId: string | null
}

export type SimGroundItem = {
  x: number
  z: number
  itemId: ItemId
  quantity: number
  spawnIndex?: number
  despawnAtTick?: number
}

export type SimWorld = {
  tick: number
  players: Record<string, SimPlayer>
  npcs: Record<string, SimNpc>
  groundItems: SimGroundItem[]
  itemRespawns: Record<number, number>
  depletedTrees: Record<string, number>
}

export const maxHpOf = (player: SimPlayer): number => levelForXp(player.skills.hitpoints)

export const createPlayer = (id: string, name: string): SimPlayer => {
  const skills = initialSkillXp()
  return {
    id,
    name,
    position: GAME_MAP.spawnPoint,
    facing: { dx: 0, dz: 1 },
    path: [],
    inventory: Array.from({ length: INVENTORY_SIZE }, () => null),
    equipment: { head: null, weapon: null },
    skills,
    hp: levelForXp(skills.hitpoints),
    action: null,
    attackCooldown: 0,
    overhead: null,
  }
}

const npcMaxHp = (defId: NpcDefId): number => NPCS[defId].combat?.hitpoints ?? 1

export const createWorld = (): SimWorld => ({
  tick: 0,
  players: {},
  npcs: Object.fromEntries(
    GAME_MAP.npcSpawns.map((spawn) => [
      spawn.npcId,
      {
        id: spawn.npcId,
        defId: spawn.defId,
        home: { x: spawn.x, z: spawn.z },
        wanderRadius: spawn.wanderRadius,
        position: { x: spawn.x, z: spawn.z },
        facing: { dx: 0, dz: 1 },
        hp: npcMaxHp(spawn.defId),
        respawnAtTick: null,
        attackCooldown: 0,
        targetPlayerId: null,
      } satisfies SimNpc,
    ]),
  ),
  groundItems: GAME_MAP.itemSpawns.map((spawn, spawnIndex) => ({
    x: spawn.x,
    z: spawn.z,
    itemId: spawn.itemId,
    quantity: spawn.quantity,
    spawnIndex,
  })),
  itemRespawns: {},
  depletedTrees: {},
})
