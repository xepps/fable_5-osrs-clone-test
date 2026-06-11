const MAX_LEVEL = 99

const xpTable: readonly number[] = (() => {
  const thresholds = [0]
  let points = 0
  for (let level = 1; level < MAX_LEVEL; level += 1) {
    points += Math.floor(level + 300 * Math.pow(2, level / 7))
    thresholds.push(Math.floor(points / 4))
  }
  return thresholds
})()

export const xpForLevel = (level: number): number => xpTable[level - 1] ?? 0

export const levelForXp = (xp: number): number => {
  const nextLevelIndex = xpTable.findIndex((threshold) => threshold > xp)
  return nextLevelIndex === -1 ? MAX_LEVEL : nextLevelIndex
}
