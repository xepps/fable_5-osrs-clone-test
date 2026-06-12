import { randomUUID } from 'node:crypto'
import { WebSocketServer, type WebSocket } from 'ws'
import { clientMessageSchema, type ServerMessage } from '@osrs/shared'
import { loginFor, validateSaves } from './login'
import { decryptSave, deriveKey, encryptSave } from './saves'
import { snapshotFor } from './sim/snapshot'
import { defaultRng, runTick, type SimIntent } from './sim/tick'
import { createWorld, persistentStateOf } from './sim/world'

const TICK_MILLIS = 600
const PORT = Number(process.env['PORT'] ?? 8080)

const envSaveKey = process.env['SERVER_SAVE_KEY']
const SERVER_SAVE_KEY = envSaveKey ?? '9a0df491-1bba-42f7-a766-5404ccb794f0'
if (!envSaveKey) {
  console.warn(
    'SERVER_SAVE_KEY is not set - using a random key, so saves will not survive a server restart.',
  )
}

type Session = {
  playerId: string
  name: string
  savedName: string
  characterId: string
  key: Buffer
}

const wss = new WebSocketServer({ port: PORT })
const sessions = new Map<WebSocket, Session>()

let world = createWorld()
let pendingIntents: SimIntent[] = []
let nextPlayerNumber = 1

const send = (socket: WebSocket, message: ServerMessage) => {
  if (socket.readyState === socket.OPEN) socket.send(JSON.stringify(message))
}

const namesInUse = () => [...sessions.values()].map((session) => session.name)
const activeCharacterIds = () => [...sessions.values()].map((session) => session.characterId)

wss.on('connection', (socket) => {
  socket.on('message', (raw) => {
    const parsed = clientMessageSchema.safeParse(JSON.parse(String(raw)))
    if (!parsed.success) return
    const message = parsed.data
    const session = sessions.get(socket)
    if (message.type === 'validateSaves') {
      const results = validateSaves(message.saves, (characterId, save) =>
        decryptSave(deriveKey(SERVER_SAVE_KEY, characterId), save),
      )
      send(socket, { type: 'savesValidated', results: [...results] })
      return
    }
    if (message.type === 'hello') {
      if (session) return
      const key = deriveKey(SERVER_SAVE_KEY, message.characterId)
      const result = loginFor(message, {
        namesInUse: namesInUse(),
        activeCharacterIds: activeCharacterIds(),
        decrypt: (blob) => decryptSave(key, blob),
        nextPlayerId: () => {
          const playerId = `p${nextPlayerNumber}`
          nextPlayerNumber += 1
          return playerId
        },
      })
      if (result.kind === 'reject') {
        send(socket, { type: 'loginRejected', reason: result.reason })
        return
      }
      sessions.set(socket, {
        playerId: result.playerId,
        name: result.name,
        savedName: result.savedName,
        characterId: message.characterId,
        key,
      })
      pendingIntents.push({
        kind: 'join',
        playerId: result.playerId,
        name: result.name,
        ...(result.restore ? { restore: result.restore } : {}),
      })
      send(socket, { type: 'welcome', playerId: result.playerId, name: result.name })
      return
    }
    if (!session) return
    pendingIntents.push({ kind: 'message', playerId: session.playerId, message })
  })
  socket.on('close', () => {
    const session = sessions.get(socket)
    if (!session) return
    sessions.delete(socket)
    pendingIntents.push({ kind: 'leave', playerId: session.playerId })
  })
})

setInterval(() => {
  const intents = pendingIntents
  pendingIntents = []
  const result = runTick(world, intents, defaultRng)
  world = result.world
  sessions.forEach((session, socket) => {
    const player = world.players[session.playerId]
    if (!player) return
    const save = encryptSave(session.key, {
      ...persistentStateOf(player),
      name: session.savedName,
    })
    const snapshot = snapshotFor(world, session.playerId, result.events, save)
    if (snapshot) send(socket, snapshot)
  })
}, TICK_MILLIS)

console.log(`game server listening on ws://localhost:${PORT} (tick ${TICK_MILLIS}ms)`)
