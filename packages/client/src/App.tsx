import { useRef, useSyncExternalStore } from 'react'
import { connect, type Connection } from './game/connection'
import { GameView } from './GameView'
import { createStore, type Store } from './store/store'
import { NamePrompt } from './ui/NamePrompt'

const SERVER_URL = `ws://${window.location.hostname}:8080`

export const App = () => {
  const storeRef = useRef<Store | null>(null)
  storeRef.current ??= createStore()
  const store = storeRef.current
  const connectionRef = useRef<Connection | null>(null)
  const state = useSyncExternalStore(store.subscribe, store.getState)

  const login = (name: string) => {
    connectionRef.current = connect(SERVER_URL, name, (message) => {
      if (message.type === 'welcome') {
        store.dispatch({ type: 'welcomed', playerId: message.playerId, name: message.name })
        return
      }
      store.dispatch({ type: 'snapshotReceived', snapshot: message, now: Date.now() })
    })
  }

  return state.phase === 'naming' ? (
    <NamePrompt onSubmit={login} />
  ) : (
    <GameView store={store} send={(message) => connectionRef.current?.send(message)} />
  )
}
