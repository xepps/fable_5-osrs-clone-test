import { WebSocketServer, type WebSocket } from 'ws'
import { clientMessageSchema, type ServerMessage } from '@osrs/shared'
import { uniqueName } from './names'
import { snapshotFor } from './sim/snapshot'
import { defaultRng, runTick, type SimIntent } from './sim/tick'
import { createWorld } from './sim/world'

const TICK_MILLIS = 600
const PORT = Number(process.env['PORT'] ?? 8080)

type Session = { playerId: string; name: string }

const wss = new WebSocketServer({ port: PORT })
const sessions = new Map<WebSocket, Session>()

let world = createWorld()
let pendingIntents: SimIntent[] = []
let nextPlayerNumber = 1

const send = (socket: WebSocket, message: ServerMessage) => {
  if (socket.readyState === socket.OPEN) socket.send(JSON.stringify(message))
}

const namesInUse = () => [...sessions.values()].map((session) => session.name)

wss.on('connection', (socket) => {
  socket.on('message', (raw) => {
    const parsed = clientMessageSchema.safeParse(JSON.parse(String(raw)))
    if (!parsed.success) return
    const message = parsed.data
    const session = sessions.get(socket)
    if (message.type === 'hello') {
      if (session) return
      const playerId = `p${nextPlayerNumber}`
      nextPlayerNumber += 1
      const name = uniqueName(message.name, namesInUse())
      sessions.set(socket, { playerId, name })
      pendingIntents.push({ kind: 'join', playerId, name })
      send(socket, { type: 'welcome', playerId, name })
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
    const snapshot = snapshotFor(world, session.playerId, result.events)
    if (snapshot) send(socket, snapshot)
  })
}, TICK_MILLIS)

console.log(`game server listening on ws://localhost:${PORT} (tick ${TICK_MILLIS}ms)`)
