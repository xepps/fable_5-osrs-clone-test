import type { ClientMessage, PersistentPlayer } from '@osrs/shared'
import { uniqueName } from './names'

type HelloMessage = Extract<ClientMessage, { type: 'hello' }>

export type LoginDeps = Readonly<{
  namesInUse: readonly string[]
  activeCharacterIds: readonly string[]
  decrypt: (blob: string) => PersistentPlayer | null
  nextPlayerId: () => string
}>

export type LoginResult =
  | Readonly<{
      kind: 'accept'
      playerId: string
      name: string
      savedName: string
      restore: PersistentPlayer | null
    }>
  | Readonly<{ kind: 'reject'; reason: string }>

export const validateSaves = (
  saves: readonly Readonly<{ characterId: string; save: string }>[],
  decryptFor: (characterId: string, save: string) => PersistentPlayer | null,
): readonly Readonly<{ characterId: string; valid: boolean }>[] =>
  saves.map(({ characterId, save }) => ({
    characterId,
    valid: decryptFor(characterId, save) !== null,
  }))

export const loginFor = (hello: HelloMessage, deps: LoginDeps): LoginResult => {
  if (deps.activeCharacterIds.includes(hello.characterId)) {
    return { kind: 'reject', reason: 'That character is already logged in.' }
  }
  if (hello.save === null) {
    const name = uniqueName(hello.name, deps.namesInUse)
    return {
      kind: 'accept',
      playerId: deps.nextPlayerId(),
      name,
      savedName: hello.name,
      restore: null,
    }
  }
  const restore = deps.decrypt(hello.save)
  if (restore === null) {
    return { kind: 'reject', reason: 'Your save data could not be read.' }
  }
  return {
    kind: 'accept',
    playerId: deps.nextPlayerId(),
    name: uniqueName(restore.name, deps.namesInUse),
    savedName: restore.name,
    restore,
  }
}
