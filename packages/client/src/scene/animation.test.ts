import { describe, expect, it } from 'vitest'
import { clipFor, resolveClip } from './animation'

describe('choosing a clip from entity state', () => {
  it('attacks win over everything', () => {
    expect(clipFor({ moving: true, running: true, attacking: true })).toBe('attack')
    expect(clipFor({ moving: false, running: false, attacking: true })).toBe('attack')
  })

  it('runs only when moving at run speed', () => {
    expect(clipFor({ moving: true, running: true, attacking: false })).toBe('run')
    expect(clipFor({ moving: false, running: true, attacking: false })).toBe('idle')
  })

  it('walks when moving and idles otherwise', () => {
    expect(clipFor({ moving: true, running: false, attacking: false })).toBe('walk')
    expect(clipFor({ moving: false, running: false, attacking: false })).toBe('idle')
  })
})

describe('resolving a clip against what an asset offers', () => {
  it('uses the desired clip when available', () => {
    expect(resolveClip(['idle', 'walk', 'run', 'attack'], 'run')).toBe('run')
  })

  it('falls back run to walk to idle', () => {
    expect(resolveClip(['idle', 'walk'], 'run')).toBe('walk')
    expect(resolveClip(['idle'], 'run')).toBe('idle')
    expect(resolveClip(['idle'], 'walk')).toBe('idle')
  })

  it('falls back attack to idle', () => {
    expect(resolveClip(['idle', 'walk'], 'attack')).toBe('idle')
  })

  it('returns null when nothing usable exists', () => {
    expect(resolveClip([], 'idle')).toBeNull()
    expect(resolveClip(['walk'], 'idle')).toBeNull()
  })
})
