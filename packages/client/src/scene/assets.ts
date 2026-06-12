import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { z } from 'zod'

export const CLIP_NAMES = ['idle', 'walk', 'run', 'attack'] as const

export type ClipName = (typeof CLIP_NAMES)[number]

const assetEntrySchema = z.object({
  file: z.string().min(1),
  clips: z.array(z.enum(CLIP_NAMES)),
  scale: z.number().positive(),
  rotateY: z.number().default(0),
  yOffset: z.number().default(0),
})

const manifestSchema = z.object({
  version: z.literal(1),
  assets: z.record(assetEntrySchema),
})

export type AssetManifest = z.infer<typeof manifestSchema>
export type AssetEntry = z.infer<typeof assetEntrySchema>

export const parseManifest = (json: unknown): AssetManifest | null => {
  const parsed = manifestSchema.safeParse(json)
  return parsed.success ? parsed.data : null
}

export type AssetTemplate = Readonly<{
  scene: THREE.Group
  clips: ReadonlyMap<ClipName, THREE.AnimationClip>
  scale: number
  rotateY: number
  yOffset: number
}>

export type OsrsAssets = ReadonlyMap<string, AssetTemplate>

let meshNameCounter = 0

const nameMeshesDeterministically = (scene: THREE.Object3D) => {
  scene.traverse((node) => {
    if (node.name === '') {
      node.name = `osrs_mesh_${meshNameCounter}`
      meshNameCounter += 1
    }
  })
}

export const loadOsrsAssets = async (baseUrl = '/osrs-assets/'): Promise<OsrsAssets | null> => {
  let manifest: AssetManifest | null = null
  try {
    const response = await fetch(`${baseUrl}manifest.json`)
    if (!response.ok) return null
    manifest = parseManifest(await response.json())
  } catch {
    return null
  }
  if (!manifest) return null
  const loader = new GLTFLoader()
  const templates = new Map<string, AssetTemplate>()
  await Promise.all(
    Object.entries(manifest.assets).map(async ([key, entry]) => {
      try {
        const gltf = await loader.loadAsync(`${baseUrl}${entry.file}`)
        nameMeshesDeterministically(gltf.scene)
        const clips = new Map<ClipName, THREE.AnimationClip>()
        entry.clips.forEach((clipName, index) => {
          const clip = gltf.animations[index]
          if (clip) clips.set(clipName, clip)
        })
        templates.set(key, {
          scene: gltf.scene,
          clips,
          scale: entry.scale,
          rotateY: entry.rotateY,
          yOffset: entry.yOffset,
        })
      } catch (error) {
        console.warn(`osrs-assets: failed to load ${entry.file}`, error)
      }
    }),
  )
  return templates
}

type WornEquipment = Readonly<{ head: string | null; weapon: string | null }>

export const wornAssetKeys = (
  equipment: WornEquipment,
): Readonly<{ head: string | null; weapon: string | null }> => ({
  head: equipment.head ? `equip.${equipment.head}` : null,
  weapon: equipment.weapon ? `equip.${equipment.weapon}` : null,
})

export const instantiateAsset = (template: AssetTemplate): THREE.Group => {
  const model = template.scene.clone(true)
  model.traverse((node) => {
    if (node instanceof THREE.Mesh) {
      node.castShadow = true
      if (Array.isArray(node.morphTargetInfluences)) {
        node.morphTargetInfluences = [...node.morphTargetInfluences]
      }
    }
  })
  const wrapper = new THREE.Group()
  model.scale.setScalar(template.scale)
  model.rotation.y = template.rotateY
  model.position.y = template.yOffset
  wrapper.add(model)
  return wrapper
}
