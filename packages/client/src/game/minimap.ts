import { MAP_SIZE, type Position, type Terrain } from '@osrs/shared'

export const MINIMAP_SIZE = 152
export const PX_PER_TILE = 4

export type MinimapPoint = Readonly<{ x: number; y: number }>

export const worldToMinimap = (position: Position, centre: Position): MinimapPoint => ({
  x: MINIMAP_SIZE / 2 + (position.x - centre.x) * PX_PER_TILE,
  y: MINIMAP_SIZE / 2 + (position.z - centre.z) * PX_PER_TILE,
})

const clampToMap = (value: number): number => Math.min(MAP_SIZE - 1, Math.max(0, value))

export const minimapToWorld = (point: MinimapPoint, centre: Position): Position => ({
  x: clampToMap(Math.round(centre.x + (point.x - MINIMAP_SIZE / 2) / PX_PER_TILE)),
  z: clampToMap(Math.round(centre.z + (point.y - MINIMAP_SIZE / 2) / PX_PER_TILE)),
})

const TERRAIN_COLORS: Record<Terrain, string> = {
  grass: '#4a7a3c',
  path: '#9b8458',
  sand: '#cbbd8f',
  water: '#3f6fb5',
  floor_wood: '#8a6a42',
  floor_stone: '#8d8c88',
}

export const terrainColor = (terrain: Terrain): string => TERRAIN_COLORS[terrain]
