import { z } from 'zod'
import { ITEM_IDS } from './items'
import { NPC_DEF_IDS } from './npcs'
import { SKILLS } from './skills'
import { MAP_SIZE } from './world'

export const INVENTORY_SIZE = 28

const coordinate = z
  .number()
  .int()
  .min(0)
  .max(MAP_SIZE - 1)
const itemId = z.enum(ITEM_IDS)
const inventorySlot = z
  .number()
  .int()
  .min(0)
  .max(INVENTORY_SIZE - 1)
const equipSlot = z.enum(['head', 'weapon'])

export const clientMessageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('hello'), name: z.string().trim().min(1).max(12) }),
  z.object({ type: z.literal('moveTo'), x: coordinate, z: coordinate }),
  z.object({ type: z.literal('takeItem'), x: coordinate, z: coordinate, itemId }),
  z.object({ type: z.literal('talkToNpc'), npcId: z.string() }),
  z.object({ type: z.literal('attackNpc'), npcId: z.string() }),
  z.object({ type: z.literal('chopTree'), objectId: z.string() }),
  z.object({ type: z.literal('equipItem'), slot: inventorySlot }),
  z.object({ type: z.literal('unequipItem'), equipSlot }),
  z.object({ type: z.literal('dropItem'), slot: inventorySlot }),
  z.object({ type: z.literal('chat'), text: z.string().trim().min(1).max(80) }),
])

export type ClientMessage = z.infer<typeof clientMessageSchema>

const facing = z.object({
  dx: z.number().int().min(-1).max(1),
  dz: z.number().int().min(-1).max(1),
})

const itemStack = z.object({ itemId, quantity: z.number().int().positive() })

const playerSnapshot = z.object({
  id: z.string(),
  name: z.string(),
  x: coordinate,
  z: coordinate,
  facing,
  hp: z.number().int().min(0),
  maxHp: z.number().int().positive(),
  overheadText: z.string().nullable(),
  equipment: z.object({ head: itemId.nullable(), weapon: itemId.nullable() }),
})

const npcSnapshot = z.object({
  id: z.string(),
  defId: z.enum(NPC_DEF_IDS),
  x: coordinate,
  z: coordinate,
  facing,
  hp: z.number().int().min(0),
  maxHp: z.number().int().positive(),
  dead: z.boolean(),
})

const groundItem = z.object({
  x: coordinate,
  z: coordinate,
  itemId,
  quantity: z.number().int().positive(),
})

const gameEvent = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('chat'), playerId: z.string(), name: z.string(), text: z.string() }),
  z.object({
    kind: z.literal('hitsplat'),
    targetKind: z.enum(['player', 'npc']),
    targetId: z.string(),
    damage: z.number().int().min(0),
  }),
  z.object({ kind: z.literal('message'), text: z.string() }),
  z.object({ kind: z.literal('dialogue'), npcName: z.string(), lines: z.array(z.string()) }),
  z.object({ kind: z.literal('levelUp'), skill: z.enum(SKILLS), level: z.number().int() }),
])

const privateState = z.object({
  hp: z.number().int().min(0),
  inventory: z.array(itemStack.nullable()).length(INVENTORY_SIZE),
  equipment: z.object({ head: itemStack.nullable(), weapon: itemStack.nullable() }),
  skills: z.object({
    attack: z.number().min(0),
    strength: z.number().min(0),
    defence: z.number().min(0),
    hitpoints: z.number().min(0),
    woodcutting: z.number().min(0),
  }),
})

export const serverMessageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('welcome'), playerId: z.string(), name: z.string() }),
  z.object({
    type: z.literal('snapshot'),
    tick: z.number().int().min(0),
    players: z.array(playerSnapshot),
    npcs: z.array(npcSnapshot),
    groundItems: z.array(groundItem),
    depletedObjects: z.array(z.string()),
    events: z.array(gameEvent),
    you: privateState,
  }),
])

export type ServerMessage = z.infer<typeof serverMessageSchema>
export type SnapshotMessage = Extract<ServerMessage, { type: 'snapshot' }>
export type PlayerSnapshot = z.infer<typeof playerSnapshot>
export type NpcSnapshot = z.infer<typeof npcSnapshot>
export type GroundItemSnapshot = z.infer<typeof groundItem>
export type GameEvent = z.infer<typeof gameEvent>
export type PrivateState = z.infer<typeof privateState>
export type Facing = z.infer<typeof facing>
