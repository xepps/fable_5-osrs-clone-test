import { NPCS, type ItemId, type SnapshotMessage } from '@osrs/shared'
import type { AddressedEvent } from './tick'
import { maxHpOf, type SimWorld } from './world'

const VIEW_DISTANCE_TILES = 32

export const snapshotFor = (
  world: SimWorld,
  playerId: string,
  events: readonly AddressedEvent[],
): SnapshotMessage | null => {
  const you = world.players[playerId]
  if (!you) return null
  const inView = (position: { x: number; z: number }): boolean =>
    Math.max(Math.abs(position.x - you.position.x), Math.abs(position.z - you.position.z)) <=
    VIEW_DISTANCE_TILES
  return {
    type: 'snapshot',
    tick: world.tick,
    players: Object.values(world.players)
      .filter((player) => player.id === playerId || inView(player.position))
      .map((player) => ({
        id: player.id,
        name: player.name,
        x: player.position.x,
        z: player.position.z,
        facing: player.facing,
        hp: player.hp,
        maxHp: maxHpOf(player),
        overheadText: player.overhead?.text ?? null,
        equipment: {
          head: player.equipment.head?.itemId ?? null,
          weapon: player.equipment.weapon?.itemId ?? null,
        },
        ...(player.lastAttackTick === world.tick ? { anim: 'attack' as const } : {}),
      })),
    npcs: Object.values(world.npcs)
      .filter((npc) => inView(npc.position))
      .map((npc) => ({
        id: npc.id,
        defId: npc.defId,
        x: npc.position.x,
        z: npc.position.z,
        facing: npc.facing,
        hp: Math.max(0, npc.hp),
        maxHp: NPCS[npc.defId].combat?.hitpoints ?? 1,
        dead: npc.respawnAtTick !== null,
        ...(npc.lastAttackTick === world.tick ? { anim: 'attack' as const } : {}),
      })),
    groundItems: world.groundItems
      .filter((item) => inView(item))
      .map((item) => ({
        x: item.x,
        z: item.z,
        itemId: item.itemId,
        quantity: item.quantity,
      })),
    depletedObjects: Object.keys(world.depletedTrees),
    events: events
      .filter((event) => event.audience === 'all' || event.audience === playerId)
      .map((event) => event.event),
    you: {
      hp: you.hp,
      inventory: you.inventory.map((stack) => (stack ? { ...stack } : null)),
      equipment: {
        head: you.equipment.head ? { ...you.equipment.head } : null,
        weapon: you.equipment.weapon ? { ...you.equipment.weapon } : null,
      },
      skills: { ...you.skills },
      runEnergy: you.runEnergy,
      runEnabled: you.runEnabled,
      openInterface: you.openInterface,
      bank: you.openInterface === 'bank' ? you.bank.map((entry) => ({ ...entry })) : null,
      shop:
        you.openInterface === 'shop'
          ? Object.entries(world.shopStock).map(([itemId, quantity]) => ({
              itemId: itemId as ItemId,
              quantity,
            }))
          : null,
    },
  }
}
