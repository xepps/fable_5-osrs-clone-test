import { MAP_SIZE, samePosition, type Position } from '@osrs/shared'

type Walkable = (position: Position) => boolean

const NEIGHBOUR_ORDER: ReadonlyArray<Readonly<{ dx: number; dz: number }>> = [
  { dx: -1, dz: 0 },
  { dx: 1, dz: 0 },
  { dx: 0, dz: -1 },
  { dx: 0, dz: 1 },
  { dx: -1, dz: -1 },
  { dx: 1, dz: -1 },
  { dx: -1, dz: 1 },
  { dx: 1, dz: 1 },
]

const key = (position: Position): number => position.x + position.z * MAP_SIZE

const canStep = (from: Position, to: Position, walkable: Walkable): boolean => {
  if (!walkable(to)) return false
  const diagonal = to.x !== from.x && to.z !== from.z
  if (!diagonal) return true
  return walkable({ x: to.x, z: from.z }) && walkable({ x: from.x, z: to.z })
}

const reconstruct = (parents: Map<number, Position | null>, end: Position): Position[] => {
  const path: Position[] = []
  let current: Position | null = end
  while (current !== null) {
    path.push(current)
    current = parents.get(key(current)) ?? null
  }
  return path.reverse().slice(1)
}

const MAX_VISITED_TILES = 8192

const bfs = (
  start: Position,
  isGoal: (position: Position) => boolean,
  walkable: Walkable,
): { parents: Map<number, Position | null>; goal: Position | null; visited: Position[] } => {
  const parents = new Map<number, Position | null>([[key(start), null]])
  const visited: Position[] = [start]
  const queue: Position[] = [start]
  if (isGoal(start)) return { parents, goal: start, visited }
  for (let head = 0; head < queue.length && visited.length < MAX_VISITED_TILES; head += 1) {
    const current = queue[head]!
    for (const { dx, dz } of NEIGHBOUR_ORDER) {
      const next = { x: current.x + dx, z: current.z + dz }
      if (next.x < 0 || next.x >= MAP_SIZE || next.z < 0 || next.z >= MAP_SIZE) continue
      if (parents.has(key(next))) continue
      if (!canStep(current, next, walkable)) continue
      parents.set(key(next), current)
      visited.push(next)
      if (isGoal(next)) return { parents, goal: next, visited }
      queue.push(next)
    }
  }
  return { parents, goal: null, visited }
}

export const findPath = (start: Position, target: Position, walkable: Walkable): Position[] => {
  const { parents, goal, visited } = bfs(start, (p) => samePosition(p, target), walkable)
  if (goal) return reconstruct(parents, goal)
  const nearest = visited.reduce((best, candidate) =>
    Math.hypot(candidate.x - target.x, candidate.z - target.z) <
    Math.hypot(best.x - target.x, best.z - target.z)
      ? candidate
      : best,
  )
  return reconstruct(parents, nearest)
}

export const findPathToAdjacent = (
  start: Position,
  target: Position,
  walkable: Walkable,
): Position[] | null => {
  const isGoal = (p: Position) =>
    Math.abs(p.x - target.x) + Math.abs(p.z - target.z) === 1 && walkable(p)
  const { parents, goal } = bfs(start, isGoal, walkable)
  return goal ? reconstruct(parents, goal) : null
}
