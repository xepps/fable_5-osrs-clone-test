import { describe, expect, it } from 'vitest'
import type { PersistentPlayer } from '@osrs/shared'
import { decryptSave, deriveKey, encryptSave } from './saves'

const SERVER_KEY = 'test-server-key'
const CHARACTER_ID = 'f8b1c0aa-1111-4222-8333-444455556666'

const payload = (): PersistentPlayer => ({
  version: 1,
  name: 'Zezima',
  position: { x: 96, z: 96 },
  hp: 7,
  skills: {
    attack: 100,
    strength: 50,
    defence: 0,
    hitpoints: 1200,
    woodcutting: 25,
    fishing: 10,
    cooking: 30,
  },
  inventory: [{ itemId: 'bronze_sword', quantity: 1 }, ...Array.from({ length: 27 }, () => null)],
  equipment: { head: null, weapon: null },
  bank: [{ itemId: 'coins', quantity: 1000 }],
  runEnergy: 64,
})

describe('per-character key derivation', () => {
  it('is deterministic and 32 bytes long', () => {
    const key = deriveKey(SERVER_KEY, CHARACTER_ID)
    expect(key).toHaveLength(32)
    expect(key.equals(deriveKey(SERVER_KEY, CHARACTER_ID))).toBe(true)
  })

  it('differs between characters and between server keys', () => {
    const key = deriveKey(SERVER_KEY, CHARACTER_ID)
    expect(key.equals(deriveKey(SERVER_KEY, 'another-character'))).toBe(false)
    expect(key.equals(deriveKey('another-server-key', CHARACTER_ID))).toBe(false)
  })
})

describe('save encryption', () => {
  const key = deriveKey(SERVER_KEY, CHARACTER_ID)

  it('round-trips a payload', () => {
    const blob = encryptSave(key, payload())
    expect(decryptSave(key, blob)).toEqual(payload())
  })

  it('produces a stable blob for an injected iv', () => {
    const iv = Buffer.alloc(12, 7)
    expect(encryptSave(key, payload(), iv)).toBe(encryptSave(key, payload(), iv))
  })

  it('rejects a tampered blob', () => {
    const blob = encryptSave(key, payload())
    const index = Math.floor(blob.length / 2)
    const flipped = blob[index] === 'A' ? 'B' : 'A'
    const tampered = blob.slice(0, index) + flipped + blob.slice(index + 1)
    expect(decryptSave(key, tampered)).toBeNull()
  })

  it('rejects a blob encrypted for a different character', () => {
    const blob = encryptSave(deriveKey(SERVER_KEY, 'someone-else'), payload())
    expect(decryptSave(key, blob)).toBeNull()
  })

  it('rejects garbage input', () => {
    expect(decryptSave(key, 'not even base64!!')).toBeNull()
    expect(decryptSave(key, '')).toBeNull()
  })

  it('rejects a valid ciphertext whose contents fail the save schema', () => {
    const blob = encryptSave(key, { hacked: true } as unknown as PersistentPlayer)
    expect(decryptSave(key, blob)).toBeNull()
  })
})
