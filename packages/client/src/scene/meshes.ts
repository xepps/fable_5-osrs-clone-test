import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import {
  buildingTiles,
  GAME_MAP,
  MAP_SIZE,
  type BuildingSpec,
  type ItemId,
  type NpcDefId,
  type WorldObjectKind,
} from '@osrs/shared'

const tileShade = (x: number, z: number): number => {
  const hash = Math.sin(x * 374761 + z * 668265) * 43758.5453
  return (hash - Math.floor(hash) - 0.5) * 0.08
}

const TERRAIN_COLORS = {
  grass: new THREE.Color('#4e7c3f'),
  path: new THREE.Color('#9b8458'),
  sand: new THREE.Color('#cbbd8f'),
  water: new THREE.Color('#3f6fb5'),
  floor_wood: new THREE.Color('#8a6a42'),
  floor_stone: new THREE.Color('#8d8c88'),
}

export const buildTerrain = (): THREE.Mesh => {
  const positions: number[] = []
  const colors: number[] = []
  for (let z = 0; z < MAP_SIZE; z += 1) {
    for (let x = 0; x < MAP_SIZE; x += 1) {
      const terrain = GAME_MAP.terrain[z]![x]!
      const color = TERRAIN_COLORS[terrain].clone()
      color.offsetHSL(0, 0, tileShade(x, z))
      const y = terrain === 'water' ? -0.18 : 0
      const corners = [
        [x, y, z],
        [x + 1, y, z],
        [x + 1, y, z + 1],
        [x, y, z + 1],
      ]
      const quad = [corners[0]!, corners[2]!, corners[1]!, corners[0]!, corners[3]!, corners[2]!]
      quad.forEach(([cx, cy, cz]) => {
        positions.push(cx!, cy!, cz!)
        colors.push(color.r, color.g, color.b)
      })
    }
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  geometry.computeVertexNormals()
  const material = new THREE.MeshLambertMaterial({ vertexColors: true })
  const mesh = new THREE.Mesh(geometry, material)
  mesh.receiveShadow = true
  return mesh
}

export const buildWaterOverlay = (): THREE.Mesh => {
  const positions: number[] = []
  for (let z = 0; z < MAP_SIZE; z += 1) {
    for (let x = 0; x < MAP_SIZE; x += 1) {
      if (GAME_MAP.terrain[z]![x] !== 'water') continue
      const corners = [
        [x, 0, z],
        [x + 1, 0, z],
        [x + 1, 0, z + 1],
        [x, 0, z + 1],
      ]
      const quad = [corners[0]!, corners[2]!, corners[1]!, corners[0]!, corners[3]!, corners[2]!]
      quad.forEach(([cx, cy, cz]) => positions.push(cx!, cy!, cz!))
    }
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.computeVertexNormals()
  const material = new THREE.MeshLambertMaterial({
    color: '#5a8fd0',
    transparent: true,
    opacity: 0.45,
  })
  const mesh = new THREE.Mesh(geometry, material)
  mesh.position.y = -0.1
  return mesh
}

export const buildSmokePuff = (): THREE.Mesh => {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.14, 6, 5),
    new THREE.MeshLambertMaterial({ color: '#c8c4bc', transparent: true, opacity: 0.5 }),
  )
  return mesh
}

export const buildButterfly = (color: string): THREE.Group => {
  const group = new THREE.Group()
  const wingGeometry = new THREE.BoxGeometry(0.12, 0.01, 0.09)
  const material = new THREE.MeshLambertMaterial({ color, side: THREE.DoubleSide })
  const leftWing = new THREE.Mesh(wingGeometry, material)
  leftWing.position.x = -0.06
  const rightWing = new THREE.Mesh(wingGeometry, material)
  rightWing.position.x = 0.06
  group.add(leftWing, rightWing)
  return group
}

const WALL_HEIGHT = 1.9
const DOOR_LINTEL_HEIGHT = 0.45

const WALL_COLORS: Record<BuildingSpec['floor'], string> = {
  wood: '#d8cdb2',
  stone: '#a8a195',
}

export const buildBuilding = (spec: BuildingSpec): THREE.Group => {
  const group = new THREE.Group()
  const { walls } = buildingTiles(spec)
  const wallBoxes = walls.map((tile) => {
    const box = new THREE.BoxGeometry(1, WALL_HEIGHT, 1)
    box.translate(tile.x + 0.5, WALL_HEIGHT / 2, tile.z + 0.5)
    return box
  })
  const lintels = spec.doors.map((door) => {
    const box = new THREE.BoxGeometry(1, DOOR_LINTEL_HEIGHT, 1)
    box.translate(door.x + 0.5, WALL_HEIGHT - DOOR_LINTEL_HEIGHT / 2, door.z + 0.5)
    return box
  })
  const wallGeometry = mergeGeometries([...wallBoxes, ...lintels])
  const wallMesh = new THREE.Mesh(
    wallGeometry,
    new THREE.MeshLambertMaterial({ color: WALL_COLORS[spec.floor] }),
  )
  wallMesh.castShadow = true
  wallMesh.receiveShadow = true
  group.add(wallMesh)
  if (spec.chimney) {
    const chimney = new THREE.Mesh(
      new THREE.BoxGeometry(0.7, 1.4, 0.7),
      new THREE.MeshLambertMaterial({ color: '#7d6a5a' }),
    )
    chimney.position.set(spec.chimney.x + 0.5, WALL_HEIGHT + 0.7, spec.chimney.z + 0.5)
    chimney.castShadow = true
    group.add(chimney)
  }
  return group
}

export type TreeView = Readonly<{
  group: THREE.Group
  canopy: THREE.Group
  stump: THREE.Mesh
}>

const seededRandom = (seed: number) => {
  let state = seed >>> 0 || 1
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 4294967296
  }
}

export const buildStump = (): THREE.Mesh => {
  const stump = new THREE.Mesh(
    new THREE.CylinderGeometry(0.16, 0.2, 0.3, 6),
    new THREE.MeshLambertMaterial({ color: '#6b4a2a' }),
  )
  stump.position.y = 0.15
  return stump
}

export const buildTree = (seed = 0): TreeView => {
  const random = seededRandom(seed)
  const group = new THREE.Group()
  const trunkMaterial = new THREE.MeshLambertMaterial({ color: '#6b4a2a' })

  const canopy = new THREE.Group()
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.22, 1.2, 6), trunkMaterial)
  trunk.position.y = 0.6
  trunk.castShadow = true
  canopy.add(trunk)
  const leafColors = ['#3a6b2a', '#447a30', '#356226']
  const clusters = [
    { x: 0, y: 1.85, z: 0, radius: 0.85 },
    { x: 0.45, y: 1.55, z: 0.25, radius: 0.55 },
    { x: -0.4, y: 1.6, z: -0.2, radius: 0.5 },
    { x: 0.1, y: 1.5, z: -0.45, radius: 0.45 },
  ]
  clusters.forEach((cluster, index) => {
    const leaves = new THREE.Mesh(
      new THREE.SphereGeometry(cluster.radius, 7, 5),
      new THREE.MeshLambertMaterial({ color: leafColors[index % leafColors.length] }),
    )
    leaves.position.set(cluster.x, cluster.y, cluster.z)
    leaves.castShadow = true
    canopy.add(leaves)
  })
  canopy.rotation.y = random() * Math.PI * 2
  const scale = 0.85 + random() * 0.35
  canopy.scale.setScalar(scale)

  const stump = buildStump()
  stump.visible = false

  group.add(canopy, stump)
  return { group, canopy, stump }
}

export type HumanoidView = Readonly<{
  group: THREE.Group
  leftLeg: THREE.Object3D
  rightLeg: THREE.Object3D
  leftArm: THREE.Object3D
  rightArm: THREE.Object3D
  helmet: THREE.Object3D
  hair: THREE.Object3D
  weapon: THREE.Group
  sword: THREE.Object3D
  axe: THREE.Object3D
}>

type HumanoidOptions = Readonly<{
  skinColor: string
  torsoColor: string
  legColor: string
  hairColor?: string
  ears?: boolean
  scale: number
}>

const lambert = (color: string) => new THREE.MeshLambertMaterial({ color })

const legWithBoot = (color: string, x: number): THREE.Group => {
  const pivot = new THREE.Group()
  pivot.position.set(x, 0.5, 0)
  const leg = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.4, 0.16), lambert(color))
  leg.geometry.translate(0, -0.2, 0)
  leg.castShadow = true
  const boot = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.12, 0.24), lambert('#2e2620'))
  boot.position.set(0, -0.44, 0.03)
  boot.castShadow = true
  pivot.add(leg, boot)
  return pivot
}

const armWithHand = (sleeveColor: string, skinColor: string, x: number): THREE.Group => {
  const pivot = new THREE.Group()
  pivot.position.set(x, 0.98, 0)
  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.36, 0.12), lambert(sleeveColor))
  arm.geometry.translate(0, -0.18, 0)
  arm.castShadow = true
  const hand = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.12, 0.13), lambert(skinColor))
  hand.position.y = -0.42
  pivot.add(arm, hand)
  return pivot
}

const buildSwordModel = (): THREE.Group => {
  const sword = new THREE.Group()
  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.5, 0.02), lambert('#c9a86a'))
  blade.position.y = 0.34
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.1, 4), lambert('#c9a86a'))
  tip.position.y = 0.62
  tip.rotation.y = Math.PI / 4
  const crossguard = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.04, 0.05), lambert('#8a6a3f'))
  crossguard.position.y = 0.08
  const handle = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.16, 0.045), lambert('#4a3320'))
  const pommel = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.06, 0.07), lambert('#8a6a3f'))
  pommel.position.y = -0.09
  sword.add(blade, tip, crossguard, handle, pommel)
  return sword
}

const buildAxeModel = (): THREE.Group => {
  const axe = new THREE.Group()
  const handle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.03, 0.035, 0.55, 6),
    lambert('#5d3e22'),
  )
  handle.position.y = 0.18
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.16, 0.04), lambert('#b08d57'))
  head.position.set(0.1, 0.38, 0)
  axe.add(handle, head)
  return axe
}

const buildHelmetModel = (): THREE.Group => {
  const helmet = new THREE.Group()
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(0.19, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2),
    lambert('#b08d57'),
  )
  dome.position.y = 1.16
  const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.05, 8), lambert('#9c7d4a'))
  rim.position.y = 1.16
  const ridge = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.1, 0.3), lambert('#9c7d4a'))
  ridge.position.y = 1.32
  helmet.add(dome, rim, ridge)
  return helmet
}

const buildHair = (color: string): THREE.Group => {
  const hair = new THREE.Group()
  const cap = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.1, 0.28), lambert(color))
  cap.position.y = 1.3
  const back = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.18, 0.07), lambert(color))
  back.position.set(0, 1.2, -0.12)
  const fringe = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.05, 0.05), lambert(color))
  fringe.position.set(0, 1.26, 0.12)
  hair.add(cap, back, fringe)
  return hair
}

export const buildHumanoid = (options: HumanoidOptions): HumanoidView => {
  const group = new THREE.Group()
  const leftLeg = legWithBoot(options.legColor, -0.12)
  const rightLeg = legWithBoot(options.legColor, 0.12)
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.52, 0.26), lambert(options.torsoColor))
  torso.position.y = 0.74
  torso.castShadow = true
  const belt = new THREE.Mesh(new THREE.BoxGeometry(0.47, 0.07, 0.27), lambert('#3a2d1c'))
  belt.position.y = 0.5
  const leftArm = armWithHand(options.torsoColor, options.skinColor, -0.3)
  const rightArm = armWithHand(options.torsoColor, options.skinColor, 0.3)
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.28, 0.26), lambert(options.skinColor))
  head.position.y = 1.16
  head.castShadow = true
  const nose = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.06, 0.04), lambert(options.skinColor))
  nose.position.set(0, 1.13, 0.14)
  const hair = buildHair(options.hairColor ?? '#3b2a1a')
  hair.visible = options.hairColor !== undefined
  const helmet = buildHelmetModel()
  helmet.visible = false
  const ears = new THREE.Group()
  if (options.ears === true) {
    const earGeometry = new THREE.ConeGeometry(0.05, 0.18, 4)
    const leftEar = new THREE.Mesh(earGeometry, lambert(options.skinColor))
    leftEar.position.set(-0.18, 1.24, 0)
    leftEar.rotation.z = 0.6
    const rightEar = new THREE.Mesh(earGeometry, lambert(options.skinColor))
    rightEar.position.set(0.18, 1.24, 0)
    rightEar.rotation.z = -0.6
    ears.add(leftEar, rightEar)
  }
  const sword = buildSwordModel()
  const axe = buildAxeModel()
  const weapon = new THREE.Group()
  weapon.position.set(0.02, -0.44, 0.09)
  weapon.rotation.x = 0.15
  weapon.add(sword, axe)
  weapon.visible = false
  rightArm.add(weapon)
  group.add(leftLeg, rightLeg, torso, belt, leftArm, rightArm, head, nose, hair, helmet, ears)
  group.scale.setScalar(options.scale)
  return { group, leftLeg, rightLeg, leftArm, rightArm, helmet, hair, weapon, sword, axe }
}

const hueFromId = (id: string): number =>
  [...id].reduce((total, char) => (total * 31 + char.charCodeAt(0)) % 360, 7) / 360

const HAIR_COLORS = ['#3b2a1a', '#1f1b16', '#a8742c', '#7a3322', '#5a4a33'] as const

export const playerAppearance = (id: string): HumanoidOptions => {
  const color = new THREE.Color().setHSL(hueFromId(id), 0.45, 0.4)
  const hairIndex = [...id].reduce(
    (total, char) => (total + char.charCodeAt(0)) % HAIR_COLORS.length,
    0,
  )
  return {
    skinColor: '#d2a36c',
    torsoColor: `#${color.getHexString()}`,
    legColor: '#41394f',
    hairColor: HAIR_COLORS[hairIndex] ?? HAIR_COLORS[0],
    scale: 1,
  }
}

export const npcAppearance = (defId: NpcDefId): HumanoidOptions => {
  switch (defId) {
    case 'goblin':
      return {
        skinColor: '#6f9a3d',
        torsoColor: '#7a4a32',
        legColor: '#5d3b27',
        ears: true,
        scale: 0.78,
      }
    case 'fisherman':
      return {
        skinColor: '#d2a36c',
        torsoColor: '#3b6e8f',
        legColor: '#5a4a33',
        hairColor: '#5a4a33',
        scale: 1,
      }
    case 'cow':
      return { skinColor: '#f3efe6', torsoColor: '#f3efe6', legColor: '#4a4137', scale: 1 }
    case 'banker':
      return {
        skinColor: '#d2a36c',
        torsoColor: '#2e3a52',
        legColor: '#23232a',
        hairColor: '#1f1b16',
        scale: 1,
      }
    case 'shopkeeper':
      return {
        skinColor: '#d2a36c',
        torsoColor: '#7d4a8f',
        legColor: '#3f3a33',
        hairColor: '#a8742c',
        scale: 1,
      }
    case 'guide':
      return {
        skinColor: '#d2a36c',
        torsoColor: '#e8e4d8',
        legColor: '#3f3a33',
        hairColor: '#9a9a9a',
        scale: 1,
      }
  }
}

const hiddenAccessory = (): THREE.Mesh => {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.01, 0.01, 0.01),
    new THREE.MeshLambertMaterial(),
  )
  mesh.visible = false
  return mesh
}

export const buildCow = (): HumanoidView => {
  const group = new THREE.Group()
  const hide = new THREE.MeshLambertMaterial({ color: '#f3efe6' })
  const patch = new THREE.MeshLambertMaterial({ color: '#3d362e' })
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 1.0), hide)
  body.position.y = 0.62
  body.castShadow = true
  const patchMesh = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.26, 0.4), patch)
  patchMesh.position.set(0, 0.66, -0.18)
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.32), hide)
  head.position.set(0, 0.84, 0.6)
  head.castShadow = true
  const muzzle = new THREE.Mesh(
    new THREE.BoxGeometry(0.22, 0.14, 0.1),
    new THREE.MeshLambertMaterial({ color: '#d8a8a0' }),
  )
  muzzle.position.set(0, 0.76, 0.78)
  const hornMaterial = new THREE.MeshLambertMaterial({ color: '#e8e2d0' })
  const leftHorn = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.12, 0.06), hornMaterial)
  leftHorn.position.set(-0.16, 1.02, 0.6)
  const rightHorn = leftHorn.clone()
  rightHorn.position.x = 0.16
  const leg = (x: number, z: number) => {
    const geometry = new THREE.BoxGeometry(0.14, 0.4, 0.14)
    geometry.translate(0, -0.2, 0)
    const mesh = new THREE.Mesh(geometry, patch)
    mesh.position.set(x, 0.4, z)
    mesh.castShadow = true
    return mesh
  }
  const leftLeg = leg(-0.16, 0.35)
  const rightLeg = leg(0.16, 0.35)
  const leftArm = leg(-0.16, -0.35)
  const rightArm = leg(0.16, -0.35)
  const helmet = hiddenAccessory()
  const hair = hiddenAccessory()
  const sword = hiddenAccessory()
  const axe = hiddenAccessory()
  const weapon = new THREE.Group()
  weapon.visible = false
  group.add(
    body,
    patchMesh,
    head,
    muzzle,
    leftHorn,
    rightHorn,
    leftLeg,
    rightLeg,
    leftArm,
    rightArm,
    helmet,
    hair,
    weapon,
  )
  return { group, leftLeg, rightLeg, leftArm, rightArm, helmet, hair, weapon, sword, axe }
}

const buildFishingSpot = (): THREE.Group => {
  const group = new THREE.Group()
  const rippleMaterial = new THREE.MeshBasicMaterial({
    color: '#cfe8ff',
    transparent: true,
    opacity: 0.55,
    side: THREE.DoubleSide,
  })
  ;[0.18, 0.3, 0.42].forEach((radius) => {
    const ring = new THREE.Mesh(new THREE.RingGeometry(radius - 0.04, radius, 16), rippleMaterial)
    ring.rotation.x = -Math.PI / 2
    ring.position.y = -0.1
    group.add(ring)
  })
  return group
}

const buildRange = (): THREE.Group => {
  const group = new THREE.Group()
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.9, 0.8, 0.9),
    new THREE.MeshLambertMaterial({ color: '#55524c' }),
  )
  body.position.y = 0.4
  body.castShadow = true
  const top = new THREE.Mesh(
    new THREE.BoxGeometry(0.96, 0.08, 0.96),
    new THREE.MeshLambertMaterial({ color: '#33312d' }),
  )
  top.position.y = 0.84
  const fire = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 0.3, 0.06),
    new THREE.MeshBasicMaterial({ color: '#e8842a' }),
  )
  fire.position.set(0, 0.3, 0.46)
  group.add(body, top, fire)
  return group
}

const buildCampfire = (): THREE.Group => {
  const group = new THREE.Group()
  const logMaterial = new THREE.MeshLambertMaterial({ color: '#5d3e22' })
  const logA = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.7, 6), logMaterial)
  logA.rotation.z = Math.PI / 2
  logA.rotation.y = 0.6
  logA.position.y = 0.08
  const logB = logA.clone()
  logB.rotation.y = -0.7
  const flame = new THREE.Mesh(
    new THREE.ConeGeometry(0.22, 0.5, 7),
    new THREE.MeshBasicMaterial({ color: '#e8842a' }),
  )
  flame.position.y = 0.35
  const innerFlame = new THREE.Mesh(
    new THREE.ConeGeometry(0.12, 0.32, 7),
    new THREE.MeshBasicMaterial({ color: '#ffd166' }),
  )
  innerFlame.position.y = 0.32
  group.add(logA, logB, flame, innerFlame)
  return group
}

const buildBankBooth = (): THREE.Group => {
  const group = new THREE.Group()
  const counter = new THREE.Mesh(
    new THREE.BoxGeometry(0.95, 1.0, 0.95),
    new THREE.MeshLambertMaterial({ color: '#6b4a2a' }),
  )
  counter.position.y = 0.5
  counter.castShadow = true
  const top = new THREE.Mesh(
    new THREE.BoxGeometry(1.0, 0.08, 1.0),
    new THREE.MeshLambertMaterial({ color: '#8d8c88' }),
  )
  top.position.y = 1.04
  const screen = new THREE.Mesh(
    new THREE.BoxGeometry(0.9, 0.5, 0.06),
    new THREE.MeshLambertMaterial({ color: '#9c917c' }),
  )
  screen.position.set(0, 1.33, 0)
  group.add(counter, top, screen)
  return group
}

export const buildWorldObject = (kind: Exclude<WorldObjectKind, 'tree'>): THREE.Group => {
  switch (kind) {
    case 'fishing_spot':
      return buildFishingSpot()
    case 'range':
      return buildRange()
    case 'campfire':
      return buildCampfire()
    case 'bank_booth':
      return buildBankBooth()
  }
}

const ITEM_MESH_BUILDERS: Record<ItemId, () => THREE.Mesh> = {
  coins: () => {
    const mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.14, 0.14, 0.05, 10),
      new THREE.MeshLambertMaterial({ color: '#e6c34a' }),
    )
    mesh.position.y = 0.04
    return mesh
  },
  bronze_sword: () => {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.02, 0.55),
      new THREE.MeshLambertMaterial({ color: '#b08d57' }),
    )
    mesh.position.y = 0.03
    mesh.rotation.y = 0.6
    return mesh
  },
  bronze_med_helm: () => {
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.16, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2),
      new THREE.MeshLambertMaterial({ color: '#b08d57' }),
    )
    mesh.position.y = 0.02
    return mesh
  },
  bronze_axe: () => {
    const group = new THREE.Mesh(
      new THREE.BoxGeometry(0.3, 0.02, 0.18),
      new THREE.MeshLambertMaterial({ color: '#b08d57' }),
    )
    group.position.y = 0.03
    group.rotation.y = -0.4
    return group
  },
  logs: () => {
    const mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.09, 0.09, 0.5, 7),
      new THREE.MeshLambertMaterial({ color: '#7a5230' }),
    )
    mesh.rotation.z = Math.PI / 2
    mesh.position.y = 0.09
    return mesh
  },
  bones: () => {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.32, 0.04, 0.1),
      new THREE.MeshLambertMaterial({ color: '#e8e2d0' }),
    )
    mesh.position.y = 0.03
    mesh.rotation.y = 0.9
    return mesh
  },
  small_fishing_net: () => {
    const mesh = new THREE.Mesh(
      new THREE.ConeGeometry(0.16, 0.22, 8, 1, true),
      new THREE.MeshLambertMaterial({ color: '#b8ad8d', side: THREE.DoubleSide }),
    )
    mesh.position.y = 0.11
    mesh.rotation.x = Math.PI
    return mesh
  },
  raw_shrimps: () => {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.22, 0.04, 0.14),
      new THREE.MeshLambertMaterial({ color: '#d9a0a0' }),
    )
    mesh.position.y = 0.03
    mesh.rotation.y = 0.4
    return mesh
  },
  shrimps: () => {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.22, 0.04, 0.14),
      new THREE.MeshLambertMaterial({ color: '#e8845a' }),
    )
    mesh.position.y = 0.03
    mesh.rotation.y = 0.4
    return mesh
  },
  raw_beef: () => {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.2, 0.06, 0.16),
      new THREE.MeshLambertMaterial({ color: '#c46a6a' }),
    )
    mesh.position.y = 0.04
    return mesh
  },
  cooked_meat: () => {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.2, 0.06, 0.16),
      new THREE.MeshLambertMaterial({ color: '#8a4f35' }),
    )
    mesh.position.y = 0.04
    return mesh
  },
  burnt_fish: () => {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.22, 0.04, 0.14),
      new THREE.MeshLambertMaterial({ color: '#3a3a3a' }),
    )
    mesh.position.y = 0.03
    return mesh
  },
}

export const buildGroundItem = (itemId: ItemId): THREE.Mesh => ITEM_MESH_BUILDERS[itemId]()
