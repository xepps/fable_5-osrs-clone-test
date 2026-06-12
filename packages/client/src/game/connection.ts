import { serverMessageSchema, type ClientMessage, type ServerMessage } from '@osrs/shared'

export type Connection = Readonly<{
  send: (message: ClientMessage) => void
  close: () => void
}>

export type LoginRequest = Readonly<{
  name: string
  characterId: string
  save: string | null
}>

export const connect = (
  url: string,
  login: LoginRequest,
  onMessage: (message: ServerMessage) => void,
): Connection => {
  const socket = new WebSocket(url)
  socket.onopen = () =>
    socket.send(
      JSON.stringify({
        type: 'hello',
        name: login.name,
        characterId: login.characterId,
        save: login.save,
      }),
    )
  socket.onmessage = (event) => {
    const parsed = serverMessageSchema.safeParse(JSON.parse(String(event.data)))
    if (parsed.success) onMessage(parsed.data)
  }
  return {
    send: (message) => {
      if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message))
    },
    close: () => socket.close(),
  }
}
