import * as THREE from 'three'
import { GAME_MAP, MAP_SIZE, type ItemId } from '@osrs/shared'

const tileShade = (x: number, z: number): number => {
  const hash = Math.sin(x * 374761 + z * 668265) * 43758.5453
  return (hash - Math.floor(hash) - 0.5) * 0.08
}

const TERRAIN_COLORS = {
  grass: new THREE.Color('#4e7c3f'),
  path: new THREE.Color('#9b8458'),
  sand: new THREE.Color('#cbbd8f'),
  water: new THREE.Color('#3f6fb5'),
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

export type TreeView = Readonly<{
  group: THREE.Group
  canopy: THREE.Group
  stump: THREE.Mesh
}>

export const buildTree = (): TreeView => {
  const group = new THREE.Group()
  const trunkMaterial = new THREE.MeshLambertMaterial({ color: '#6b4a2a' })
  const leafMaterial = new THREE.MeshLambertMaterial({ color: '#3a6b2a' })

  const canopy = new THREE.Group()
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.2, 1.1, 6), trunkMaterial)
  trunk.position.y = 0.55
  trunk.castShadow = true
  const lowerLeaves = new THREE.Mesh(new THREE.ConeGeometry(0.95, 1.3, 7), leafMaterial)
  lowerLeaves.position.y = 1.5
  lowerLeaves.castShadow = true
  const upperLeaves = new THREE.Mesh(new THREE.ConeGeometry(0.65, 1.0, 7), leafMaterial)
  upperLeaves.position.y = 2.3
  upperLeaves.castShadow = true
  canopy.add(trunk, lowerLeaves, upperLeaves)

  const stump = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.3, 6), trunkMaterial)
  stump.position.y = 0.15
  stump.visible = false

  group.add(canopy, stump)
  return { group, canopy, stump }
}

export type HumanoidView = Readonly<{
  group: THREE.Group
  leftLeg: THREE.Mesh
  rightLeg: THREE.Mesh
  leftArm: THREE.Mesh
  rightArm: THREE.Mesh
  helmet: THREE.Mesh
  weapon: THREE.Mesh
}>

type HumanoidOptions = Readonly<{
  skinColor: string
  torsoColor: string
  legColor: string
  scale: number
}>

const limb = (width: number, height: number, color: string, x: number, y: number): THREE.Mesh => {
  const geometry = new THREE.BoxGeometry(width, height, width)
  geometry.translate(0, -height / 2, 0)
  const mesh = new THREE.Mesh(geometry, new THREE.MeshLambertMaterial({ color }))
  mesh.position.set(x, y, 0)
  mesh.castShadow = true
  return mesh
}

export const buildHumanoid = (options: HumanoidOptions): HumanoidView => {
  const group = new THREE.Group()
  const leftLeg = limb(0.16, 0.44, options.legColor, -0.12, 0.44)
  const rightLeg = limb(0.16, 0.44, options.legColor, 0.12, 0.44)
  const torso = new THREE.Mesh(
    new THREE.BoxGeometry(0.46, 0.52, 0.26),
    new THREE.MeshLambertMaterial({ color: options.torsoColor }),
  )
  torso.position.y = 0.72
  torso.castShadow = true
  const leftArm = limb(0.12, 0.46, options.torsoColor, -0.31, 0.94)
  const rightArm = limb(0.12, 0.46, options.torsoColor, 0.31, 0.94)
  const head = new THREE.Mesh(
    new THREE.BoxGeometry(0.28, 0.28, 0.26),
    new THREE.MeshLambertMaterial({ color: options.skinColor }),
  )
  head.position.y = 1.14
  head.castShadow = true
  const helmet = new THREE.Mesh(
    new THREE.ConeGeometry(0.23, 0.26, 8),
    new THREE.MeshLambertMaterial({ color: '#9c917c' }),
  )
  helmet.position.y = 1.36
  helmet.visible = false
  const weapon = new THREE.Mesh(
    new THREE.BoxGeometry(0.06, 0.6, 0.06),
    new THREE.MeshLambertMaterial({ color: '#cfcfcf' }),
  )
  weapon.position.set(0.38, 0.75, 0.1)
  weapon.rotation.z = -0.25
  weapon.visible = false
  group.add(leftLeg, rightLeg, torso, leftArm, rightArm, head, helmet, weapon)
  group.scale.setScalar(options.scale)
  return { group, leftLeg, rightLeg, leftArm, rightArm, helmet, weapon }
}

const hueFromId = (id: string): number =>
  [...id].reduce((total, char) => (total * 31 + char.charCodeAt(0)) % 360, 7) / 360

export const playerAppearance = (id: string): HumanoidOptions => {
  const color = new THREE.Color().setHSL(hueFromId(id), 0.45, 0.4)
  return {
    skinColor: '#d2a36c',
    torsoColor: `#${color.getHexString()}`,
    legColor: '#41394f',
    scale: 1,
  }
}

export const npcAppearance = (defId: 'guide' | 'goblin'): HumanoidOptions =>
  defId === 'goblin'
    ? { skinColor: '#6f9a3d', torsoColor: '#7a4a32', legColor: '#5d3b27', scale: 0.78 }
    : { skinColor: '#d2a36c', torsoColor: '#e8e4d8', legColor: '#3f3a33', scale: 1 }

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
}

export const buildGroundItem = (itemId: ItemId): THREE.Mesh => ITEM_MESH_BUILDERS[itemId]()

export const WEAPON_COLORS: Partial<Record<ItemId, string>> = {
  bronze_sword: '#b08d57',
  bronze_axe: '#8a6a3f',
}
