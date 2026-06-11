import { NPCS, type SnapshotMessage } from '@osrs/shared'
import type { AddressedEvent } from './tick'
import { maxHpOf, type SimWorld } from './world'

export const snapshotFor = (
  world: SimWorld,
  playerId: string,
  events: readonly AddressedEvent[],
): SnapshotMessage | null => {
  const you = world.players[playerId]
  if (!you) return null
  return {
    type: 'snapshot',
    tick: world.tick,
    players: Object.values(world.players).map((player) => ({
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
    })),
    npcs: Object.values(world.npcs).map((npc) => ({
      id: npc.id,
      defId: npc.defId,
      x: npc.position.x,
      z: npc.position.z,
      facing: npc.facing,
      hp: Math.max(0, npc.hp),
      maxHp: NPCS[npc.defId].combat?.hitpoints ?? 1,
      dead: npc.respawnAtTick !== null,
    })),
    groundItems: world.groundItems.map((item) => ({
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
    },
  }
}
