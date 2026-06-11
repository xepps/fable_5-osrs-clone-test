import { initialState, reduce, type ClientEvent, type ClientState } from './reducer'

export type Store = Readonly<{
  getState: () => ClientState
  dispatch: (event: ClientEvent) => void
  subscribe: (listener: () => void) => () => void
}>

export const createStore = (): Store => {
  let state = initialState
  const listeners = new Set<() => void>()
  return {
    getState: () => state,
    dispatch: (event) => {
      state = reduce(state, event)
      listeners.forEach((listener) => listener())
    },
    subscribe: (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}
