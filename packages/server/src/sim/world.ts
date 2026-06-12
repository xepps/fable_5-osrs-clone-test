import {
  GAME_MAP,
  initialSkillXp,
  INVENTORY_SIZE,
  isWalkable,
  levelForXp,
  NPCS,
  SHOP_BASE_STOCK,
  type Facing,
  type ItemId,
  type ItemStack,
  type NpcDefId,
  type PersistentPlayer,
  type Position,
  type SkillXp,
} from '@osrs/shared'

export type PlayerAction =
  | Readonly<{ kind: 'take'; x: number; z: number; itemId: ItemId }>
  | Readonly<{ kind: 'talk'; npcId: string }>
  | Readonly<{ kind: 'attack'; npcId: string }>
  | Readonly<{ kind: 'chop'; objectId: string }>
  | Readonly<{ kind: 'fish'; objectId: string }>
  | Readonly<{ kind: 'cook'; objectId: string; readyAtTick: number | null }>
  | Readonly<{ kind: 'openBank'; objectId: string }>
  | Readonly<{ kind: 'openShop'; npcId: string }>

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
  runEnabled: boolean
  runEnergy: number
  openInterface: 'bank' | 'shop' | null
  bank: ItemStack[]
  lastAttackTick: number | null
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
  lastAttackTick: number | null
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
  shopStock: Partial<Record<ItemId, number>>
}

export const maxHpOf = (player: SimPlayer): number => levelForXp(player.skills.hitpoints)

export const createPlayer = (id: string, name: string, restore?: PersistentPlayer): SimPlayer => {
  const skills = restore?.skills ?? initialSkillXp()
  const maxHp = levelForXp(skills.hitpoints)
  return {
    id,
    name,
    position: restore && isWalkable(restore.position) ? restore.position : GAME_MAP.spawnPoint,
    facing: { dx: 0, dz: 1 },
    path: [],
    inventory: restore
      ? restore.inventory.map((stack) => (stack ? { ...stack } : null))
      : Array.from({ length: INVENTORY_SIZE }, () => null),
    equipment: restore
      ? {
          head: restore.equipment.head ? { ...restore.equipment.head } : null,
          weapon: restore.equipment.weapon ? { ...restore.equipment.weapon } : null,
        }
      : { head: null, weapon: null },
    skills,
    hp: restore ? Math.min(maxHp, Math.max(1, restore.hp)) : maxHp,
    action: null,
    attackCooldown: 0,
    overhead: null,
    runEnabled: false,
    runEnergy: restore?.runEnergy ?? 100,
    openInterface: null,
    bank: restore ? restore.bank.map((stack) => ({ ...stack })) : [],
    lastAttackTick: null,
  }
}

export const persistentStateOf = (player: SimPlayer): PersistentPlayer => ({
  version: 1,
  name: player.name,
  position: { x: player.position.x, z: player.position.z },
  hp: player.hp,
  skills: { ...player.skills },
  inventory: player.inventory.map((stack) => (stack ? { ...stack } : null)),
  equipment: {
    head: player.equipment.head ? { ...player.equipment.head } : null,
    weapon: player.equipment.weapon ? { ...player.equipment.weapon } : null,
  },
  bank: player.bank.map((stack) => ({ ...stack })),
  runEnergy: player.runEnergy,
})

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
        lastAttackTick: null,
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
  shopStock: { ...SHOP_BASE_STOCK },
})
