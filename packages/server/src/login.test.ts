import { describe, expect, it } from 'vitest'
import type { PersistentPlayer } from '@osrs/shared'
import { loginFor, type LoginDeps } from './login'

const CHARACTER_ID = '0f5b2c4d-9a3e-4f6b-8c1d-2e3f4a5b6c7d'

const savedPlayer = (name = 'Saved Bob'): PersistentPlayer => ({
  version: 1,
  name,
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
  equipment: { head: null, weapon: null },
  bank: [],
  runEnergy: 100,
})

const deps = (overrides: Partial<LoginDeps> = {}): LoginDeps => ({
  namesInUse: [],
  activeCharacterIds: [],
  decrypt: () => null,
  nextPlayerId: () => 'p1',
  ...overrides,
})

const hello = (save: string | null, name = 'Bob') => ({
  type: 'hello' as const,
  name,
  characterId: CHARACTER_ID,
  save,
})

describe('logging in', () => {
  it('accepts a brand new character with the requested name and no restore', () => {
    const result = loginFor(hello(null), deps())
    expect(result).toEqual({
      kind: 'accept',
      playerId: 'p1',
      name: 'Bob',
      savedName: 'Bob',
      restore: null,
    })
  })

  it('restores a saved character using the saved name, not the hello name', () => {
    const result = loginFor(hello('blob=='), deps({ decrypt: () => savedPlayer() }))
    expect(result).toMatchObject({
      kind: 'accept',
      name: 'Saved Bob',
      savedName: 'Saved Bob',
      restore: savedPlayer(),
    })
  })

  it('uniquifies live name collisions without changing the saved name', () => {
    const result = loginFor(
      hello('blob=='),
      deps({ decrypt: () => savedPlayer(), namesInUse: ['Saved Bob'] }),
    )
    expect(result).toMatchObject({
      kind: 'accept',
      name: 'Saved Bob(2)',
      savedName: 'Saved Bob',
    })
  })

  it('rejects a save that cannot be decrypted', () => {
    const result = loginFor(hello('tampered=='), deps({ decrypt: () => null }))
    expect(result).toEqual({ kind: 'reject', reason: 'Your save data could not be read.' })
  })

  it('rejects a character that is already logged in', () => {
    const result = loginFor(hello(null), deps({ activeCharacterIds: [CHARACTER_ID] }))
    expect(result).toEqual({ kind: 'reject', reason: 'That character is already logged in.' })
  })
})
