import { z } from 'zod'

const INDEX_KEY = 'osrs.characters'
const saveKeyFor = (characterId: string) => `osrs.save.${characterId}`

const characterSummarySchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  lastPlayedAt: z.number(),
})

const indexSchema = z.array(characterSummarySchema)

export type CharacterSummary = z.infer<typeof characterSummarySchema>

const readIndex = (storage: Storage): CharacterSummary[] => {
  const raw = storage.getItem(INDEX_KEY)
  if (raw === null) return []
  try {
    const parsed = indexSchema.safeParse(JSON.parse(raw))
    return parsed.success ? parsed.data : []
  } catch {
    return []
  }
}

const writeIndex = (storage: Storage, index: readonly CharacterSummary[]) => {
  storage.setItem(INDEX_KEY, JSON.stringify(index))
}

export const listCharacters = (storage: Storage): CharacterSummary[] =>
  [...readIndex(storage)].sort((a, b) => b.lastPlayedAt - a.lastPlayedAt)

export const createCharacter = (storage: Storage, name: string, now: number): CharacterSummary => {
  const created = { id: crypto.randomUUID(), name, lastPlayedAt: now }
  writeIndex(storage, [...readIndex(storage), created])
  return created
}

export const touchCharacter = (storage: Storage, characterId: string, now: number) => {
  writeIndex(
    storage,
    readIndex(storage).map((character) =>
      character.id === characterId ? { ...character, lastPlayedAt: now } : character,
    ),
  )
}

export const getSaveBlob = (storage: Storage, characterId: string): string | null =>
  storage.getItem(saveKeyFor(characterId))

export const setSaveBlob = (storage: Storage, characterId: string, blob: string) => {
  storage.setItem(saveKeyFor(characterId), blob)
}
