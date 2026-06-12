import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import path from 'node:path'

const DEFAULT_CACHE_PATH = '/mnt/c/Users/krist/.runelite/jagexcache/oldschool/LIVE/'
const OUT_DIR = 'packages/client/public/osrs-assets'
const SCALE = 1 / 128
const PARTIAL = process.argv.includes('--partial')

// osrscachereader's git package omits a file and has a decoder typo; heal both so a
// fresh npm install can still run this script.
const selfHealLibrary = async () => {
  const libRoot = 'node_modules/osrscachereader/src'
  const animNames = path.join(libRoot, 'allAnimNames.js')
  if (!existsSync(animNames)) {
    console.log('healing: fetching missing allAnimNames.js')
    const response = await fetch(
      'https://raw.githubusercontent.com/Dezinater/osrscachereader/master/src/allAnimNames.js',
    )
    if (!response.ok) throw new Error('could not fetch allAnimNames.js')
    writeFileSync(animNames, await response.text())
  }
  const decoderPath = path.join(libRoot, 'cacheReader/helpers/EntityOpsDecoder.js')
  const decoder = readFileSync(decoderPath, 'utf8')
  if (decoder.includes('is.readUint8()')) {
    console.log('healing: patching EntityOpsDecoder typo')
    writeFileSync(
      decoderPath,
      decoder.replace(
        'ops[index] = { subID: is.readUint8(), text: is.readString() };',
        'ops[index] = { subID: dataview.readUint8(), text: dataview.readString() };',
      ),
    )
  }
}

const MAN_NPC_ID = 3106
const MAN_ANIMS = { attackAnim: 422, runAnim: 824 }

// Worn equipment is exported once per item: the piece is merged with the player body,
// the body animations are applied to the composed model (so rotation origins match the
// real game), and only the piece's vertex slice is exported. The client overlays the
// animated pieces on the body and plays the same clip on each - any combination of
// equipment composes at runtime instead of needing per-combination exports.
const EQUIP_ASSETS = [
  { key: 'equip.bronze_med_helm', id: 1139, name: 'Bronze med helm' },
  { key: 'equip.bronze_sword', id: 1277, name: 'Bronze sword' },
  { key: 'equip.bronze_axe', id: 1351, name: 'Bronze axe' },
]

const NPC_ASSETS = [
  { key: 'npc.man', id: MAN_NPC_ID, name: 'Man', attackAnim: 422, runAnim: 824 },
  { key: 'npc.goblin', id: 3028, name: 'Goblin', attackAnim: 6184 },
  { key: 'npc.cow', id: 2790, name: 'Cow', attackAnim: 5849 },
  { key: 'npc.banker', id: 1618, name: 'Banker' },
  { key: 'npc.shopkeeper', id: 2813, name: 'Shop keeper' },
  { key: 'npc.fisherman', id: 3934, name: 'Fisherman' },
  { key: 'npc.guide', id: 306, name: 'Lumbridge Guide' },
  { key: 'obj.fishing_spot', id: 1530, name: 'Fishing spot', idleOnly: true },
]

const OBJECT_ASSETS = [
  { key: 'obj.tree', id: 1276, name: 'Tree' },
  { key: 'obj.bank_booth', id: 10355, name: 'Bank booth' },
  { key: 'obj.range', id: 114, name: 'Cooking range' },
  { key: 'obj.campfire', id: 26185, name: 'Fire' },
]

const ITEM_ASSETS = [
  { key: 'item.coins', id: 995, name: 'Coins' },
  { key: 'item.bronze_sword', id: 1277, name: 'Bronze sword' },
  { key: 'item.bronze_med_helm', id: 1139, name: 'Bronze med helm' },
  { key: 'item.bronze_axe', id: 1351, name: 'Bronze axe' },
  { key: 'item.logs', id: 1511, name: 'Logs' },
  { key: 'item.bones', id: 526, name: 'Bones' },
  { key: 'item.small_fishing_net', id: 303, name: 'Small fishing net' },
  { key: 'item.raw_shrimps', id: 317, name: 'Raw shrimps' },
  { key: 'item.shrimps', id: 315, name: 'Shrimps' },
  { key: 'item.raw_beef', id: 2132, name: 'Raw beef' },
  { key: 'item.cooked_meat', id: 2142, name: 'Cooked meat' },
  { key: 'item.burnt_fish', id: 7954, name: 'Burnt shrimp' },
]

await selfHealLibrary()
const { RSCache, IndexType, GLTFExporter, ModelGroup } = await import('osrscachereader')

const cachePath = process.env.CACHE_PATH ?? DEFAULT_CACHE_PATH
console.log(`loading cache from ${cachePath} ...`)
const cache = new RSCache(cachePath)
try {
  await cache.onload
} catch (error) {
  console.warn(`cache onload warning (often harmless): ${String(error).slice(0, 120)}`)
}

mkdirSync(OUT_DIR, { recursive: true })

const summary = []
const failures = []

// The GLTF exporter bakes per-face colors but ignores OSRS textures, leaving textured
// faces white. Substitute a representative flat color (packed RS HSL: h<<10|s<<7|l).
const TEXTURE_COLOR_OVERRIDES = {
  8: (22 << 10) | (5 << 7) | 40, // tree leaves -> leaf green
  60: (22 << 10) | (5 << 7) | 28, // dense leaves -> darker green
  11: (8 << 10) | (4 << 7) | 45, // bank booth planks -> brown
  19: (9 << 10) | (2 << 7) | 70, // fishing net weave -> tan
}
const DEFAULT_TEXTURE_COLOR = (8 << 10) | (2 << 7) | 52

const flattenTexturedFaces = (model) => {
  if (!model.faceTextures) return
  model.faceTextures.forEach((textureId, face) => {
    if (textureId === -1 || textureId === undefined) return
    model.faceColors[face] = TEXTURE_COLOR_OVERRIDES[textureId] ?? DEFAULT_TEXTURE_COLOR
  })
}

// NPC definitions carry recolor tables that turn base models into the NPC's real
// outfit (banker robes, guide colors, ...). Apply them before export.
const applyRecolors = (model, recolor) => {
  if (!recolor || !recolor.find?.length) return
  const replacements = new Map(recolor.find.map((color, index) => [color, recolor.replace[index]]))
  model.faceColors = model.faceColors.map((color) => replacements.get(color) ?? color)
}

const mergeModels = async (modelIds, recolor) => {
  const group = new ModelGroup()
  for (const modelId of modelIds) {
    if (modelId < 0) continue
    const model = await cache.getDef(IndexType.MODELS, modelId)
    applyRecolors(model, recolor)
    flattenTexturedFaces(model)
    group.addModel(model)
  }
  return group.getMergedModel()
}

const boundsOf = (gltfJson) => {
  const gltf = JSON.parse(gltfJson)
  const position = gltf.meshes?.[0]?.primitives?.[0]?.attributes?.POSITION
  if (position === undefined) return 'no-bounds'
  const accessor = gltf.accessors[position]
  return `min=${accessor.min?.map((n) => Math.round(n)).join(',')} max=${accessor.max?.map((n) => Math.round(n)).join(',')}`
}

const exportAsset = async ({ key, modelIds, clips, recolor }) => {
  const merged = await mergeModels(modelIds, recolor)
  const exporter = new GLTFExporter(merged)
  const exportedClips = []
  for (const clip of clips) {
    if (clip.animId === undefined || clip.animId < 0) continue
    const applied = await merged.loadAnimation(cache, clip.animId, false, true)
    const morphs = applied.vertexData.map((frame) => exporter.addMorphTarget(frame))
    exporter.addAnimation(morphs, applied.lengths, undefined, 'LINEAR')
    exportedClips.push(clip.name)
  }
  exporter.addColors(merged)
  const gltf = exporter.export()
  const file = `${key}.gltf`
  writeFileSync(path.join(OUT_DIR, file), gltf)
  const sizeKb = Math.round(statSync(path.join(OUT_DIR, file)).size / 1024)
  summary.push({ key, file, clips: exportedClips.join('+') || '-', sizeKb, bounds: boundsOf(gltf) })
  return { file, clips: exportedClips, scale: SCALE }
}

const tryExport = async (key, fn) => {
  try {
    return await fn()
  } catch (error) {
    failures.push({ key, error: String(error).slice(0, 140) })
    if (!PARTIAL) throw error
    return null
  }
}

const manifest = { version: 1, assets: {} }

const exportWornPiece = async ({ key, itemDef }) => {
  if (itemDef.maleModel0 === undefined || itemDef.maleModel0 < 0) {
    throw new Error(`item ${itemDef.id} has no worn model`)
  }
  const man = await cache.getNPC(MAN_NPC_ID)
  const bodyModel = await mergeModels(man.models)
  const bodyVertexCount = bodyModel.vertexPositionsX.length
  const pieceModel = await cache.getDef(IndexType.MODELS, itemDef.maleModel0)
  flattenTexturedFaces(pieceModel)
  const composedGroup = new ModelGroup()
  composedGroup.addModel(bodyModel)
  composedGroup.addModel(pieceModel)
  const composed = composedGroup.getMergedModel()
  const exporter = new GLTFExporter(pieceModel)
  const clips = [
    { name: 'idle', animId: man.standingAnimation },
    { name: 'walk', animId: man.walkingAnimation },
    { name: 'run', animId: MAN_ANIMS.runAnim },
    { name: 'attack', animId: MAN_ANIMS.attackAnim },
  ]
  const exportedClips = []
  for (const clip of clips) {
    if (clip.animId === undefined || clip.animId < 0) continue
    const applied = await composed.loadAnimation(cache, clip.animId, false, true)
    const morphs = applied.vertexData.map((frame) =>
      exporter.addMorphTarget(frame.slice(bodyVertexCount)),
    )
    exporter.addAnimation(morphs, applied.lengths, undefined, 'LINEAR')
    exportedClips.push(clip.name)
  }
  exporter.addColors(pieceModel)
  const gltf = exporter.export()
  const file = `${key}.gltf`
  writeFileSync(path.join(OUT_DIR, file), gltf)
  const sizeKb = Math.round(statSync(path.join(OUT_DIR, file)).size / 1024)
  summary.push({ key, file, clips: exportedClips.join('+') || '-', sizeKb, bounds: boundsOf(gltf) })
  return { file, clips: exportedClips, scale: SCALE }
}

for (const equip of EQUIP_ASSETS) {
  const entry = await tryExport(equip.key, async () => {
    const def = await cache.getItem(equip.id)
    if (def.name !== equip.name) {
      console.warn(`${equip.key}: id ${equip.id} is named '${def.name}', expected '${equip.name}'`)
    }
    return exportWornPiece({ key: equip.key, itemDef: def })
  })
  if (entry) manifest.assets[equip.key] = entry
}

for (const npc of NPC_ASSETS) {
  const entry = await tryExport(npc.key, async () => {
    const def = await cache.getNPC(npc.id)
    if (def.name !== npc.name) {
      console.warn(`${npc.key}: id ${npc.id} is named '${def.name}', expected '${npc.name}'`)
    }
    if (!def.models?.length) throw new Error(`npc ${npc.id} has no models`)
    const clips = npc.idleOnly
      ? [{ name: 'idle', animId: def.standingAnimation }]
      : [
          { name: 'idle', animId: def.standingAnimation },
          { name: 'walk', animId: def.walkingAnimation },
          { name: 'run', animId: npc.runAnim ?? def.runAnimation },
          { name: 'attack', animId: npc.attackAnim },
        ]
    return exportAsset({
      key: npc.key,
      modelIds: def.models,
      clips,
      recolor: { find: def.recolorToFind ?? [], replace: def.recolorToReplace ?? [] },
    })
  })
  if (entry) manifest.assets[npc.key] = entry
}

for (const object of OBJECT_ASSETS) {
  const entry = await tryExport(object.key, async () => {
    const def = await cache.getObject(object.id)
    if (def.name !== object.name) {
      console.warn(
        `${object.key}: id ${object.id} is named '${def.name}', expected '${object.name}'`,
      )
    }
    if (!def.objectModels?.length) throw new Error(`object ${object.id} has no models`)
    const clips =
      def.animationID !== undefined && def.animationID >= 0
        ? [{ name: 'idle', animId: def.animationID }]
        : []
    return exportAsset({ key: object.key, modelIds: def.objectModels, clips })
  })
  if (entry) manifest.assets[object.key] = entry
}

for (const item of ITEM_ASSETS) {
  const entry = await tryExport(item.key, async () => {
    const def = await cache.getItem(item.id)
    if (def.name !== item.name) {
      console.warn(`${item.key}: id ${item.id} is named '${def.name}', expected '${item.name}'`)
    }
    if (def.inventoryModel === undefined || def.inventoryModel < 0) {
      throw new Error(`item ${item.id} has no inventory model`)
    }
    return exportAsset({ key: item.key, modelIds: [def.inventoryModel], clips: [] })
  })
  if (entry) manifest.assets[item.key] = entry
}

writeFileSync(path.join(OUT_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2))

console.log('\nkey                      clips                  size  bounds')
summary.forEach((row) => {
  console.log(
    `${row.key.padEnd(24)} ${row.clips.padEnd(22)} ${String(row.sizeKb + 'K').padEnd(6)}${row.bounds}`,
  )
})

const expected = NPC_ASSETS.length + OBJECT_ASSETS.length + ITEM_ASSETS.length + EQUIP_ASSETS.length
console.log(`\n${summary.length}/${expected} assets exported to ${OUT_DIR}`)
if (failures.length > 0) {
  console.log('failures:')
  failures.forEach((failure) => console.log(`  ${failure.key}: ${failure.error}`))
}

for (const [key, entry] of Object.entries(manifest.assets)) {
  if (!existsSync(path.join(OUT_DIR, entry.file))) {
    throw new Error(`manifest self-check failed: ${key} -> ${entry.file} missing`)
  }
}
const referenced = new Set(Object.values(manifest.assets).map((entry) => entry.file))
readdirSync(OUT_DIR)
  .filter((file) => file.endsWith('.gltf') && !referenced.has(file))
  .forEach((file) => {
    console.log(`removing stale asset ${file}`)
    rmSync(path.join(OUT_DIR, file))
  })
console.log('manifest self-check passed')
process.exit(failures.length > 0 ? 1 : 0)
