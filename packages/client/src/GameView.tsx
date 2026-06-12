import { useEffect, useRef, useSyncExternalStore } from 'react'
import type { ClientMessage } from '@osrs/shared'
import { menuOptionsFor, type GameAction } from './game/actions'
import { loadOsrsAssets, type OsrsAssets } from './scene/assets'
import { GameScene } from './scene/GameScene'
import type { Store } from './store/store'
import { BankPanel } from './ui/BankPanel'
import { ChatPanel } from './ui/ChatPanel'
import { ContextMenu } from './ui/ContextMenu'
import { DialogueBox } from './ui/DialogueBox'
import { Minimap } from './ui/Minimap'
import { RunOrb } from './ui/RunOrb'
import { ShopPanel } from './ui/ShopPanel'
import { SidePanel } from './ui/SidePanel'

type Props = Readonly<{
  store: Store
  send: (message: ClientMessage) => void
}>

let assetsPromise: Promise<OsrsAssets | null> | null = null

const getAssets = (): Promise<OsrsAssets | null> => {
  assetsPromise ??= loadOsrsAssets()
  return assetsPromise
}

export const GameView = ({ store, send }: Props) => {
  const state = useSyncExternalStore(store.subscribe, store.getState)
  const containerRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<GameScene | null>(null)

  const execute = (action: GameAction) => {
    store.dispatch({ type: 'menuClosed' })
    if (action.type === 'send') send(action.message)
    if (action.type === 'examine') store.dispatch({ type: 'examined', text: action.text })
    if (action.type === 'systemMessage')
      store.dispatch({ type: 'systemMessage', text: action.text })
  }
  const executeRef = useRef(execute)
  executeRef.current = execute

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    let cancelled = false
    let scene: GameScene | null = null
    getAssets().then((assets) => {
      if (cancelled || !containerRef.current) return
      scene = new GameScene(
        containerRef.current,
        {
          onLeftClick: (pick) => {
            if (store.getState().contextMenu) {
              store.dispatch({ type: 'menuClosed' })
              return
            }
            const options = menuOptionsFor(pick.targets, pick.tile)
            const top = options[0]
            if (!top || top.action.type === 'cancel') return
            if (pick.tile)
              scene?.flashMarker(pick.tile, top.label === 'Walk here' ? 'walk' : 'interact')
            executeRef.current(top.action)
          },
          onRightClick: (pick) => {
            store.dispatch({
              type: 'menuOpened',
              screenX: pick.screenX,
              screenY: pick.screenY,
              options: menuOptionsFor(pick.targets, pick.tile),
            })
          },
        },
        assets,
      )
      sceneRef.current = scene
      scene.sync(store.getState())
    })
    return () => {
      cancelled = true
      sceneRef.current = null
      scene?.dispose()
    }
  }, [store])

  useEffect(() => {
    sceneRef.current?.sync(state)
  }, [state])

  return (
    <div className="game-root">
      <div className="scene-container" ref={containerRef} />
      {state.snapshot ? (
        <div className="hud-corner">
          <RunOrb
            runEnergy={state.snapshot.you.runEnergy}
            runEnabled={state.snapshot.you.runEnabled}
            onToggle={() => send({ type: 'setRun', enabled: !state.snapshot!.you.runEnabled })}
          />
          <Minimap
            snapshot={state.snapshot}
            selfId={state.playerId}
            onWalkTo={(x, z) => send({ type: 'moveTo', x, z })}
          />
        </div>
      ) : null}
      {state.snapshot ? (
        <SidePanel
          you={state.snapshot.you}
          onAction={(action) => executeRef.current(action)}
          onOpenMenu={(screenX, screenY, options) =>
            store.dispatch({ type: 'menuOpened', screenX, screenY, options })
          }
        />
      ) : null}
      {state.snapshot?.you.openInterface === 'bank' && state.snapshot.you.bank ? (
        <BankPanel
          bank={state.snapshot.you.bank}
          inventory={state.snapshot.you.inventory}
          onSend={send}
          onClose={() => send({ type: 'closeInterface' })}
        />
      ) : null}
      {state.snapshot?.you.openInterface === 'shop' && state.snapshot.you.shop ? (
        <ShopPanel
          shop={state.snapshot.you.shop}
          inventory={state.snapshot.you.inventory}
          onSend={send}
          onClose={() => send({ type: 'closeInterface' })}
        />
      ) : null}
      <ChatPanel lines={state.chatLog} onSend={(text) => send({ type: 'chat', text })} />
      {state.dialogue ? (
        <DialogueBox
          dialogue={state.dialogue}
          onAdvance={() => store.dispatch({ type: 'dialogueAdvanced' })}
        />
      ) : null}
      {state.contextMenu ? (
        <ContextMenu
          menu={state.contextMenu}
          onSelect={(option) => executeRef.current(option.action)}
        />
      ) : null}
    </div>
  )
}
