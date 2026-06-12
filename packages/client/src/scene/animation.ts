import type { ClipName } from './assets'

type EntityMotion = Readonly<{
  moving: boolean
  running: boolean
  attacking: boolean
}>

export const clipFor = ({ moving, running, attacking }: EntityMotion): ClipName => {
  if (attacking) return 'attack'
  if (moving && running) return 'run'
  if (moving) return 'walk'
  return 'idle'
}

const FALLBACKS: Record<ClipName, readonly ClipName[]> = {
  idle: ['idle'],
  walk: ['walk', 'idle'],
  run: ['run', 'walk', 'idle'],
  attack: ['attack', 'idle'],
}

export const resolveClip = (available: readonly string[], desired: ClipName): ClipName | null =>
  FALLBACKS[desired].find((clip) => available.includes(clip)) ?? null
