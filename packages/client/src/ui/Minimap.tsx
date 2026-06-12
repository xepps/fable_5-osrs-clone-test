import { useEffect, useRef } from 'react'
import { buildingTiles, GAME_MAP, MAP_SIZE, type SnapshotMessage } from '@osrs/shared'
import {
  MINIMAP_SIZE,
  minimapToWorld,
  PX_PER_TILE,
  terrainColor,
  worldToMinimap,
} from '../game/minimap'

type Props = Readonly<{
  snapshot: SnapshotMessage
  selfId: string | null
  onWalkTo: (x: number, z: number) => void
}>

let baseMap: HTMLCanvasElement | null = null

const getBaseMap = (): HTMLCanvasElement => {
  if (baseMap) return baseMap
  const canvas = document.createElement('canvas')
  canvas.width = MAP_SIZE * PX_PER_TILE
  canvas.height = MAP_SIZE * PX_PER_TILE
  const context = canvas.getContext('2d')!
  GAME_MAP.terrain.forEach((row, z) =>
    row.forEach((terrain, x) => {
      context.fillStyle = terrainColor(terrain)
      context.fillRect(x * PX_PER_TILE, z * PX_PER_TILE, PX_PER_TILE, PX_PER_TILE)
    }),
  )
  context.fillStyle = '#23401f'
  GAME_MAP.objects.forEach((object) => {
    context.fillRect(object.x * PX_PER_TILE, object.z * PX_PER_TILE, PX_PER_TILE, PX_PER_TILE)
  })
  context.fillStyle = '#36322a'
  GAME_MAP.buildings.forEach((building) => {
    buildingTiles(building).walls.forEach((wall) => {
      context.fillRect(wall.x * PX_PER_TILE, wall.z * PX_PER_TILE, PX_PER_TILE, PX_PER_TILE)
    })
  })
  baseMap = canvas
  return canvas
}

export const Minimap = ({ snapshot, selfId, onWalkTo }: Props) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const self = snapshot.players.find((player) => player.id === selfId)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !self) return
    const context = canvas.getContext('2d')!
    const centre = { x: self.x, z: self.z }
    context.fillStyle = '#10100c'
    context.fillRect(0, 0, MINIMAP_SIZE, MINIMAP_SIZE)
    context.drawImage(
      getBaseMap(),
      centre.x * PX_PER_TILE - MINIMAP_SIZE / 2,
      centre.z * PX_PER_TILE - MINIMAP_SIZE / 2,
      MINIMAP_SIZE,
      MINIMAP_SIZE,
      0,
      0,
      MINIMAP_SIZE,
      MINIMAP_SIZE,
    )
    const dot = (position: { x: number; z: number }, color: string, size: number) => {
      const point = worldToMinimap(position, centre)
      context.fillStyle = color
      context.fillRect(point.x - size / 2 + 2, point.y - size / 2 + 2, size, size)
    }
    snapshot.groundItems.forEach((item) => dot(item, '#d83a3a', 3))
    snapshot.npcs.filter((npc) => !npc.dead).forEach((npc) => dot(npc, '#e8d44d', 4))
    snapshot.players.forEach((player) => dot(player, '#f4f4f4', 4))
  }, [snapshot, self])

  const handleClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!self) return
    const rect = event.currentTarget.getBoundingClientRect()
    const tile = minimapToWorld(
      { x: event.clientX - rect.left, y: event.clientY - rect.top },
      { x: self.x, z: self.z },
    )
    onWalkTo(tile.x, tile.z)
  }

  return (
    <div className="minimap-frame">
      <canvas
        ref={canvasRef}
        width={MINIMAP_SIZE}
        height={MINIMAP_SIZE}
        role="img"
        aria-label="Minimap"
        onClick={handleClick}
      />
      <span className="minimap-compass" aria-hidden>
        N
      </span>
    </div>
  )
}
