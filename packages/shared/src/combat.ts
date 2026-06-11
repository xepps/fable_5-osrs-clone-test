export type CombatantStats = Readonly<{
  attackLevel: number
  strengthLevel: number
  defenceLevel: number
  attackBonus: number
  strengthBonus: number
  defenceBonus: number
}>

const effectiveLevel = (level: number): number => level + 8

export const maxHit = (attacker: CombatantStats): number =>
  Math.floor(0.5 + (effectiveLevel(attacker.strengthLevel) * (attacker.strengthBonus + 64)) / 640)

export const hitChance = (attacker: CombatantStats, defender: CombatantStats): number => {
  const attackRoll = effectiveLevel(attacker.attackLevel) * (attacker.attackBonus + 64)
  const defenceRoll = effectiveLevel(defender.defenceLevel) * (defender.defenceBonus + 64)
  return attackRoll > defenceRoll
    ? 1 - (defenceRoll + 2) / (2 * (attackRoll + 1))
    : attackRoll / (2 * (defenceRoll + 1))
}

export const rollDamage = (
  attacker: CombatantStats,
  defender: CombatantStats,
  rng: () => number,
): number => {
  const hits = rng() < hitChance(attacker, defender)
  return hits ? Math.floor(rng() * (maxHit(attacker) + 1)) : 0
}
