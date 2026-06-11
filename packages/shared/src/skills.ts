import { xpForLevel } from './xp'

export const SKILLS = ['attack', 'strength', 'defence', 'hitpoints', 'woodcutting'] as const

export type Skill = (typeof SKILLS)[number]

export type SkillXp = Readonly<Record<Skill, number>>

export const initialSkillXp = (): SkillXp => ({
  attack: 0,
  strength: 0,
  defence: 0,
  hitpoints: xpForLevel(10),
  woodcutting: 0,
})
