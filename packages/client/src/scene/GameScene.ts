import * as THREE from 'three'
import { GAME_MAP, ITEMS, MAP_SIZE, NPCS, type ItemId, type SnapshotMessage } from '@osrs/shared'
import type { PickTarget } from '../game/actions'
import type { ClientState, HitsplatFx } from '../store/reducer'
import {
  buildGroundItem,
  buildHumanoid,
  buildTerrain,
  buildTree,
  npcAppearance,
  playerAppearance,
  WEAPON_COLORS,
  type HumanoidView,
  type TreeView,
} from './meshes'

export type PickResult = Readonly<{
  targets: PickTarget[]
  tile: Readonly<{ x: number; z: number }> | null
  screenX: number
  screenY: number
}>

export type SceneCallbacks = Readonly<{
  onLeftClick: (pick: PickResult) => void
  onRightClick: (pick: PickResult) => void
}>

type EntityView = {
  view: HumanoidView
  from: THREE.Vector3
  to: THREE.Vector3
  moveStartedAt: number
  targetYaw: number
  labels: { overhead: HTMLDivElement; hpBar: HTMLDivElement; hpFill: HTMLDivElement }
  height: number
  visible: boolean
  hp: number
  maxHp: number
}

const TICK_MILLIS = 600
const CAMERA_LIMITS = { minRadius: 6, maxRadius: 26, minPolar: 0.35, maxPolar: 1.25 }

const overheadLabel = (parent: HTMLElement, className: string): HTMLDivElement => {
  const element = document.createElement('div')
  element.className = className
  element.style.display = 'none'
  parent.appendChild(element)
  return element
}

export class GameScene {
  private readonly renderer: THREE.WebGLRenderer
  private readonly scene = new THREE.Scene()
  private readonly camera: THREE.PerspectiveCamera
  private readonly raycaster = new THREE.Raycaster()
  private readonly container: HTMLElement
  private readonly overlay: HTMLDivElement
  private readonly terrain: THREE.Mesh
  private readonly trees = new Map<string, TreeView>()
  private readonly entities = new Map<string, EntityView>()
  private readonly groundItems = new Map<string, THREE.Mesh>()
  private readonly hitsplatElements = new Map<string, HTMLDivElement>()
  private readonly marker: THREE.Group
  private markerShownAt = 0
  private selfId: string | null = null
  private cameraAzimuth = Math.PI
  private cameraPolar = 0.85
  private cameraRadius = 13
  private animationFrame = 0
  private disposed = false
  private hitsplats: readonly HitsplatFx[] = []

  constructor(
    container: HTMLElement,
    private readonly callbacks: SceneCallbacks,
  ) {
    this.container = container
    this.renderer = new THREE.WebGLRenderer({ antialias: true })
    this.renderer.shadowMap.enabled = true
    this.renderer.setPixelRatio(window.devicePixelRatio)
    container.appendChild(this.renderer.domElement)

    this.overlay = document.createElement('div')
    this.overlay.className = 'scene-overlay'
    container.appendChild(this.overlay)

    this.camera = new THREE.PerspectiveCamera(50, 1, 0.1, 200)
    this.scene.background = new THREE.Color('#87b3d6')
    this.scene.fog = new THREE.Fog('#87b3d6', 40, 90)

    const hemisphere = new THREE.HemisphereLight('#cfe5ff', '#4a5a36', 0.9)
    const sun = new THREE.DirectionalLight('#fff3d6', 1.6)
    sun.position.set(40, 60, 20)
    sun.castShadow = true
    sun.shadow.camera.left = -40
    sun.shadow.camera.right = 40
    sun.shadow.camera.top = 40
    sun.shadow.camera.bottom = -40
    sun.shadow.mapSize.set(2048, 2048)
    sun.target.position.set(32, 0, 32)
    this.scene.add(hemisphere, sun, sun.target)

    this.terrain = buildTerrain()
    this.scene.add(this.terrain)

    GAME_MAP.objects.forEach((object) => {
      const tree = buildTree()
      tree.group.position.set(object.x + 0.5, 0, object.z + 0.5)
      tree.group.userData['pickTarget'] = {
        kind: 'tree',
        objectId: object.id,
        name: object.name,
        examine: object.examine,
      } satisfies PickTarget
      this.trees.set(object.id, tree)
      this.scene.add(tree.group)
    })

    this.marker = this.buildMarker()
    this.scene.add(this.marker)

    this.bindInput()
    this.resize()
    window.addEventListener('resize', this.resize)
    this.exposeDebugHook()
    this.loop()
  }

  private screenCentreOf(object: THREE.Object3D): { x: number; y: number } | null {
    const centre = new THREE.Box3().setFromObject(object).getCenter(new THREE.Vector3())
    return this.projectToScreen(centre)
  }

  private exposeDebugHook() {
    const debugWindow = window as { __osrsDebug?: unknown }
    debugWindow.__osrsDebug = {
      tile: (x: number, z: number) =>
        this.projectToScreen(new THREE.Vector3(x + 0.5, 0.05, z + 0.5)),
      entity: (id: string) => {
        const entity = this.entities.get(id)
        return entity && entity.visible ? this.screenCentreOf(entity.view.group) : null
      },
      groundItem: (x: number, z: number, itemId: string) => {
        const mesh = this.groundItems.get(`${x},${z},${itemId}`)
        return mesh ? this.screenCentreOf(mesh) : null
      },
      tree: (id: string) => {
        const tree = this.trees.get(id)
        return tree ? this.screenCentreOf(tree.stump.visible ? tree.stump : tree.canopy) : null
      },
      self: () => {
        const entity = this.selfId ? this.entities.get(this.selfId) : undefined
        if (!entity) return null
        const { x, z } = entity.view.group.position
        return { x: Math.floor(x), z: Math.floor(z) }
      },
    }
  }

  private buildMarker(): THREE.Group {
    const group = new THREE.Group()
    const material = new THREE.MeshBasicMaterial({ color: '#ffd900', transparent: true })
    const a = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.02, 0.08), material)
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.02, 0.5), material)
    group.add(a, b)
    group.visible = false
    return group
  }

  flashMarker(tile: Readonly<{ x: number; z: number }>, kind: 'walk' | 'interact') {
    const material = (this.marker.children[0] as THREE.Mesh).material as THREE.MeshBasicMaterial
    material.color.set(kind === 'walk' ? '#ffd900' : '#d83a3a')
    ;(this.marker.children[1] as THREE.Mesh).material = material
    this.marker.position.set(tile.x + 0.5, 0.03, tile.z + 0.5)
    this.marker.visible = true
    this.markerShownAt = performance.now()
  }

  private readonly resize = () => {
    const width = this.container.clientWidth
    const height = this.container.clientHeight
    this.renderer.setSize(width, height)
    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()
  }

  private bindInput() {
    const dom = this.renderer.domElement
    let rotating = false
    dom.addEventListener('pointerdown', (event) => {
      if (event.button === 1) {
        rotating = true
        event.preventDefault()
      }
    })
    window.addEventListener('pointerup', () => {
      rotating = false
    })
    window.addEventListener('pointermove', (event) => {
      if (!rotating) return
      this.cameraAzimuth -= event.movementX * 0.006
      this.cameraPolar = THREE.MathUtils.clamp(
        this.cameraPolar - event.movementY * 0.004,
        CAMERA_LIMITS.minPolar,
        CAMERA_LIMITS.maxPolar,
      )
    })
    dom.addEventListener('wheel', (event) => {
      event.preventDefault()
      this.cameraRadius = THREE.MathUtils.clamp(
        this.cameraRadius + event.deltaY * 0.01,
        CAMERA_LIMITS.minRadius,
        CAMERA_LIMITS.maxRadius,
      )
    })
    window.addEventListener('keydown', (event) => {
      if (event.target instanceof HTMLInputElement) return
      if (event.key === 'ArrowLeft') this.cameraAzimuth += 0.08
      if (event.key === 'ArrowRight') this.cameraAzimuth -= 0.08
      if (event.key === 'ArrowUp')
        this.cameraPolar = Math.max(CAMERA_LIMITS.minPolar, this.cameraPolar - 0.05)
      if (event.key === 'ArrowDown')
        this.cameraPolar = Math.min(CAMERA_LIMITS.maxPolar, this.cameraPolar + 0.05)
    })
    dom.addEventListener('click', (event) => {
      this.callbacks.onLeftClick(this.pick(event))
    })
    dom.addEventListener('contextmenu', (event) => {
      event.preventDefault()
      this.callbacks.onRightClick(this.pick(event))
    })
  }

  private pick(event: MouseEvent): PickResult {
    const rect = this.renderer.domElement.getBoundingClientRect()
    const ndc = new THREE.Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    )
    this.raycaster.setFromCamera(ndc, this.camera)
    const pickables: THREE.Object3D[] = [this.terrain]
    this.trees.forEach((tree) => pickables.push(tree.group))
    this.entities.forEach((entity) => {
      if (entity.visible) pickables.push(entity.view.group)
    })
    this.groundItems.forEach((mesh) => pickables.push(mesh))
    const intersections = this.raycaster.intersectObjects(pickables, true)
    const targets: PickTarget[] = []
    const seen = new Set<unknown>()
    let tile: { x: number; z: number } | null = null
    intersections.forEach((intersection) => {
      let object: THREE.Object3D | null = intersection.object
      while (object && object.userData['pickTarget'] === undefined) object = object.parent
      const target = object?.userData['pickTarget'] as PickTarget | undefined
      if (target && !seen.has(object)) {
        seen.add(object)
        targets.push(target)
      }
      if (intersection.object === this.terrain && tile === null) {
        const x = Math.floor(intersection.point.x)
        const z = Math.floor(intersection.point.z)
        if (x >= 0 && x < MAP_SIZE && z >= 0 && z < MAP_SIZE) tile = { x, z }
      }
    })
    return { targets, tile, screenX: event.clientX, screenY: event.clientY }
  }

  private ensureEntity(
    id: string,
    build: () => HumanoidView,
    height: number,
    pickTarget: PickTarget,
  ): EntityView {
    const existing = this.entities.get(id)
    if (existing) return existing
    const view = build()
    view.group.userData['pickTarget'] = pickTarget
    this.scene.add(view.group)
    const entity: EntityView = {
      view,
      from: new THREE.Vector3(),
      to: new THREE.Vector3(),
      moveStartedAt: 0,
      targetYaw: 0,
      labels: {
        overhead: overheadLabel(this.overlay, 'overhead-text'),
        hpBar: overheadLabel(this.overlay, 'hp-bar'),
        hpFill: document.createElement('div'),
      },
      height,
      visible: true,
      hp: 1,
      maxHp: 1,
    }
    entity.labels.hpFill.className = 'hp-fill'
    entity.labels.hpBar.appendChild(entity.labels.hpFill)
    this.entities.set(id, entity)
    return entity
  }

  private removeEntity(id: string) {
    const entity = this.entities.get(id)
    if (!entity) return
    this.scene.remove(entity.view.group)
    entity.labels.overhead.remove()
    entity.labels.hpBar.remove()
    this.entities.delete(id)
  }

  private moveEntity(entity: EntityView, x: number, z: number, facing: { dx: number; dz: number }) {
    const target = new THREE.Vector3(x + 0.5, 0, z + 0.5)
    if (entity.moveStartedAt === 0) {
      entity.from.copy(target)
      entity.to.copy(target)
      entity.moveStartedAt = performance.now()
      entity.view.group.position.copy(target)
    } else if (!entity.to.equals(target)) {
      entity.from.copy(entity.view.group.position)
      entity.to.copy(target)
      entity.moveStartedAt = performance.now()
    }
    if (facing.dx !== 0 || facing.dz !== 0) {
      entity.targetYaw = Math.atan2(facing.dx, facing.dz)
    }
  }

  private syncSnapshot(snapshot: SnapshotMessage) {
    const seenEntities = new Set<string>()
    snapshot.players.forEach((player) => {
      const entity = this.ensureEntity(
        player.id,
        () => buildHumanoid(playerAppearance(player.id)),
        1.55,
        { kind: 'player', id: player.id, name: player.name },
      )
      seenEntities.add(player.id)
      this.moveEntity(entity, player.x, player.z, player.facing)
      entity.visible = true
      entity.view.group.visible = true
      entity.hp = player.hp
      entity.maxHp = player.maxHp
      entity.view.helmet.visible = player.equipment.head !== null
      entity.view.weapon.visible = player.equipment.weapon !== null
      if (player.equipment.weapon) {
        ;(entity.view.weapon.material as THREE.MeshLambertMaterial).color.set(
          WEAPON_COLORS[player.equipment.weapon] ?? '#cfcfcf',
        )
      }
      entity.labels.overhead.textContent = player.overheadText
      entity.labels.overhead.style.display = player.overheadText ? 'block' : 'none'
    })
    snapshot.npcs.forEach((npc) => {
      const def = NPCS[npc.defId]
      const entity = this.ensureEntity(
        npc.id,
        () => buildHumanoid(npcAppearance(npc.defId)),
        npc.defId === 'goblin' ? 1.3 : 1.55,
        {
          kind: 'npc',
          id: npc.id,
          defId: npc.defId,
          name: def.name,
          attackable: def.combat !== undefined,
        },
      )
      seenEntities.add(npc.id)
      entity.visible = !npc.dead
      entity.view.group.visible = !npc.dead
      entity.hp = npc.hp
      entity.maxHp = npc.maxHp
      if (!npc.dead) this.moveEntity(entity, npc.x, npc.z, npc.facing)
      entity.labels.overhead.style.display = 'none'
    })
    ;[...this.entities.keys()]
      .filter((id) => !seenEntities.has(id))
      .forEach((id) => this.removeEntity(id))

    const seenItems = new Set<string>()
    snapshot.groundItems.forEach((item) => {
      const key = `${item.x},${item.z},${item.itemId}`
      seenItems.add(key)
      if (this.groundItems.has(key)) return
      const mesh = buildGroundItem(item.itemId as ItemId)
      mesh.position.x += item.x + 0.5
      mesh.position.z += item.z + 0.5
      mesh.userData['pickTarget'] = {
        kind: 'groundItem',
        x: item.x,
        z: item.z,
        itemId: item.itemId,
      } satisfies PickTarget
      this.groundItems.set(key, mesh)
      this.scene.add(mesh)
    })
    ;[...this.groundItems.entries()]
      .filter(([key]) => !seenItems.has(key))
      .forEach(([key, mesh]) => {
        this.scene.remove(mesh)
        this.groundItems.delete(key)
      })

    const depleted = new Set(snapshot.depletedObjects)
    this.trees.forEach((tree, id) => {
      tree.canopy.visible = !depleted.has(id)
      tree.stump.visible = depleted.has(id)
    })
  }

  sync(state: ClientState) {
    this.selfId = state.playerId
    this.hitsplats = state.hitsplats
    if (state.snapshot) this.syncSnapshot(state.snapshot)
  }

  private projectToScreen(position: THREE.Vector3): { x: number; y: number } | null {
    const projected = position.clone().project(this.camera)
    if (projected.z > 1) return null
    const rect = this.renderer.domElement.getBoundingClientRect()
    return {
      x: ((projected.x + 1) / 2) * rect.width,
      y: ((1 - projected.y) / 2) * rect.height,
    }
  }

  private updateOverlays(now: number) {
    this.entities.forEach((entity, id) => {
      const head = entity.view.group.position
        .clone()
        .add(new THREE.Vector3(0, entity.height + 0.45, 0))
      const screen = entity.visible ? this.projectToScreen(head) : null
      const { overhead, hpBar, hpFill } = entity.labels
      if (!screen) {
        overhead.style.display = 'none'
        hpBar.style.display = 'none'
        return
      }
      if (overhead.textContent) {
        overhead.style.display = 'block'
        overhead.style.transform = `translate(-50%, -100%) translate(${screen.x}px, ${screen.y - 14}px)`
      }
      const inCombat =
        entity.hp < entity.maxHp ||
        this.hitsplats.some((fx) => fx.targetId === id && fx.expiresAt > now)
      hpBar.style.display = inCombat ? 'block' : 'none'
      if (inCombat) {
        hpBar.style.transform = `translate(-50%, 0) translate(${screen.x}px, ${screen.y}px)`
        hpFill.style.width = `${Math.round((entity.hp / entity.maxHp) * 100)}%`
      }
      const splats = this.hitsplats.filter((fx) => fx.targetId === id && fx.expiresAt > now)
      splats.forEach((fx) => {
        const key = `${id}-${fx.expiresAt}-${fx.damage}`
        if (!this.hitsplatElements.has(key)) {
          const element = overheadLabel(
            this.overlay,
            fx.damage === 0 ? 'hitsplat miss' : 'hitsplat',
          )
          element.textContent = String(fx.damage)
          element.style.display = 'block'
          this.hitsplatElements.set(key, element)
        }
        const chest = entity.view.group.position.clone().add(new THREE.Vector3(0, 0.8, 0))
        const chestScreen = this.projectToScreen(chest)
        const element = this.hitsplatElements.get(key)!
        if (chestScreen) {
          element.style.transform = `translate(-50%, -50%) translate(${chestScreen.x}px, ${chestScreen.y}px)`
        }
      })
    })
    this.hitsplatElements.forEach((element, key) => {
      const expiry = Number(key.split('-').at(-2))
      if (expiry <= now) {
        element.remove()
        this.hitsplatElements.delete(key)
      }
    })
  }

  private animateEntities(now: number) {
    this.entities.forEach((entity) => {
      const { group, leftLeg, rightLeg, leftArm, rightArm } = entity.view
      const t = Math.min(1, (now - entity.moveStartedAt) / TICK_MILLIS)
      group.position.lerpVectors(entity.from, entity.to, t)
      const moving = t < 1 && !entity.from.equals(entity.to)
      const swing = moving ? Math.sin(now * 0.012) * 0.55 : 0
      leftLeg.rotation.x = swing
      rightLeg.rotation.x = -swing
      leftArm.rotation.x = -swing * 0.7
      rightArm.rotation.x = swing * 0.7
      const yawDelta = entity.targetYaw - group.rotation.y
      const wrapped = Math.atan2(Math.sin(yawDelta), Math.cos(yawDelta))
      group.rotation.y += wrapped * 0.2
    })
  }

  private updateCamera() {
    const self = this.selfId ? this.entities.get(this.selfId) : undefined
    const target = self ? self.view.group.position.clone() : new THREE.Vector3(32, 0, 32)
    target.y += 1
    const offset = new THREE.Vector3(
      Math.sin(this.cameraAzimuth) * Math.sin(this.cameraPolar),
      Math.cos(this.cameraPolar),
      Math.cos(this.cameraAzimuth) * Math.sin(this.cameraPolar),
    ).multiplyScalar(this.cameraRadius)
    this.camera.position.copy(target).add(offset)
    this.camera.lookAt(target)
  }

  private readonly loop = () => {
    if (this.disposed) return
    const now = performance.now()
    this.animateEntities(now)
    this.updateCamera()
    this.updateOverlays(Date.now())
    if (this.marker.visible) {
      const age = performance.now() - this.markerShownAt
      const material = (this.marker.children[0] as THREE.Mesh).material as THREE.MeshBasicMaterial
      material.opacity = Math.max(0, 1 - age / 700)
      if (age > 700) this.marker.visible = false
    }
    this.renderer.render(this.scene, this.camera)
    this.animationFrame = requestAnimationFrame(this.loop)
  }

  dispose() {
    this.disposed = true
    cancelAnimationFrame(this.animationFrame)
    window.removeEventListener('resize', this.resize)
    this.renderer.dispose()
    this.renderer.domElement.remove()
    this.overlay.remove()
  }
}

export const examineTextFor = (itemId: ItemId): string => ITEMS[itemId].examine
