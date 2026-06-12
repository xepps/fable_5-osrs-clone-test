import { describe, expect, it } from 'vitest'
import {
  GAME_MAP,
  levelForXp,
  type GameEvent,
  type ItemId,
  type PersistentPlayer,
} from '@osrs/shared'
import { snapshotFor } from './snapshot'
import { runTick, type AddressedEvent, type SimIntent, type SimRng } from './tick'
import { createPlayer, createWorld, persistentStateOf, type SimWorld } from './world'

const SPAWN = GAME_MAP.spawnPoint

const itemSpawnOf = (itemId: ItemId) =>
  GAME_MAP.itemSpawns.find((spawn) => spawn.itemId === itemId)!

const swordSpawn = itemSpawnOf('bronze_sword')
const coinsSpawn = itemSpawnOf('coins')
const axeSpawn = itemSpawnOf('bronze_axe')

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

describe('restoring a saved character', () => {
  const savedState = (): PersistentPlayer => ({
    version: 1,
    name: 'Bob',
    position: { x: SPAWN.x + 10, z: SPAWN.z + 5 },
    hp: 4,
    skills: {
      attack: 100,
      strength: 80,
      defence: 0,
      hitpoints: 1300,
      woodcutting: 50,
      fishing: 25,
      cooking: 30,
    },
    inventory: [
      { itemId: 'bronze_axe', quantity: 1 },
      { itemId: 'coins', quantity: 40 },
      ...Array.from({ length: 26 }, () => null),
    ],
    equipment: { head: null, weapon: { itemId: 'bronze_sword', quantity: 1 } },
    bank: [{ itemId: 'raw_shrimps', quantity: 12 }],
    runEnergy: 55,
  })

  it('rejoins with the saved position, stats, items and bank', () => {
    const game = harness()
    game.step([{ kind: 'join', playerId: 'p1', name: 'Bob', restore: savedState() }])
    const player = game.world.players['p1']!
    expect(player.position).toEqual(savedState().position)
    expect(player.hp).toBe(4)
    expect(player.skills).toEqual(savedState().skills)
    expect(player.inventory[0]).toEqual({ itemId: 'bronze_axe', quantity: 1 })
    expect(player.equipment.weapon).toEqual({ itemId: 'bronze_sword', quantity: 1 })
    expect(player.bank).toEqual([{ itemId: 'raw_shrimps', quantity: 12 }])
    expect(player.runEnergy).toBe(savedState().runEnergy + 1)
  })

  it('starts restored characters with fresh transient state', () => {
    const game = harness()
    game.step([{ kind: 'join', playerId: 'p1', name: 'Bob', restore: savedState() }])
    const player = game.world.players['p1']!
    expect(player.path).toEqual([])
    expect(player.action).toBeNull()
    expect(player.openInterface).toBeNull()
    expect(player.attackCooldown).toBe(0)
  })

  it('clamps a zero-hp save to at least one hitpoint', () => {
    const game = harness()
    game.step([{ kind: 'join', playerId: 'p1', name: 'Bob', restore: { ...savedState(), hp: 0 } }])
    expect(game.world.players['p1']!.hp).toBe(1)
  })

  it('falls back to the spawn point when the saved position is not walkable', () => {
    const waterTile = GAME_MAP.terrain.flatMap((row, z) =>
      row.flatMap((terrain, x) => (terrain === 'water' ? [{ x, z }] : [])),
    )[0]!
    const game = harness()
    game.step([
      {
        kind: 'join',
        playerId: 'p1',
        name: 'Bob',
        restore: { ...savedState(), position: waterTile },
      },
    ])
    expect(game.world.players['p1']!.position).toEqual(GAME_MAP.spawnPoint)
  })

  it('round-trips a live player through persistentStateOf and back', () => {
    const game = harness()
    game.step([join('p1', 'Bob')])
    game.step([
      msg('p1', { type: 'takeItem', x: swordSpawn.x, z: swordSpawn.z, itemId: 'bronze_sword' }),
    ])
    game.stepN(3)
    const saved = persistentStateOf(game.world.players['p1']!)
    const clone = createPlayer('p2', saved.name, saved)
    expect(persistentStateOf(clone)).toEqual(saved)
  })
})

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
    expect(snapshotFor(game.world, 'p1', [], '')).toBeNull()
  })
})

describe('walking', () => {
  it('moves one tile per tick towards a clicked destination', () => {
    const game = harness()
    game.step([join('p1', 'Bob')])
    game.step([msg('p1', { type: 'moveTo', x: SPAWN.x + 4, z: SPAWN.z })])
    expect(game.world.players['p1']!.position).toEqual({ x: SPAWN.x + 1, z: SPAWN.z })
    game.stepN(3)
    expect(game.world.players['p1']!.position).toEqual({ x: SPAWN.x + 4, z: SPAWN.z })
  })

  it('replaces the current path when a new destination is clicked mid-walk', () => {
    const game = harness()
    game.step([join('p1', 'Bob')])
    game.step([msg('p1', { type: 'moveTo', x: SPAWN.x + 8, z: SPAWN.z })])
    game.step([msg('p1', { type: 'moveTo', x: SPAWN.x, z: SPAWN.z })])
    game.stepN(2)
    expect(game.world.players['p1']!.position).toEqual(SPAWN)
  })
})

describe('running', () => {
  const runner = () => {
    const game = harness()
    game.step([join('p1', 'Bob')])
    game.step([msg('p1', { type: 'setRun', enabled: true })])
    return game
  }

  it('reports run energy and mode in the private snapshot', () => {
    const game = runner()
    const snapshot = snapshotFor(game.world, 'p1', [], '')!
    expect(snapshot.you.runEnabled).toBe(true)
    expect(snapshot.you.runEnergy).toBe(100)
  })

  it('moves two tiles per tick while running and drains one energy per tile', () => {
    const game = runner()
    game.step([msg('p1', { type: 'moveTo', x: SPAWN.x + 8, z: SPAWN.z })])
    expect(game.world.players['p1']!.position).toEqual({ x: SPAWN.x + 2, z: SPAWN.z })
    expect(game.world.players['p1']!.runEnergy).toBe(98)
    game.stepN(3)
    expect(game.world.players['p1']!.position).toEqual({ x: SPAWN.x + 8, z: SPAWN.z })
    expect(game.world.players['p1']!.runEnergy).toBe(92)
  })

  it('drains a single energy for the final odd-numbered step', () => {
    const game = runner()
    game.step([msg('p1', { type: 'moveTo', x: SPAWN.x + 3, z: SPAWN.z })])
    game.step()
    expect(game.world.players['p1']!.position).toEqual({ x: SPAWN.x + 3, z: SPAWN.z })
    expect(game.world.players['p1']!.runEnergy).toBe(97)
  })

  it('restores one energy per tick while walking or standing still', () => {
    const game = runner()
    game.step([msg('p1', { type: 'moveTo', x: SPAWN.x + 8, z: SPAWN.z })])
    game.stepN(3)
    game.step([msg('p1', { type: 'setRun', enabled: false })])
    expect(game.world.players['p1']!.runEnergy).toBe(93)
    game.step([msg('p1', { type: 'moveTo', x: SPAWN.x, z: SPAWN.z })])
    game.stepN(2)
    expect(game.world.players['p1']!.position).toEqual({ x: SPAWN.x + 5, z: SPAWN.z })
    expect(game.world.players['p1']!.runEnergy).toBe(96)
  })

  it('never restores energy above 100', () => {
    const game = runner()
    game.step([msg('p1', { type: 'moveTo', x: SPAWN.x + 2, z: SPAWN.z })])
    game.stepN(5)
    expect(game.world.players['p1']!.runEnergy).toBe(100)
  })

  it('auto-disables running at zero energy and walks from then on', () => {
    const game = runner()
    for (let trip = 0; trip < 4; trip += 1) {
      game.step([msg('p1', { type: 'moveTo', x: SPAWN.x + 24, z: SPAWN.z })])
      game.stepN(11)
      game.step([msg('p1', { type: 'moveTo', x: SPAWN.x, z: SPAWN.z })])
      game.stepN(11)
    }
    expect(game.world.players['p1']!.runEnabled).toBe(false)
    const before = game.world.players['p1']!.position
    game.step([msg('p1', { type: 'moveTo', x: before.x + 4, z: before.z })])
    expect(game.world.players['p1']!.position).toEqual({ x: before.x + 1, z: before.z })
  })
})

describe('buildings', () => {
  it('walks through a doorway into a building interior', () => {
    const game = harness()
    game.step([join('p1', 'Bob')])
    const building = GAME_MAP.buildings[0]!
    const door = building.doors[0]!
    const inwardDz = door.z === building.z ? 1 : door.z === building.z + building.depth - 1 ? -1 : 0
    const inwardDx = inwardDz !== 0 ? 0 : door.x === building.x ? 1 : -1
    const interior = { x: door.x + inwardDx, z: door.z + inwardDz }
    game.step([msg('p1', { type: 'moveTo', x: interior.x, z: interior.z })])
    game.stepN(80)
    expect(game.world.players['p1']!.position).toEqual(interior)
  })
})

describe('ground items and the inventory', () => {
  it('walks to a ground item, picks it up, and the spawn respawns later', () => {
    const game = harness()
    game.step([join('p1', 'Bob')])
    game.step([
      msg('p1', { type: 'takeItem', x: swordSpawn.x, z: swordSpawn.z, itemId: 'bronze_sword' }),
    ])
    game.stepN(3)
    const player = game.world.players['p1']!
    expect(player.inventory[0]).toEqual({ itemId: 'bronze_sword', quantity: 1 })
    expect(game.world.groundItems.some((item) => item.itemId === 'bronze_sword')).toBe(false)
    game.stepN(51)
    expect(
      game.world.groundItems.some(
        (item) =>
          item.itemId === 'bronze_sword' && item.x === swordSpawn.x && item.z === swordSpawn.z,
      ),
    ).toBe(true)
  })

  it('stacks coins into a single inventory slot across pickups', () => {
    const game = harness()
    game.step([join('p1', 'Bob')])
    game.step([msg('p1', { type: 'takeItem', x: coinsSpawn.x, z: coinsSpawn.z, itemId: 'coins' })])
    game.stepN(5)
    game.stepN(101)
    game.step([msg('p1', { type: 'takeItem', x: coinsSpawn.x, z: coinsSpawn.z, itemId: 'coins' })])
    game.stepN(5)
    const player = game.world.players['p1']!
    const coinSlots = player.inventory.filter((slot) => slot?.itemId === 'coins')
    expect(coinSlots).toEqual([{ itemId: 'coins', quantity: 50 }])
  })

  it('drops an item onto the tile the player is standing on', () => {
    const game = harness()
    game.step([join('p1', 'Bob')])
    game.step([
      msg('p1', { type: 'takeItem', x: swordSpawn.x, z: swordSpawn.z, itemId: 'bronze_sword' }),
    ])
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
      msg('p1', { type: 'takeItem', x: swordSpawn.x, z: swordSpawn.z, itemId: 'bronze_sword' }),
      msg('p2', { type: 'takeItem', x: swordSpawn.x, z: swordSpawn.z, itemId: 'bronze_sword' }),
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
    game.step([
      msg('p1', { type: 'takeItem', x: swordSpawn.x, z: swordSpawn.z, itemId: 'bronze_sword' }),
    ])
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
    game.step([msg('p1', { type: 'takeItem', x: axeSpawn.x, z: axeSpawn.z, itemId: 'bronze_axe' })])
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
    game.step([msg('p1', { type: 'takeItem', x: coinsSpawn.x, z: coinsSpawn.z, itemId: 'coins' })])
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

describe('combat animations', () => {
  it('flags attackers with an attack animation only on the tick a blow lands', () => {
    const game = harness()
    game.step([join('p1', 'Bob')])
    game.step([msg('p1', { type: 'attackNpc', npcId: 'npc_goblin_0' })])
    let sawPlayerAttack = false
    let sawNpcAttack = false
    for (let i = 0; i < 60 && !(sawPlayerAttack && sawNpcAttack); i += 1) {
      game.step()
      const snapshot = snapshotFor(game.world, 'p1', [], '')!
      const me = snapshot.players.find((player) => player.id === 'p1')!
      const goblin = snapshot.npcs.find((npc) => npc.id === 'npc_goblin_0')
      sawNpcAttack = sawNpcAttack || goblin?.anim === 'attack'
      if (me.anim === 'attack' && !sawPlayerAttack) {
        sawPlayerAttack = true
        game.step()
        const after = snapshotFor(game.world, 'p1', [], '')!
        expect(after.players.find((player) => player.id === 'p1')!.anim).toBeUndefined()
      }
    }
    expect(sawPlayerAttack).toBe(true)
    expect(sawNpcAttack).toBe(true)
  })
})

describe('woodcutting', () => {
  const lumberjack = () => {
    const game = harness()
    game.step([join('p1', 'Bob')])
    game.step([msg('p1', { type: 'takeItem', x: axeSpawn.x, z: axeSpawn.z, itemId: 'bronze_axe' })])
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

describe('fishing and cooking', () => {
  const fishingSpot = GAME_MAP.objects.find((object) => object.kind === 'fishing_spot')!
  const range = GAME_MAP.objects.find((object) => object.kind === 'range')!

  it('refuses to fish without a net', () => {
    const game = harness()
    game.step([join('p1', 'Bob')])
    game.step([msg('p1', { type: 'fish', objectId: fishingSpot.id })])
    game.stepN(40)
    expect(messagesFor(game.events, 'p1')).toContain(
      'You need a small fishing net to catch these fish.',
    )
    expect(game.world.players['p1']!.inventory.every((slot) => slot === null)).toBe(true)
  })

  it('nets shrimps and fishing xp at a fishing spot', () => {
    const game = harness()
    const netSpawn = itemSpawnOf('small_fishing_net')
    game.step([join('p1', 'Bob')])
    game.step([
      msg('p1', { type: 'takeItem', x: netSpawn.x, z: netSpawn.z, itemId: 'small_fishing_net' }),
    ])
    game.stepN(35)
    game.step([msg('p1', { type: 'fish', objectId: fishingSpot.id })])
    game.stepN(40)
    const player = game.world.players['p1']!
    expect(player.inventory.some((slot) => slot?.itemId === 'raw_shrimps')).toBe(true)
    expect(player.skills.fishing).toBeGreaterThanOrEqual(10)
    expect(messagesFor(game.events, 'p1')).toContain('You catch some shrimps.')
  })

  it('burns shrimps on the range at a low cooking level', () => {
    const game = harness()
    const netSpawn = itemSpawnOf('small_fishing_net')
    game.step([join('p1', 'Bob')])
    game.step([
      msg('p1', { type: 'takeItem', x: netSpawn.x, z: netSpawn.z, itemId: 'small_fishing_net' }),
    ])
    game.stepN(35)
    game.step([msg('p1', { type: 'fish', objectId: fishingSpot.id })])
    game.stepN(20)
    game.step([msg('p1', { type: 'cook', objectId: range.id })])
    game.stepN(60)
    const player = game.world.players['p1']!
    expect(player.inventory.some((slot) => slot?.itemId === 'burnt_fish')).toBe(true)
    expect(messagesFor(game.events, 'p1')).toContain('You accidentally burn the shrimps.')
    expect(player.skills.cooking).toBe(0)
  })

  it('hunts a cow, roasts the beef, and eats the meal', () => {
    const game = harness(calmRng({ skill: () => 0.9 }))
    game.step([join('p1', 'Bob')])
    game.step([msg('p1', { type: 'moveTo', x: 120, z: 70 })])
    game.stepN(40)
    const cowSpawn = GAME_MAP.npcSpawns.find((spawn) => spawn.defId === 'cow')!
    game.step([msg('p1', { type: 'attackNpc', npcId: cowSpawn.npcId })])
    game.stepN(90)
    expect(messagesFor(game.events, 'p1')).toContain('You have defeated the Cow.')
    const beef = game.world.groundItems.find((item) => item.itemId === 'raw_beef')!
    expect(beef).toBeDefined()
    game.step([msg('p1', { type: 'takeItem', x: beef.x, z: beef.z, itemId: 'raw_beef' })])
    game.stepN(6)
    game.step([msg('p1', { type: 'moveTo', x: 120, z: 85 })])
    game.stepN(40)
    game.step([msg('p1', { type: 'cook', objectId: range.id })])
    game.stepN(45)
    const player = game.world.players['p1']!
    expect(player.inventory.some((slot) => slot?.itemId === 'cooked_meat')).toBe(true)
    expect(player.inventory.some((slot) => slot?.itemId === 'raw_beef')).toBe(false)
    expect(player.skills.cooking).toBe(30)
    expect(messagesFor(game.events, 'p1')).toContain('You roast a piece of beef.')
    const slot = player.inventory.findIndex((stack) => stack?.itemId === 'cooked_meat')
    const hpBefore = player.hp
    const maxHp = levelForXp(player.skills.hitpoints)
    game.step([msg('p1', { type: 'eatItem', slot })])
    const fed = game.world.players['p1']!
    expect(fed.hp).toBe(Math.min(maxHp, hpBefore + 3))
    expect(fed.inventory.some((stack) => stack?.itemId === 'cooked_meat')).toBe(false)
    expect(messagesFor(game.events, 'p1')).toContain('You eat the cooked meat.')
  })
})

describe('banking', () => {
  const booth = GAME_MAP.objects.find((object) => object.kind === 'bank_booth')!

  const swordOwner = () => {
    const game = harness()
    game.step([join('p1', 'Bob')])
    game.step([
      msg('p1', { type: 'takeItem', x: swordSpawn.x, z: swordSpawn.z, itemId: 'bronze_sword' }),
    ])
    game.stepN(4)
    return game
  }

  it('opens the bank after walking to a booth', () => {
    const game = harness()
    game.step([join('p1', 'Bob')])
    game.step([msg('p1', { type: 'openBank', objectId: booth.id })])
    game.stepN(25)
    expect(game.world.players['p1']!.openInterface).toBe('bank')
    const snapshot = snapshotFor(game.world, 'p1', [], '')!
    expect(snapshot.you.openInterface).toBe('bank')
    expect(snapshot.you.bank).toEqual([])
  })

  it('hides bank contents from the snapshot while the bank is closed', () => {
    const game = harness()
    game.step([join('p1', 'Bob')])
    const snapshot = snapshotFor(game.world, 'p1', [], '')!
    expect(snapshot.you.openInterface).toBeNull()
    expect(snapshot.you.bank).toBeNull()
  })

  it('deposits an item and withdraws it back', () => {
    const game = swordOwner()
    game.step([msg('p1', { type: 'openBank', objectId: booth.id })])
    game.stepN(25)
    game.step([msg('p1', { type: 'depositItem', slot: 0, amount: 1 })])
    let player = game.world.players['p1']!
    expect(player.bank).toEqual([{ itemId: 'bronze_sword', quantity: 1 }])
    expect(player.inventory.every((slot) => slot === null)).toBe(true)
    game.step([msg('p1', { type: 'withdrawItem', bankIndex: 0, amount: 1 })])
    player = game.world.players['p1']!
    expect(player.bank).toEqual([])
    expect(player.inventory[0]).toEqual({ itemId: 'bronze_sword', quantity: 1 })
  })

  it('deposits a whole stack with the all amount', () => {
    const game = harness()
    game.step([join('p1', 'Bob')])
    game.step([msg('p1', { type: 'takeItem', x: coinsSpawn.x, z: coinsSpawn.z, itemId: 'coins' })])
    game.stepN(5)
    game.step([msg('p1', { type: 'openBank', objectId: booth.id })])
    game.stepN(25)
    game.step([msg('p1', { type: 'depositItem', slot: 0, amount: 'all' })])
    const player = game.world.players['p1']!
    expect(player.bank).toEqual([{ itemId: 'coins', quantity: 25 }])
    expect(player.inventory.every((slot) => slot === null)).toBe(true)
  })

  it('clamps withdrawals to what is banked', () => {
    const game = swordOwner()
    game.step([msg('p1', { type: 'openBank', objectId: booth.id })])
    game.stepN(25)
    game.step([msg('p1', { type: 'depositItem', slot: 0, amount: 1 })])
    game.step([msg('p1', { type: 'withdrawItem', bankIndex: 0, amount: 99 })])
    const player = game.world.players['p1']!
    expect(player.bank).toEqual([])
    expect(player.inventory.filter((slot) => slot?.itemId === 'bronze_sword')).toHaveLength(1)
  })

  it('refuses withdrawals that do not fit the inventory', () => {
    const game = harness()
    const netSpawn = itemSpawnOf('small_fishing_net')
    const spot = GAME_MAP.objects.find((object) => object.kind === 'fishing_spot')!
    game.step([join('p1', 'Bob')])
    game.step([
      msg('p1', { type: 'takeItem', x: netSpawn.x, z: netSpawn.z, itemId: 'small_fishing_net' }),
    ])
    game.stepN(35)
    game.step([msg('p1', { type: 'fish', objectId: spot.id })])
    game.stepN(70)
    const shrimpSlot = game.world.players['p1']!.inventory.findIndex(
      (stack) => stack?.itemId === 'raw_shrimps',
    )
    expect(game.world.players['p1']!.inventory.every((slot) => slot !== null)).toBe(true)
    game.step([msg('p1', { type: 'openBank', objectId: booth.id })])
    game.stepN(40)
    game.step([msg('p1', { type: 'depositItem', slot: shrimpSlot, amount: 'all' })])
    expect(game.world.players['p1']!.bank).toEqual([{ itemId: 'raw_shrimps', quantity: 27 }])
    game.step([msg('p1', { type: 'fish', objectId: spot.id })])
    game.stepN(60)
    game.step([msg('p1', { type: 'openBank', objectId: booth.id })])
    game.stepN(40)
    game.step([msg('p1', { type: 'withdrawItem', bankIndex: 0, amount: 'all' })])
    const player = game.world.players['p1']!
    expect(player.bank).toEqual([{ itemId: 'raw_shrimps', quantity: 27 }])
    expect(player.inventory.every((slot) => slot !== null)).toBe(true)
  })

  it('closes the bank when the player walks away and ignores stale deposits', () => {
    const game = swordOwner()
    game.step([msg('p1', { type: 'openBank', objectId: booth.id })])
    game.stepN(25)
    expect(game.world.players['p1']!.openInterface).toBe('bank')
    game.step([msg('p1', { type: 'moveTo', x: SPAWN.x, z: SPAWN.z })])
    expect(game.world.players['p1']!.openInterface).toBeNull()
    game.step([msg('p1', { type: 'depositItem', slot: 0, amount: 1 })])
    const player = game.world.players['p1']!
    expect(player.bank).toEqual([])
    expect(player.inventory[0]).toEqual({ itemId: 'bronze_sword', quantity: 1 })
  })
})

describe('the general store', () => {
  const keeperSpawn = () => GAME_MAP.npcSpawns.find((spawn) => spawn.defId === 'shopkeeper')!

  const shopper = () => {
    const game = harness()
    game.step([join('p1', 'Bob')])
    game.step([msg('p1', { type: 'takeItem', x: coinsSpawn.x, z: coinsSpawn.z, itemId: 'coins' })])
    game.stepN(6)
    game.step([msg('p1', { type: 'openShop', npcId: keeperSpawn().npcId })])
    game.stepN(25)
    return game
  }

  it('opens the shop after walking to the shopkeeper', () => {
    const game = shopper()
    expect(game.world.players['p1']!.openInterface).toBe('shop')
    const snapshot = snapshotFor(game.world, 'p1', [], '')!
    expect(snapshot.you.openInterface).toBe('shop')
    expect(snapshot.you.shop).toContainEqual({ itemId: 'small_fishing_net', quantity: 5 })
  })

  it('buys an item, paying coins and reducing the stock', () => {
    const game = shopper()
    game.step([msg('p1', { type: 'buyItem', itemId: 'small_fishing_net', amount: 1 })])
    const player = game.world.players['p1']!
    expect(player.inventory.some((stack) => stack?.itemId === 'small_fishing_net')).toBe(true)
    expect(player.inventory.find((stack) => stack?.itemId === 'coins')?.quantity).toBe(20)
    expect(game.world.shopStock['small_fishing_net']).toBe(4)
  })

  it('refuses a purchase the player cannot afford', () => {
    const game = shopper()
    game.step([msg('p1', { type: 'buyItem', itemId: 'bronze_sword', amount: 1 })])
    const player = game.world.players['p1']!
    expect(player.inventory.some((stack) => stack?.itemId === 'bronze_sword')).toBe(false)
    expect(player.inventory.find((stack) => stack?.itemId === 'coins')?.quantity).toBe(25)
    expect(messagesFor(game.events, 'p1')).toContain("You don't have enough coins.")
  })

  it('sells an item for 40% of its value and stocks the shelf', () => {
    const game = harness()
    game.step([join('p1', 'Bob')])
    game.step([
      msg('p1', { type: 'takeItem', x: swordSpawn.x, z: swordSpawn.z, itemId: 'bronze_sword' }),
    ])
    game.stepN(4)
    game.step([msg('p1', { type: 'openShop', npcId: keeperSpawn().npcId })])
    game.stepN(25)
    game.step([msg('p1', { type: 'sellItem', slot: 0, amount: 1 })])
    const player = game.world.players['p1']!
    expect(player.inventory.some((stack) => stack?.itemId === 'bronze_sword')).toBe(false)
    expect(player.inventory.find((stack) => stack?.itemId === 'coins')?.quantity).toBe(10)
    expect(game.world.shopStock['bronze_sword']).toBe(4)
  })

  it('regenerates stock toward the baseline over time', () => {
    const game = shopper()
    game.step([msg('p1', { type: 'buyItem', itemId: 'small_fishing_net', amount: 1 })])
    expect(game.world.shopStock['small_fishing_net']).toBe(4)
    game.stepN(26)
    expect(game.world.shopStock['small_fishing_net']).toBe(5)
  })

  it('ignores purchases while the shop is closed', () => {
    const game = harness()
    game.step([join('p1', 'Bob')])
    game.step([msg('p1', { type: 'takeItem', x: coinsSpawn.x, z: coinsSpawn.z, itemId: 'coins' })])
    game.stepN(6)
    game.step([msg('p1', { type: 'buyItem', itemId: 'small_fishing_net', amount: 1 })])
    const player = game.world.players['p1']!
    expect(player.inventory.some((stack) => stack?.itemId === 'small_fishing_net')).toBe(false)
    expect(player.inventory.find((stack) => stack?.itemId === 'coins')?.quantity).toBe(25)
  })
})

describe('snapshots', () => {
  it('shows private inventory only to the owning player but equipment visuals to everyone', () => {
    const game = harness()
    game.step([join('p1', 'Bob'), join('p2', 'Alice')])
    game.step([
      msg('p1', { type: 'takeItem', x: swordSpawn.x, z: swordSpawn.z, itemId: 'bronze_sword' }),
    ])
    game.stepN(3)
    game.step([msg('p1', { type: 'equipItem', slot: 0 })])
    const forP1 = snapshotFor(game.world, 'p1', [], '')!
    const forP2 = snapshotFor(game.world, 'p2', [], '')!
    expect(forP1.you.equipment.weapon).toEqual({ itemId: 'bronze_sword', quantity: 1 })
    expect(forP2.you.equipment.weapon).toBeNull()
    const bobSeenByAlice = forP2.players.find((player) => player.id === 'p1')
    expect(bobSeenByAlice?.equipment.weapon).toBe('bronze_sword')
  })

  it('omits entities beyond view distance but always includes yourself', () => {
    const game = harness()
    game.step([join('p1', 'Bob'), join('p2', 'Alice')])
    const nearby = snapshotFor(game.world, 'p1', [], '')!
    expect(nearby.npcs.some((npc) => npc.id === 'npc_goblin_0')).toBe(true)
    expect(nearby.npcs.some((npc) => npc.defId === 'cow')).toBe(false)
    expect(nearby.players.map((player) => player.id).sort()).toEqual(['p1', 'p2'])
    game.step([msg('p2', { type: 'setRun', enabled: true })])
    game.step([msg('p2', { type: 'moveTo', x: SPAWN.x, z: SPAWN.z + 44 })])
    game.stepN(23)
    const afterRun = snapshotFor(game.world, 'p1', [], '')!
    expect(afterRun.players.map((player) => player.id)).toEqual(['p1'])
    const forP2 = snapshotFor(game.world, 'p2', [], '')!
    expect(forP2.players.map((player) => player.id)).toEqual(['p2'])
  })

  it('filters addressed events so private messages do not leak', () => {
    const game = harness()
    game.step([join('p1', 'Bob'), join('p2', 'Alice')])
    const events: AddressedEvent[] = [
      { audience: 'p1', event: { kind: 'message', text: 'secret' } },
      { audience: 'all', event: { kind: 'chat', playerId: 'p2', name: 'Alice', text: 'hi' } },
    ]
    const forP2 = snapshotFor(game.world, 'p2', events, '')!
    expect(forP2.events).toEqual([{ kind: 'chat', playerId: 'p2', name: 'Alice', text: 'hi' }])
  })
})
