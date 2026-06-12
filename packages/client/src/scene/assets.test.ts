import { describe, expect, it } from 'vitest'
import { loadOsrsAssets, parseManifest, wornAssetKeys } from './assets'

const validManifest = () => ({
  version: 1,
  assets: {
    'npc.man': {
      file: 'npc.man.gltf',
      clips: ['idle', 'walk', 'run', 'attack'],
      scale: 0.0078125,
      rotateY: 1.5,
      yOffset: 0.1,
    },
    'obj.tree': { file: 'obj.tree.gltf', clips: [], scale: 0.0078125 },
  },
})

describe('parsing the asset manifest', () => {
  it('accepts a valid manifest and defaults rotateY and yOffset to 0', () => {
    const manifest = parseManifest(validManifest())
    expect(manifest).not.toBeNull()
    expect(manifest!.assets['npc.man']).toMatchObject({ rotateY: 1.5, yOffset: 0.1 })
    expect(manifest!.assets['obj.tree']).toMatchObject({ rotateY: 0, yOffset: 0 })
  })

  it('rejects unknown versions', () => {
    expect(parseManifest({ ...validManifest(), version: 2 })).toBeNull()
  })

  it('rejects entries missing a file or with a bad scale', () => {
    const noFile = validManifest()
    delete (noFile.assets['obj.tree'] as Record<string, unknown>)['file']
    expect(parseManifest(noFile)).toBeNull()
    const badScale = validManifest()
    ;(badScale.assets['obj.tree'] as Record<string, unknown>)['scale'] = 'big'
    expect(parseManifest(badScale)).toBeNull()
  })

  it('rejects non-objects and unknown clip names', () => {
    expect(parseManifest(null)).toBeNull()
    expect(parseManifest('manifest')).toBeNull()
    const badClip = validManifest()
    ;(badClip.assets['npc.man'] as { clips: string[] }).clips = ['moonwalk']
    expect(parseManifest(badClip)).toBeNull()
  })
})

describe('worn equipment asset keys', () => {
  it('maps each equipped slot to its animated equip asset', () => {
    expect(wornAssetKeys({ head: 'bronze_med_helm', weapon: 'bronze_sword' })).toEqual({
      head: 'equip.bronze_med_helm',
      weapon: 'equip.bronze_sword',
    })
  })

  it('maps empty slots to null', () => {
    expect(wornAssetKeys({ head: null, weapon: null })).toEqual({ head: null, weapon: null })
    expect(wornAssetKeys({ head: null, weapon: 'bronze_axe' })).toEqual({
      head: null,
      weapon: 'equip.bronze_axe',
    })
  })
})

describe('loading assets', () => {
  it('resolves null when no manifest is being served', async () => {
    expect(await loadOsrsAssets('/definitely-missing-assets/')).toBeNull()
  })
})
