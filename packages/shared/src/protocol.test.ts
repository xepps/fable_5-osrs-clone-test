import { describe, expect, it } from 'vitest'
import { clientMessageSchema, serverMessageSchema } from './protocol'

describe('client message validation', () => {
  it('accepts a hello with a trimmed display name', () => {
    const parsed = clientMessageSchema.parse({ type: 'hello', name: '  Zezima  ' })
    expect(parsed).toEqual({ type: 'hello', name: 'Zezima' })
  })

  it('rejects empty or oversized display names', () => {
    expect(clientMessageSchema.safeParse({ type: 'hello', name: '   ' }).success).toBe(false)
    expect(clientMessageSchema.safeParse({ type: 'hello', name: 'x'.repeat(13) }).success).toBe(
      false,
    )
  })

  it('accepts a move intent within the chunk and rejects one outside it', () => {
    expect(clientMessageSchema.safeParse({ type: 'moveTo', x: 10, z: 63 }).success).toBe(true)
    expect(clientMessageSchema.safeParse({ type: 'moveTo', x: 64, z: 0 }).success).toBe(false)
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
        skills: { attack: 0, strength: 0, defence: 0, hitpoints: 1154, woodcutting: 0 },
      },
    }
    const result = serverMessageSchema.safeParse(snapshot)
    expect(result.success).toBe(true)
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
        skills: { attack: 0, strength: 0, defence: 0, hitpoints: 1154, woodcutting: 0 },
      },
    })
    expect(result.success).toBe(false)
  })
})
