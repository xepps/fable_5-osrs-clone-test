import { beforeEach, describe, expect, it } from 'vitest'
import {
  createCharacter,
  getSaveBlob,
  listCharacters,
  removeCharacter,
  setSaveBlob,
  touchCharacter,
} from './characters'

beforeEach(() => localStorage.clear())

describe('the character roster', () => {
  it('creates a character with a uuid and lists it', () => {
    const created = createCharacter(localStorage, 'Zezima', 1000)
    expect(created.name).toBe('Zezima')
    expect(created.id).toMatch(/^[0-9a-f-]{36}$/)
    expect(created.lastPlayedAt).toBe(1000)
    expect(listCharacters(localStorage)).toEqual([created])
  })

  it('lists characters most recently played first', () => {
    const older = createCharacter(localStorage, 'First', 1000)
    const newer = createCharacter(localStorage, 'Second', 2000)
    expect(listCharacters(localStorage)).toEqual([newer, older])
  })

  it('bumps last played when a character is touched', () => {
    const first = createCharacter(localStorage, 'First', 1000)
    createCharacter(localStorage, 'Second', 2000)
    touchCharacter(localStorage, first.id, 3000)
    expect(listCharacters(localStorage)[0]).toEqual({ ...first, lastPlayedAt: 3000 })
  })

  it('removes a character together with its save blob', () => {
    const doomed = createCharacter(localStorage, 'Doomed', 1000)
    const keeper = createCharacter(localStorage, 'Keeper', 2000)
    setSaveBlob(localStorage, doomed.id, 'blob-doomed==')
    setSaveBlob(localStorage, keeper.id, 'blob-keeper==')
    removeCharacter(localStorage, doomed.id)
    expect(listCharacters(localStorage)).toEqual([keeper])
    expect(getSaveBlob(localStorage, doomed.id)).toBeNull()
    expect(getSaveBlob(localStorage, keeper.id)).toBe('blob-keeper==')
  })

  it('treats a corrupt index as empty', () => {
    localStorage.setItem('osrs.characters', '{not json')
    expect(listCharacters(localStorage)).toEqual([])
    localStorage.setItem('osrs.characters', JSON.stringify([{ wrong: 'shape' }]))
    expect(listCharacters(localStorage)).toEqual([])
  })
})

describe('save blobs', () => {
  it('has no blob for a brand new character', () => {
    const created = createCharacter(localStorage, 'Zezima', 1000)
    expect(getSaveBlob(localStorage, created.id)).toBeNull()
  })

  it('round-trips a blob keyed by character id', () => {
    const a = createCharacter(localStorage, 'A', 1000)
    const b = createCharacter(localStorage, 'B', 1000)
    setSaveBlob(localStorage, a.id, 'blob-a==')
    setSaveBlob(localStorage, b.id, 'blob-b==')
    expect(getSaveBlob(localStorage, a.id)).toBe('blob-a==')
    expect(getSaveBlob(localStorage, b.id)).toBe('blob-b==')
  })
})
