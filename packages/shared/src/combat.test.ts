import { describe, expect, it } from 'vitest'
import { hitChance, maxHit, rollDamage, type CombatantStats } from './combat'

const statsWith = (overrides: Partial<CombatantStats> = {}): CombatantStats => ({
  attackLevel: 1,
  strengthLevel: 1,
  defenceLevel: 1,
  attackBonus: 0,
  strengthBonus: 0,
  defenceBonus: 0,
  ...overrides,
})

describe('melee max hit', () => {
  it('lets a level 1 attacker hit at most 1', () => {
    expect(maxHit(statsWith())).toBe(1)
  })

  it('scales with strength level', () => {
    expect(maxHit(statsWith({ strengthLevel: 99 }))).toBe(11)
  })

  it('scales with strength bonus from equipment', () => {
    expect(maxHit(statsWith({ strengthLevel: 99, strengthBonus: 64 }))).toBe(21)
  })
})

describe('hit chance', () => {
  it('is even-ish when attacker and defender are evenly matched', () => {
    const chance = hitChance(statsWith(), statsWith())
    expect(chance).toBeGreaterThan(0.4)
    expect(chance).toBeLessThan(0.6)
  })

  it('approaches certainty when the attacker vastly outclasses the defender', () => {
    const chance = hitChance(statsWith({ attackLevel: 99, attackBonus: 100 }), statsWith())
    expect(chance).toBeGreaterThan(0.95)
  })

  it('approaches zero when the defender vastly outclasses the attacker', () => {
    const chance = hitChance(statsWith(), statsWith({ defenceLevel: 99, defenceBonus: 100 }))
    expect(chance).toBeLessThan(0.05)
  })
})

describe('damage roll', () => {
  it('misses (0 damage) when the accuracy roll fails', () => {
    const alwaysMiss = () => 0.999
    expect(rollDamage(statsWith(), statsWith(), alwaysMiss)).toBe(0)
  })

  it('deals up to max hit when the accuracy roll succeeds', () => {
    const alwaysHitMax = () => 0.0001
    const damage = rollDamage(statsWith({ strengthLevel: 99 }), statsWith(), () => 0)
    expect(damage).toBeLessThanOrEqual(11)
    expect(rollDamage(statsWith(), statsWith(), alwaysHitMax)).toBeGreaterThanOrEqual(0)
  })

  it('never exceeds the max hit across many rolls', () => {
    const attacker = statsWith({ strengthLevel: 50, attackLevel: 99, attackBonus: 100 })
    const rolls = Array.from({ length: 200 }, (_, i) =>
      rollDamage(attacker, statsWith(), () => (i % 100) / 100),
    )
    expect(Math.max(...rolls)).toBeLessThanOrEqual(maxHit(attacker))
  })
})
