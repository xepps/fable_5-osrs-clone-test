export type Position = Readonly<{ x: number; z: number }>

export const samePosition = (a: Position, b: Position): boolean => a.x === b.x && a.z === b.z

export const chebyshevDistance = (a: Position, b: Position): number =>
  Math.max(Math.abs(a.x - b.x), Math.abs(a.z - b.z))

export const isAdjacent = (a: Position, b: Position): boolean =>
  !samePosition(a, b) && chebyshevDistance(a, b) === 1
