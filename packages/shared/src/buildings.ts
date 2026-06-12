import type { Position } from './position'

export type BuildingFloor = 'wood' | 'stone'

export type BuildingSpec = Readonly<{
  id: string
  x: number
  z: number
  width: number
  depth: number
  doors: readonly Position[]
  floor: BuildingFloor
  chimney?: Position
}>

export type BuildingTiles = Readonly<{
  walls: readonly Position[]
  floors: readonly Position[]
}>

export const buildingTiles = (spec: BuildingSpec): BuildingTiles => {
  const isDoor = (tile: Position) =>
    spec.doors.some((door) => door.x === tile.x && door.z === tile.z)
  const onPerimeter = (tile: Position) =>
    tile.x === spec.x ||
    tile.x === spec.x + spec.width - 1 ||
    tile.z === spec.z ||
    tile.z === spec.z + spec.depth - 1
  const footprint = Array.from({ length: spec.depth }, (_, dz) =>
    Array.from({ length: spec.width }, (_, dx) => ({ x: spec.x + dx, z: spec.z + dz })),
  ).flat()
  return {
    walls: footprint.filter((tile) => onPerimeter(tile) && !isDoor(tile)),
    floors: footprint.filter((tile) => !onPerimeter(tile) || isDoor(tile)),
  }
}
