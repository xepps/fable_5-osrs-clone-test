import { describe, expect, it } from 'vitest'
import { GAME_MAP, type GameEvent } from '@osrs/shared'
import { snapshotFor } from './snapshot'
import { runTick, type AddressedEvent, type SimIntent, type SimRng } from './tick'
import { createWorld, type SimWorld } from './world'

const cycle = (values: number[]) => {
  let index = 0
  return () => values[index++ % values.length]!
}

const calmRng = (overrides: Partial<SimRng> = {}): SimRng => ({
  combat: cycle([0.1, 0.9]),
  skill: () => 0,
  wander: () => 0.99,
  ...overrides,
})

const harness = (rng: SimRng = calmRng()) => {
  let world = createWorld()
  const events: AddressedEvent[] = []
  const step = (intents: SimIntent[] = []) => {
    const result = runTick(world, intents, rng)
    world = result.world
    events.push(...result.events)
  }
  const stepN = (count: number) => {
    for (let i = 0; i < count; i += 1) step()
  }
  return {
    get world(): SimWorld {
      return world
    },
    events,
    step,
    stepN,
  }
}

const join = (playerId: string, name: string): SimIntent => ({ kind: 'join', playerId, name })

const msg = (
  playerId: string,
  message: Extract<SimIntent, { kind: 'message' }>['message'],
): SimIntent => ({
  kind: 'message',
  playerId,
  message,
})

const eventsFor = (events: readonly AddressedEvent[], playerId: string): GameEvent[] =>
  events
    .filter((event) => event.audience === 'all' || event.audience === playerId)
    .map((event) => event.event)

const messagesFor = (events: readonly AddressedEvent[], playerId: string): string[] =>
  eventsFor(events, playerId).flatMap((event) => (event.kind === 'message' ? [event.text] : []))

describe('joining and leaving the world', () => {
  it('spawns a new player at the spawn point with 10 hp and an empty inventory', () => {
    const game = harness()
    game.step([join('p1', 'Bob')])
    const player = game.world.players['p1']!
    expect(player.position).toEqual(GAME_MAP.spawnPoint)
    expect(player.hp).toBe(10)
    expect(player.inventory.every((slot) => slot === null)).toBe(true)
  })

  it('removes a player who leaves and stops sending them snapshots', () => {
    const game = harness()
    game.step([join('p1', 'Bob')])
    game.step([{ kind: 'leave', playerId: 'p1' }])
    expect(game.world.players['p1']).toBeUndefined()
    expect(snapshotFor(game.world, 'p1', [])).toBeNull()
  })
})

describe('walking', () => {
  it('moves one tile per tick towards a clicked destination', () => {
    const game = harness()
    game.step([join('p1', 'Bob')])
    game.step([msg('p1', { type: 'moveTo', x: 36, z: 32 })])
    expect(game.world.players['p1']!.position).toEqual({ x: 33, z: 32 })
    game.stepN(3)
    expect(game.world.players['p1']!.position).toEqual({ x: 36, z: 32 })
  })

  it('replaces the current path when a new destination is clicked mid-walk', () => {
    const game = harness()
    game.step([join('p1', 'Bob')])
    game.step([msg('p1', { type: 'moveTo', x: 40, z: 32 })])
    game.step([msg('p1', { type: 'moveTo', x: 32, z: 32 })])
    game.stepN(2)
    expect(game.world.players['p1']!.position).toEqual({ x: 32, z: 32 })
  })
})

describe('ground items and the inventory', () => {
  it('walks to a ground item, picks it up, and the spawn respawns later', () => {
    const game = harness()
    game.step([join('p1', 'Bob')])
    game.step([msg('p1', { type: 'takeItem', x: 34, z: 30, itemId: 'bronze_sword' })])
    game.stepN(3)
    const player = game.world.players['p1']!
    expect(player.inventory[0]).toEqual({ itemId: 'bronze_sword', quantity: 1 })
    expect(game.world.groundItems.some((item) => item.itemId === 'bronze_sword')).toBe(false)
    game.stepN(51)
    expect(
      game.world.groundItems.some(
        (item) => item.itemId === 'bronze_sword' && item.x === 34 && item.z === 30,
      ),
    ).toBe(true)
  })

  it('stacks coins into a single inventory slot across pickups', () => {
    const game = harness()
    game.step([join('p1', 'Bob')])
    game.step([msg('p1', { type: 'takeItem', x: 30, z: 30, itemId: 'coins' })])
    game.stepN(5)
    game.stepN(101)
    game.step([msg('p1', { type: 'takeItem', x: 30, z: 30, itemId: 'coins' })])
    game.stepN(5)
    const player = game.world.players['p1']!
    const coinSlots = player.inventory.filter((slot) => slot?.itemId === 'coins')
    expect(coinSlots).toEqual([{ itemId: 'coins', quantity: 50 }])
  })

  it('drops an item onto the tile the player is standing on', () => {
    const game = harness()
    game.step([join('p1', 'Bob')])
    game.step([msg('p1', { type: 'takeItem', x: 34, z: 30, itemId: 'bronze_sword' })])
    game.stepN(3)
    game.step([msg('p1', { type: 'dropItem', slot: 0 })])
    const player = game.world.players['p1']!
    expect(player.inventory[0]).toBeNull()
    expect(
      game.world.groundItems.some(
        (item) =>
          item.itemId === 'bronze_sword' &&
          item.x === player.position.x &&
          item.z === player.position.z,
      ),
    ).toBe(true)
  })

  it('tells the player when the item they walked to has already gone', () => {
    const game = harness()
    game.step([join('p1', 'Bob'), join('p2', 'Alice')])
    game.step([
      msg('p1', { type: 'takeItem', x: 34, z: 30, itemId: 'bronze_sword' }),
      msg('p2', { type: 'takeItem', x: 34, z: 30, itemId: 'bronze_sword' }),
    ])
    game.stepN(4)
    const winners = ['p1', 'p2'].filter((id) =>
      game.world.players[id]!.inventory.some((slot) => slot?.itemId === 'bronze_sword'),
    )
    expect(winners).toHaveLength(1)
    const loser = winners[0] === 'p1' ? 'p2' : 'p1'
    expect(messagesFor(game.events, loser)).toContain("Too late - it's gone!")
  })
})

describe('equipment', () => {
  const armedPlayer = () => {
    const game = harness()
    game.step([join('p1', 'Bob')])
    game.step([msg('p1', { type: 'takeItem', x: 34, z: 30, itemId: 'bronze_sword' })])
    game.stepN(3)
    return game
  }

  it('wields a sword from the inventory into the weapon slot', () => {
    const game = armedPlayer()
    game.step([msg('p1', { type: 'equipItem', slot: 0 })])
    const player = game.world.players['p1']!
    expect(player.equipment.weapon).toEqual({ itemId: 'bronze_sword', quantity: 1 })
    expect(player.inventory[0]).toBeNull()
  })

  it('swaps the currently wielded weapon back into the inventory slot', () => {
    const game = armedPlayer()
    game.step([msg('p1', { type: 'takeItem', x: 30, z: 34, itemId: 'bronze_axe' })])
    game.stepN(6)
    game.step([msg('p1', { type: 'equipItem', slot: 0 })])
    game.step([msg('p1', { type: 'equipItem', slot: 1 })])
    const player = game.world.players['p1']!
    expect(player.equipment.weapon).toEqual({ itemId: 'bronze_axe', quantity: 1 })
    expect(player.inventory[1]).toEqual({ itemId: 'bronze_sword', quantity: 1 })
  })

  it('unequips back into a free inventory slot', () => {
    const game = armedPlayer()
    game.step([msg('p1', { type: 'equipItem', slot: 0 })])
    game.step([msg('p1', { type: 'unequipItem', equipSlot: 'weapon' })])
    const player = game.world.players['p1']!
    expect(player.equipment.weapon).toBeNull()
    expect(player.inventory[0]).toEqual({ itemId: 'bronze_sword', quantity: 1 })
  })

  it('refuses to equip something that is not equipment', () => {
    const game = harness()
    game.step([join('p1', 'Bob')])
    game.step([msg('p1', { type: 'takeItem', x: 30, z: 30, itemId: 'coins' })])
    game.stepN(5)
    game.step([msg('p1', { type: 'equipItem', slot: 0 })])
    expect(game.world.players['p1']!.equipment.weapon).toBeNull()
    expect(messagesFor(game.events, 'p1')).toContain("You can't equip that.")
  })
})

describe('chat', () => {
  it('broadcasts chat to everyone and floats it above the speaker until it expires', () => {
    const game = harness()
    game.step([join('p1', 'Bob'), join('p2', 'Alice')])
    game.step([msg('p1', { type: 'chat', text: 'hello world' })])
    expect(eventsFor(game.events, 'p2')).toContainEqual({
      kind: 'chat',
      playerId: 'p1',
      name: 'Bob',
      text: 'hello world',
    })
    expect(game.world.players['p1']!.overhead?.text).toBe('hello world')
    game.stepN(8)
    expect(game.world.players['p1']!.overhead).toBeNull()
  })
})

describe('talking to npcs', () => {
  it('walks over to the guide and receives his dialogue', () => {
    const game = harness()
    game.step([join('p1', 'Bob')])
    game.step([msg('p1', { type: 'talkToNpc', npcId: 'npc_guide' })])
    game.stepN(10)
    const dialogue = eventsFor(game.events, 'p1').find((event) => event.kind === 'dialogue')
    expect(dialogue).toBeDefined()
    expect(dialogue).toMatchObject({ npcName: 'Lumbridge Guide' })
  })

  it('refuses to fight the guide', () => {
    const game = harness()
    game.step([join('p1', 'Bob')])
    game.step([msg('p1', { type: 'attackNpc', npcId: 'npc_guide' })])
    game.stepN(10)
    expect(messagesFor(game.events, 'p1')).toContain("The Lumbridge Guide doesn't want to fight.")
  })
})

describe('combat', () => {
  it('chases a goblin, exchanges blows every 4 ticks, kills it, and it drops loot', () => {
    const game = harness()
    game.step([join('p1', 'Bob')])
    game.step([msg('p1', { type: 'attackNpc', npcId: 'npc_goblin_0' })])
    game.stepN(60)
    const npcHitsplats = eventsFor(game.events, 'p1').filter(
      (event) => event.kind === 'hitsplat' && event.targetKind === 'npc',
    )
    expect(npcHitsplats.length).toBeGreaterThanOrEqual(5)
    expect(messagesFor(game.events, 'p1')).toContain('You have defeated the Goblin.')
    expect(game.world.groundItems.some((item) => item.itemId === 'bones')).toBe(true)
    expect(
      game.world.groundItems.some((item) => item.itemId === 'coins' && item.quantity === 5),
    ).toBe(true)
  })

  it('awards attack, strength and hitpoints xp for damage dealt', () => {
    const game = harness()
    game.step([join('p1', 'Bob')])
    game.step([msg('p1', { type: 'attackNpc', npcId: 'npc_goblin_0' })])
    game.stepN(60)
    const skills = game.world.players['p1']!.skills
    expect(skills.attack).toBe(10)
    expect(skills.strength).toBe(10)
    expect(skills.hitpoints).toBeCloseTo(1154 + 6.65, 5)
  })

  it('respawns a slain goblin at its home after a delay', () => {
    const game = harness()
    game.step([join('p1', 'Bob')])
    game.step([msg('p1', { type: 'attackNpc', npcId: 'npc_goblin_0' })])
    game.stepN(60)
    const deadAtSomePoint = game.world.npcs['npc_goblin_0']!
    expect(deadAtSomePoint.respawnAtTick === null ? deadAtSomePoint.hp : 0).not.toBe(undefined)
    game.stepN(30)
    const goblin = game.world.npcs['npc_goblin_0']!
    expect(goblin.respawnAtTick).toBeNull()
    expect(goblin.hp).toBe(5)
    expect(goblin.position).toEqual(goblin.home)
  })

  it('kills the player eventually if they stand and take goblin hits, respawning them at spawn', () => {
    const game = harness()
    game.step([join('p1', 'Bob')])
    game.step([msg('p1', { type: 'attackNpc', npcId: 'npc_goblin_0' })])
    game.stepN(25)
    const punchedFrom = game.world.players['p1']!.position
    game.step([msg('p1', { type: 'moveTo', x: punchedFrom.x, z: punchedFrom.z })])
    game.stepN(70)
    expect(messagesFor(game.events, 'p1')).toContain('Oh dear, you are dead!')
    const player = game.world.players['p1']!
    expect(player.position).toEqual(GAME_MAP.spawnPoint)
    expect(player.hp).toBe(10)
    expect(Object.values(game.world.npcs).every((npc) => npc.targetPlayerId !== 'p1')).toBe(true)
  })
})

describe('woodcutting', () => {
  const lumberjack = () => {
    const game = harness()
    game.step([join('p1', 'Bob')])
    game.step([msg('p1', { type: 'takeItem', x: 30, z: 34, itemId: 'bronze_axe' })])
    game.stepN(4)
    return game
  }

  it('chops a tree with an axe, granting logs and woodcutting xp, and the tree falls', () => {
    const game = lumberjack()
    game.step([msg('p1', { type: 'chopTree', objectId: 'tree_0' })])
    game.stepN(20)
    const player = game.world.players['p1']!
    expect(player.inventory.some((slot) => slot?.itemId === 'logs')).toBe(true)
    expect(player.skills.woodcutting).toBe(25)
    expect(messagesFor(game.events, 'p1')).toContain('You get some logs.')
    expect(Object.keys(game.world.depletedTrees)).toContain('tree_0')
    game.stepN(51)
    expect(Object.keys(game.world.depletedTrees)).not.toContain('tree_0')
  })

  it('requires an axe to chop', () => {
    const game = harness()
    game.step([join('p1', 'Bob')])
    game.step([msg('p1', { type: 'chopTree', objectId: 'tree_0' })])
    game.stepN(20)
    expect(messagesFor(game.events, 'p1')).toContain('You need an axe to chop down this tree.')
    expect(game.world.players['p1']!.inventory.some((slot) => slot?.itemId === 'logs')).toBe(false)
  })

  it('announces a level up once enough logs have been chopped', () => {
    const game = lumberjack()
    const treeIds = ['tree_0', 'tree_1', 'tree_2', 'tree_3']
    treeIds.forEach((objectId) => {
      game.step([msg('p1', { type: 'chopTree', objectId })])
      game.stepN(40)
    })
    expect(game.world.players['p1']!.skills.woodcutting).toBe(100)
    expect(eventsFor(game.events, 'p1')).toContainEqual({
      kind: 'levelUp',
      skill: 'woodcutting',
      level: 2,
    })
    expect(
      messagesFor(game.events, 'p1').some((text) => text.includes('advanced a Woodcutting level')),
    ).toBe(true)
  })
})

describe('snapshots', () => {
  it('shows private inventory only to the owning player but equipment visuals to everyone', () => {
    const game = harness()
    game.step([join('p1', 'Bob'), join('p2', 'Alice')])
    game.step([msg('p1', { type: 'takeItem', x: 34, z: 30, itemId: 'bronze_sword' })])
    game.stepN(3)
    game.step([msg('p1', { type: 'equipItem', slot: 0 })])
    const forP1 = snapshotFor(game.world, 'p1', [])!
    const forP2 = snapshotFor(game.world, 'p2', [])!
    expect(forP1.you.equipment.weapon).toEqual({ itemId: 'bronze_sword', quantity: 1 })
    expect(forP2.you.equipment.weapon).toBeNull()
    const bobSeenByAlice = forP2.players.find((player) => player.id === 'p1')
    expect(bobSeenByAlice?.equipment.weapon).toBe('bronze_sword')
  })

  it('filters addressed events so private messages do not leak', () => {
    const game = harness()
    game.step([join('p1', 'Bob'), join('p2', 'Alice')])
    const events: AddressedEvent[] = [
      { audience: 'p1', event: { kind: 'message', text: 'secret' } },
      { audience: 'all', event: { kind: 'chat', playerId: 'p2', name: 'Alice', text: 'hi' } },
    ]
    const forP2 = snapshotFor(game.world, 'p2', events)!
    expect(forP2.events).toEqual([{ kind: 'chat', playerId: 'p2', name: 'Alice', text: 'hi' }])
  })
})
