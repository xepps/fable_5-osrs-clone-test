import type { SnapshotMessage } from '@osrs/shared'
import type { MenuOption } from '../game/actions'

export type ChatLine = Readonly<{ kind: 'chat' | 'system'; text: string }>

export type HitsplatFx = Readonly<{
  targetKind: 'player' | 'npc'
  targetId: string
  damage: number
  expiresAt: number
}>

export type ContextMenuState = Readonly<{
  screenX: number
  screenY: number
  options: readonly MenuOption[]
}>

export type DialogueState = Readonly<{ npcName: string; lines: readonly string[]; index: number }>

export type ClientState = Readonly<{
  phase: 'naming' | 'playing'
  playerId: string | null
  displayName: string | null
  snapshot: SnapshotMessage | null
  chatLog: readonly ChatLine[]
  dialogue: DialogueState | null
  contextMenu: ContextMenuState | null
  hitsplats: readonly HitsplatFx[]
}>

export type ClientEvent =
  | Readonly<{ type: 'welcomed'; playerId: string; name: string }>
  | Readonly<{ type: 'snapshotReceived'; snapshot: SnapshotMessage; now: number }>
  | Readonly<{ type: 'examined'; text: string }>
  | Readonly<{ type: 'systemMessage'; text: string }>
  | Readonly<{
      type: 'menuOpened'
      screenX: number
      screenY: number
      options: readonly MenuOption[]
    }>
  | Readonly<{ type: 'menuClosed' }>
  | Readonly<{ type: 'dialogueAdvanced' }>

export const initialState: ClientState = {
  phase: 'naming',
  playerId: null,
  displayName: null,
  snapshot: null,
  chatLog: [],
  dialogue: null,
  contextMenu: null,
  hitsplats: [],
}

const CHAT_LOG_LIMIT = 100
const HITSPLAT_VISIBLE_MILLIS = 1200

const appendChat = (log: readonly ChatLine[], lines: readonly ChatLine[]): readonly ChatLine[] =>
  [...log, ...lines].slice(-CHAT_LOG_LIMIT)

const foldSnapshot = (state: ClientState, snapshot: SnapshotMessage, now: number): ClientState => {
  const newChatLines = snapshot.events.flatMap((event): ChatLine[] => {
    if (event.kind === 'chat') return [{ kind: 'chat', text: `${event.name}: ${event.text}` }]
    if (event.kind === 'message') return [{ kind: 'system', text: event.text }]
    return []
  })
  const dialogueEvent = snapshot.events.find((event) => event.kind === 'dialogue')
  const newHitsplats = snapshot.events.flatMap((event): HitsplatFx[] =>
    event.kind === 'hitsplat'
      ? [
          {
            targetKind: event.targetKind,
            targetId: event.targetId,
            damage: event.damage,
            expiresAt: now + HITSPLAT_VISIBLE_MILLIS,
          },
        ]
      : [],
  )
  return {
    ...state,
    snapshot,
    chatLog: appendChat(state.chatLog, newChatLines),
    dialogue: dialogueEvent
      ? { npcName: dialogueEvent.npcName, lines: dialogueEvent.lines, index: 0 }
      : state.dialogue,
    hitsplats: [...state.hitsplats.filter((hitsplat) => hitsplat.expiresAt > now), ...newHitsplats],
  }
}

export const reduce = (state: ClientState, event: ClientEvent): ClientState => {
  switch (event.type) {
    case 'welcomed':
      return { ...state, phase: 'playing', playerId: event.playerId, displayName: event.name }
    case 'snapshotReceived':
      return foldSnapshot(state, event.snapshot, event.now)
    case 'examined':
    case 'systemMessage':
      return {
        ...state,
        chatLog: appendChat(state.chatLog, [{ kind: 'system', text: event.text }]),
      }
    case 'menuOpened':
      return {
        ...state,
        contextMenu: { screenX: event.screenX, screenY: event.screenY, options: event.options },
      }
    case 'menuClosed':
      return { ...state, contextMenu: null }
    case 'dialogueAdvanced': {
      if (!state.dialogue) return state
      const nextIndex = state.dialogue.index + 1
      return nextIndex >= state.dialogue.lines.length
        ? { ...state, dialogue: null }
        : { ...state, dialogue: { ...state.dialogue, index: nextIndex } }
    }
  }
}
