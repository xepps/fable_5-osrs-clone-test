import { useRef, useState, useSyncExternalStore } from 'react'
import {
  createCharacter,
  getSaveBlob,
  listCharacters,
  setSaveBlob,
  touchCharacter,
} from './game/characters'
import { connect, type Connection } from './game/connection'
import { GameView } from './GameView'
import { createStore, type Store } from './store/store'
import { HomeScreen } from './ui/HomeScreen'

const SERVER_URL = `ws://${window.location.hostname}:8080`

export const App = () => {
  const storeRef = useRef<Store | null>(null)
  storeRef.current ??= createStore()
  const store = storeRef.current
  const connectionRef = useRef<Connection | null>(null)
  const state = useSyncExternalStore(store.subscribe, store.getState)
  const [characters, setCharacters] = useState(() => listCharacters(localStorage))

  const login = (login: { name: string; characterId: string; save: string | null }) => {
    connectionRef.current?.close()
    connectionRef.current = connect(SERVER_URL, login, (message) => {
      if (message.type === 'welcome') {
        touchCharacter(localStorage, login.characterId, Date.now())
        store.dispatch({ type: 'welcomed', playerId: message.playerId, name: message.name })
        return
      }
      if (message.type === 'loginRejected') {
        store.dispatch({ type: 'loginRejected', reason: message.reason })
        connectionRef.current?.close()
        return
      }
      setSaveBlob(localStorage, login.characterId, message.save)
      store.dispatch({ type: 'snapshotReceived', snapshot: message, now: Date.now() })
    })
  }

  const createAndPlay = (name: string) => {
    const created = createCharacter(localStorage, name, Date.now())
    setCharacters(listCharacters(localStorage))
    login({ name, characterId: created.id, save: null })
  }

  const selectAndPlay = (characterId: string) => {
    const character = characters.find((candidate) => candidate.id === characterId)
    if (!character) return
    login({
      name: character.name,
      characterId,
      save: getSaveBlob(localStorage, characterId),
    })
  }

  return state.phase === 'home' ? (
    <HomeScreen
      characters={characters}
      error={state.loginError}
      onSelect={selectAndPlay}
      onCreate={createAndPlay}
    />
  ) : (
    <GameView store={store} send={(message) => connectionRef.current?.send(message)} />
  )
}
