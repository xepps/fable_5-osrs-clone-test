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

export type SaveValidationResult = Readonly<{ characterId: string; valid: boolean }>

export const validateStoredSaves = (
  url: string,
  saves: readonly Readonly<{ characterId: string; save: string }>[],
): Promise<readonly SaveValidationResult[] | null> =>
  new Promise((resolve) => {
    const socket = new WebSocket(url)
    let settled = false
    const finish = (value: readonly SaveValidationResult[] | null) => {
      if (settled) return
      settled = true
      clearTimeout(timeout)
      socket.close()
      resolve(value)
    }
    const timeout = setTimeout(() => finish(null), 4000)
    socket.onopen = () => socket.send(JSON.stringify({ type: 'validateSaves', saves }))
    socket.onerror = () => finish(null)
    socket.onmessage = (event) => {
      const parsed = serverMessageSchema.safeParse(JSON.parse(String(event.data)))
      if (parsed.success && parsed.data.type === 'savesValidated') {
        finish(parsed.data.results)
      }
    }
  })

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
