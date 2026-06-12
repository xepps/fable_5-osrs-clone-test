import { describe, expect, it } from 'vitest'
import { clientMessageSchema, persistentPlayerSchema, serverMessageSchema } from './protocol'
import { MAP_SIZE } from './world'

const validPersistentPlayer = () => ({
  version: 1,
  name: 'Zezima',
  position: { x: 96, z: 96 },
  hp: 10,
  skills: {
    attack: 0,
    strength: 0,
    defence: 0,
    hitpoints: 1154,
    woodcutting: 0,
    fishing: 0,
    cooking: 0,
  },
  inventory: Array.from({ length: 28 }, () => null),
  equipment: { head: null, weapon: { itemId: 'bronze_sword', quantity: 1 } },
  bank: [{ itemId: 'coins', quantity: 1000 }],
  runEnergy: 80,
})

describe('persistent player validation', () => {
  it('accepts a complete version 1 payload', () => {
    expect(persistentPlayerSchema.safeParse(validPersistentPlayer()).success).toBe(true)
  })

  it('rejects unknown save versions', () => {
    expect(
      persistentPlayerSchema.safeParse({ ...validPersistentPlayer(), version: 2 }).success,
    ).toBe(false)
  })

  it('rejects an inventory that is not exactly 28 slots', () => {
    expect(
      persistentPlayerSchema.safeParse({
        ...validPersistentPlayer(),
        inventory: Array.from({ length: 27 }, () => null),
      }).success,
    ).toBe(false)
  })

  it('rejects unknown item ids in the bank', () => {
    expect(
      persistentPlayerSchema.safeParse({
        ...validPersistentPlayer(),
        bank: [{ itemId: 'party_hat', quantity: 1 }],
      }).success,
    ).toBe(false)
  })

  it('rejects run energy and positions outside their bounds', () => {
    expect(
      persistentPlayerSchema.safeParse({ ...validPersistentPlayer(), runEnergy: 101 }).success,
    ).toBe(false)
    expect(
      persistentPlayerSchema.safeParse({
        ...validPersistentPlayer(),
        position: { x: MAP_SIZE, z: 0 },
      }).success,
    ).toBe(false)
  })
})

const CHARACTER_ID = '0f5b2c4d-9a3e-4f6b-8c1d-2e3f4a5b6c7d'

describe('client message validation', () => {
  it('accepts a hello with a trimmed display name, character id and optional save', () => {
    const parsed = clientMessageSchema.parse({
      type: 'hello',
      name: '  Zezima  ',
      characterId: CHARACTER_ID,
      save: null,
    })
    expect(parsed).toEqual({
      type: 'hello',
      name: 'Zezima',
      characterId: CHARACTER_ID,
      save: null,
    })
    expect(
      clientMessageSchema.safeParse({
        type: 'hello',
        name: 'Zezima',
        characterId: CHARACTER_ID,
        save: 'b64blob==',
      }).success,
    ).toBe(true)
  })

  it('rejects a hello without a uuid character id', () => {
    expect(
      clientMessageSchema.safeParse({ type: 'hello', name: 'Zezima', save: null }).success,
    ).toBe(false)
    expect(
      clientMessageSchema.safeParse({
        type: 'hello',
        name: 'Zezima',
        characterId: 'not-a-uuid',
        save: null,
      }).success,
    ).toBe(false)
  })

  it('rejects empty or oversized display names', () => {
    expect(
      clientMessageSchema.safeParse({
        type: 'hello',
        name: '   ',
        characterId: CHARACTER_ID,
        save: null,
      }).success,
    ).toBe(false)
    expect(
      clientMessageSchema.safeParse({
        type: 'hello',
        name: 'x'.repeat(13),
        characterId: CHARACTER_ID,
        save: null,
      }).success,
    ).toBe(false)
  })

  it('accepts a move intent within the map and rejects one outside it', () => {
    expect(clientMessageSchema.safeParse({ type: 'moveTo', x: 10, z: MAP_SIZE - 1 }).success).toBe(
      true,
    )
    expect(clientMessageSchema.safeParse({ type: 'moveTo', x: MAP_SIZE, z: 0 }).success).toBe(false)
    expect(clientMessageSchema.safeParse({ type: 'moveTo', x: 1.5, z: 0 }).success).toBe(false)
  })

  it('rejects unknown message types and unknown item ids', () => {
    expect(clientMessageSchema.safeParse({ type: 'hack' }).success).toBe(false)
    expect(
      clientMessageSchema.safeParse({ type: 'takeItem', x: 1, z: 1, itemId: 'party_hat' }).success,
    ).toBe(false)
  })

  it('rejects inventory slots outside 0-27', () => {
    expect(clientMessageSchema.safeParse({ type: 'equipItem', slot: 27 }).success).toBe(true)
    expect(clientMessageSchema.safeParse({ type: 'equipItem', slot: 28 }).success).toBe(false)
    expect(clientMessageSchema.safeParse({ type: 'dropItem', slot: -1 }).success).toBe(false)
  })

  it('accepts fishing, cooking and eating intents', () => {
    expect(
      clientMessageSchema.safeParse({ type: 'fish', objectId: 'fishing_spot_0' }).success,
    ).toBe(true)
    expect(clientMessageSchema.safeParse({ type: 'cook', objectId: 'range_0' }).success).toBe(true)
    expect(clientMessageSchema.safeParse({ type: 'eatItem', slot: 3 }).success).toBe(true)
    expect(clientMessageSchema.safeParse({ type: 'eatItem', slot: 28 }).success).toBe(false)
  })

  it('accepts banking intents', () => {
    expect(
      clientMessageSchema.safeParse({ type: 'openBank', objectId: 'bank_booth_0' }).success,
    ).toBe(true)
    expect(clientMessageSchema.safeParse({ type: 'depositItem', slot: 0, amount: 5 }).success).toBe(
      true,
    )
    expect(
      clientMessageSchema.safeParse({ type: 'depositItem', slot: 0, amount: 'all' }).success,
    ).toBe(true)
    expect(
      clientMessageSchema.safeParse({ type: 'withdrawItem', bankIndex: 2, amount: 'all' }).success,
    ).toBe(true)
    expect(clientMessageSchema.safeParse({ type: 'closeInterface' }).success).toBe(true)
    expect(clientMessageSchema.safeParse({ type: 'depositItem', slot: 0, amount: 0 }).success).toBe(
      false,
    )
  })

  it('accepts shop intents', () => {
    expect(
      clientMessageSchema.safeParse({ type: 'openShop', npcId: 'npc_shopkeeper' }).success,
    ).toBe(true)
    expect(
      clientMessageSchema.safeParse({ type: 'buyItem', itemId: 'bronze_axe', amount: 1 }).success,
    ).toBe(true)
    expect(
      clientMessageSchema.safeParse({ type: 'sellItem', slot: 4, amount: 'all' }).success,
    ).toBe(true)
    expect(
      clientMessageSchema.safeParse({ type: 'buyItem', itemId: 'party_hat', amount: 1 }).success,
    ).toBe(false)
  })

  it('accepts a save validation request', () => {
    expect(
      clientMessageSchema.safeParse({
        type: 'validateSaves',
        saves: [{ characterId: CHARACTER_ID, save: 'blob==' }],
      }).success,
    ).toBe(true)
    expect(
      clientMessageSchema.safeParse({
        type: 'validateSaves',
        saves: [{ characterId: 'not-a-uuid', save: 'blob==' }],
      }).success,
    ).toBe(false)
  })

  it('accepts a run toggle', () => {
    expect(clientMessageSchema.safeParse({ type: 'setRun', enabled: true }).success).toBe(true)
    expect(clientMessageSchema.safeParse({ type: 'setRun', enabled: false }).success).toBe(true)
    expect(clientMessageSchema.safeParse({ type: 'setRun' }).success).toBe(false)
  })

  it('limits chat messages to 80 characters of non-empty text', () => {
    expect(clientMessageSchema.safeParse({ type: 'chat', text: 'hello world' }).success).toBe(true)
    expect(clientMessageSchema.safeParse({ type: 'chat', text: '' }).success).toBe(false)
    expect(clientMessageSchema.safeParse({ type: 'chat', text: 'y'.repeat(81) }).success).toBe(
      false,
    )
  })
})

describe('server message validation', () => {
  it('accepts a welcome message', () => {
    expect(
      serverMessageSchema.safeParse({ type: 'welcome', playerId: 'p1', name: 'Zezima' }).success,
    ).toBe(true)
  })

  it('accepts a login rejection', () => {
    expect(
      serverMessageSchema.safeParse({ type: 'loginRejected', reason: 'Bad save.' }).success,
    ).toBe(true)
  })

  it('accepts save validation results', () => {
    expect(
      serverMessageSchema.safeParse({
        type: 'savesValidated',
        results: [{ characterId: CHARACTER_ID, valid: false }],
      }).success,
    ).toBe(true)
  })

  it('requires snapshots to carry the encrypted save blob', () => {
    const snapshot = {
      type: 'snapshot',
      tick: 1,
      players: [],
      npcs: [],
      groundItems: [],
      depletedObjects: [],
      events: [],
      you: {
        hp: 10,
        inventory: Array.from({ length: 28 }, () => null),
        equipment: { head: null, weapon: null },
        skills: {
          attack: 0,
          strength: 0,
          defence: 0,
          hitpoints: 1154,
          woodcutting: 0,
          fishing: 0,
          cooking: 0,
        },
        runEnergy: 100,
        runEnabled: false,
        openInterface: null,
        bank: null,
        shop: null,
      },
    }
    expect(serverMessageSchema.safeParse(snapshot).success).toBe(false)
    expect(serverMessageSchema.safeParse({ ...snapshot, save: 'blob==' }).success).toBe(true)
  })

  it('accepts a snapshot with players, npcs, items and private state', () => {
    const snapshot = {
      type: 'snapshot',
      tick: 42,
      players: [
        {
          id: 'p1',
          name: 'Zezima',
          x: 32,
          z: 32,
          facing: { dx: 0, dz: 1 },
          hp: 10,
          maxHp: 10,
          overheadText: null,
          equipment: { head: 'bronze_med_helm', weapon: null },
        },
      ],
      npcs: [
        {
          id: 'npc_goblin_0',
          defId: 'goblin',
          x: 12,
          z: 48,
          facing: { dx: 1, dz: 0 },
          hp: 5,
          maxHp: 5,
          dead: false,
        },
      ],
      groundItems: [{ x: 34, z: 30, itemId: 'bronze_sword', quantity: 1 }],
      depletedObjects: ['tree_3'],
      events: [{ kind: 'chat', playerId: 'p1', name: 'Zezima', text: 'hi' }],
      you: {
        hp: 10,
        inventory: Array.from({ length: 28 }, () => null),
        equipment: { head: null, weapon: null },
        skills: {
          attack: 0,
          strength: 0,
          defence: 0,
          hitpoints: 1154,
          woodcutting: 0,
          fishing: 0,
          cooking: 0,
        },
        runEnergy: 100,
        runEnabled: false,
        openInterface: 'bank',
        bank: [{ itemId: 'coins', quantity: 1000 }],
        shop: null,
      },
      save: 'blob==',
    }
    const result = serverMessageSchema.safeParse(snapshot)
    expect(result.success).toBe(true)
  })

  it('accepts an optional attack animation flag on players and npcs', () => {
    const player = {
      id: 'p1',
      name: 'Zezima',
      x: 32,
      z: 32,
      facing: { dx: 0, dz: 1 },
      hp: 10,
      maxHp: 10,
      overheadText: null,
      equipment: { head: null, weapon: null },
      anim: 'attack',
    }
    const base = {
      type: 'snapshot',
      tick: 1,
      npcs: [],
      groundItems: [],
      depletedObjects: [],
      events: [],
      you: {
        hp: 10,
        inventory: Array.from({ length: 28 }, () => null),
        equipment: { head: null, weapon: null },
        skills: {
          attack: 0,
          strength: 0,
          defence: 0,
          hitpoints: 1154,
          woodcutting: 0,
          fishing: 0,
          cooking: 0,
        },
        runEnergy: 100,
        runEnabled: false,
        openInterface: null,
        bank: null,
        shop: null,
      },
      save: 'blob==',
    }
    expect(serverMessageSchema.safeParse({ ...base, players: [player] }).success).toBe(true)
    expect(
      serverMessageSchema.safeParse({ ...base, players: [{ ...player, anim: 'dance' }] }).success,
    ).toBe(false)
  })

  it('rejects run energy outside 0-100', () => {
    const you = {
      hp: 10,
      inventory: Array.from({ length: 28 }, () => null),
      equipment: { head: null, weapon: null },
      skills: {
        attack: 0,
        strength: 0,
        defence: 0,
        hitpoints: 1154,
        woodcutting: 0,
        fishing: 0,
        cooking: 0,
      },
      runEnergy: 101,
      runEnabled: true,
      openInterface: null,
      bank: null,
      shop: null,
    }
    const result = serverMessageSchema.safeParse({
      type: 'snapshot',
      tick: 1,
      players: [],
      npcs: [],
      groundItems: [],
      depletedObjects: [],
      events: [],
      you,
      save: 'blob==',
    })
    expect(result.success).toBe(false)
  })

  it('rejects a snapshot whose inventory is not exactly 28 slots', () => {
    const result = serverMessageSchema.safeParse({
      type: 'snapshot',
      tick: 1,
      players: [],
      npcs: [],
      groundItems: [],
      depletedObjects: [],
      events: [],
      you: {
        hp: 10,
        inventory: [null, null],
        equipment: { head: null, weapon: null },
        skills: {
          attack: 0,
          strength: 0,
          defence: 0,
          hitpoints: 1154,
          woodcutting: 0,
          fishing: 0,
          cooking: 0,
        },
        runEnergy: 100,
        runEnabled: false,
        openInterface: null,
        bank: null,
        shop: null,
      },
      save: 'blob==',
    })
    expect(result.success).toBe(false)
  })
})
