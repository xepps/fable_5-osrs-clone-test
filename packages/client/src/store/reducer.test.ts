import { describe, expect, it } from 'vitest'
import type { SnapshotMessage } from '@osrs/shared'
import { initialState, reduce, type ClientState } from './reducer'

const emptySnapshot = (overrides: Partial<SnapshotMessage> = {}): SnapshotMessage => ({
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
    skills: { attack: 0, strength: 0, defence: 0, hitpoints: 1154, woodcutting: 0 },
  },
  ...overrides,
})

const playing = (): ClientState =>
  reduce(initialState, { type: 'welcomed', playerId: 'p1', name: 'Bob' })

describe('login flow', () => {
  it('starts on the naming screen and enters the world once welcomed', () => {
    expect(initialState.phase).toBe('naming')
    const state = playing()
    expect(state.phase).toBe('playing')
    expect(state.playerId).toBe('p1')
    expect(state.displayName).toBe('Bob')
  })
})

describe('receiving snapshots', () => {
  it('stores the latest snapshot', () => {
    const snapshot = emptySnapshot({ tick: 7 })
    const state = reduce(playing(), { type: 'snapshotReceived', snapshot, now: 0 })
    expect(state.snapshot?.tick).toBe(7)
  })

  it('appends chat and system events to the chat log', () => {
    const snapshot = emptySnapshot({
      events: [
        { kind: 'chat', playerId: 'p2', name: 'Alice', text: 'hello' },
        { kind: 'message', text: 'You get some logs.' },
      ],
    })
    const state = reduce(playing(), { type: 'snapshotReceived', snapshot, now: 0 })
    expect(state.chatLog).toEqual([
      { kind: 'chat', text: 'Alice: hello' },
      { kind: 'system', text: 'You get some logs.' },
    ])
  })

  it('opens a dialogue when an npc talks to you', () => {
    const snapshot = emptySnapshot({
      events: [{ kind: 'dialogue', npcName: 'Lumbridge Guide', lines: ['Hello!', 'Bye!'] }],
    })
    const state = reduce(playing(), { type: 'snapshotReceived', snapshot, now: 0 })
    expect(state.dialogue).toEqual({
      npcName: 'Lumbridge Guide',
      lines: ['Hello!', 'Bye!'],
      index: 0,
    })
  })

  it('collects hitsplats with an expiry and drops expired ones', () => {
    const first = reduce(playing(), {
      type: 'snapshotReceived',
      snapshot: emptySnapshot({
        events: [{ kind: 'hitsplat', targetKind: 'npc', targetId: 'npc_goblin_0', damage: 1 }],
      }),
      now: 1000,
    })
    expect(first.hitsplats).toEqual([
      { targetKind: 'npc', targetId: 'npc_goblin_0', damage: 1, expiresAt: 2200 },
    ])
    const later = reduce(first, { type: 'snapshotReceived', snapshot: emptySnapshot(), now: 3000 })
    expect(later.hitsplats).toEqual([])
  })
})

describe('dialogue progression', () => {
  it('advances through the lines and closes after the last one', () => {
    const withDialogue = reduce(playing(), {
      type: 'snapshotReceived',
      snapshot: emptySnapshot({
        events: [{ kind: 'dialogue', npcName: 'Guide', lines: ['One', 'Two'] }],
      }),
      now: 0,
    })
    const advanced = reduce(withDialogue, { type: 'dialogueAdvanced' })
    expect(advanced.dialogue?.index).toBe(1)
    const closed = reduce(advanced, { type: 'dialogueAdvanced' })
    expect(closed.dialogue).toBeNull()
  })
})

describe('context menu and examine', () => {
  it('opens and closes the right-click menu', () => {
    const opened = reduce(playing(), {
      type: 'menuOpened',
      screenX: 100,
      screenY: 50,
      options: [{ label: 'Cancel', action: { type: 'cancel' } }],
    })
    expect(opened.contextMenu?.screenX).toBe(100)
    const closed = reduce(opened, { type: 'menuClosed' })
    expect(closed.contextMenu).toBeNull()
  })

  it('writes examine text into the chat log', () => {
    const state = reduce(playing(), { type: 'examined', text: 'Lovely money!' })
    expect(state.chatLog).toEqual([{ kind: 'system', text: 'Lovely money!' }])
  })
})
