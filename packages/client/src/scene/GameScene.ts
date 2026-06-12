import * as THREE from 'three'
import { GAME_MAP, ITEMS, MAP_SIZE, NPCS, type ItemId, type SnapshotMessage } from '@osrs/shared'
import type { PickTarget } from '../game/actions'
import type { ClientState, HitsplatFx } from '../store/reducer'
import {
  buildBuilding,
  buildButterfly,
  buildCow,
  buildGroundItem,
  buildHumanoid,
  buildSmokePuff,
  buildTerrain,
  buildTree,
  buildWaterOverlay,
  buildWorldObject,
  npcAppearance,
  playerAppearance,
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
  stepDistance: number
  attackUntil: number
}

const TICK_MILLIS = 600
const ATTACK_ANIM_MILLIS = 480
const CAMERA_LIMITS = { minRadius: 6, maxRadius: 26, minPolar: 0.35, maxPolar: 1.25 }
const SUN_OFFSET = new THREE.Vector3(8, 60, -12)
const GROUND_PLANE = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)

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
  private readonly sun: THREE.DirectionalLight
  private readonly water: THREE.Mesh
  private readonly smokePuffs: Array<{ mesh: THREE.Mesh; base: THREE.Vector3; offset: number }> = []
  private readonly butterflies: Array<{
    group: THREE.Group
    anchor: THREE.Vector3
    phase: number
  }> = []
  private readonly trees = new Map<string, TreeView>()
  private readonly worldObjects = new Map<string, THREE.Group>()
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
    this.scene.fog = new THREE.Fog('#87b3d6', 45, 100)

    const hemisphere = new THREE.HemisphereLight('#cfe5ff', '#54603c', 0.95)
    this.sun = new THREE.DirectionalLight('#ffeec2', 1.6)
    this.sun.castShadow = true
    this.sun.shadow.camera.left = -40
    this.sun.shadow.camera.right = 40
    this.sun.shadow.camera.top = 40
    this.sun.shadow.camera.bottom = -40
    this.sun.shadow.mapSize.set(2048, 2048)
    this.scene.add(hemisphere, this.sun, this.sun.target)

    this.terrain = buildTerrain()
    this.scene.add(this.terrain)

    GAME_MAP.buildings.forEach((building) => this.scene.add(buildBuilding(building)))

    this.water = buildWaterOverlay()
    this.scene.add(this.water)

    GAME_MAP.buildings.forEach((building) => {
      if (!building.chimney) return
      const base = new THREE.Vector3(building.chimney.x + 0.5, 3.35, building.chimney.z + 0.5)
      for (let puffIndex = 0; puffIndex < 3; puffIndex += 1) {
        const mesh = buildSmokePuff()
        this.scene.add(mesh)
        this.smokePuffs.push({ mesh, base, offset: puffIndex / 3 })
      }
    })

    const butterflyColors = ['#f3e9c0', '#e8a8c8', '#c0d8f3']
    butterflyColors.forEach((color, index) => {
      const group = buildButterfly(color)
      this.scene.add(group)
      this.butterflies.push({
        group,
        anchor: new THREE.Vector3(
          GAME_MAP.spawnPoint.x + (index - 1) * 9 + 3,
          0,
          GAME_MAP.spawnPoint.z + (index - 1) * 6 - 4,
        ),
        phase: index * 2.1,
      })
    })

    GAME_MAP.objects.forEach((object) => {
      if (object.kind === 'tree') {
        const tree = buildTree(object.x * 31 + object.z)
        tree.group.position.set(object.x + 0.5, 0, object.z + 0.5)
        tree.group.userData['pickTarget'] = {
          kind: 'tree',
          objectId: object.id,
          name: object.name,
          examine: object.examine,
        } satisfies PickTarget
        this.trees.set(object.id, tree)
        this.scene.add(tree.group)
        return
      }
      const view = buildWorldObject(object.kind)
      view.position.set(object.x + 0.5, 0, object.z + 0.5)
      view.userData['pickTarget'] = {
        kind: 'object',
        objectId: object.id,
        objectKind: object.kind,
        name: object.name,
        examine: object.examine,
      } satisfies PickTarget
      this.worldObjects.set(object.id, view)
      this.scene.add(view)
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
    const pickables: THREE.Object3D[] = []
    this.trees.forEach((tree) => pickables.push(tree.group))
    this.worldObjects.forEach((object) => pickables.push(object))
    this.entities.forEach((entity) => {
      if (entity.visible) pickables.push(entity.view.group)
    })
    this.groundItems.forEach((mesh) => pickables.push(mesh))
    const intersections = this.raycaster.intersectObjects(pickables, true)
    const targets: PickTarget[] = []
    const seen = new Set<unknown>()
    intersections.forEach((intersection) => {
      let object: THREE.Object3D | null = intersection.object
      while (object && object.userData['pickTarget'] === undefined) object = object.parent
      const target = object?.userData['pickTarget'] as PickTarget | undefined
      if (target && !seen.has(object)) {
        seen.add(object)
        targets.push(target)
      }
    })
    const groundPoint = this.raycaster.ray.intersectPlane(GROUND_PLANE, new THREE.Vector3())
    let tile: { x: number; z: number } | null = null
    if (groundPoint) {
      const x = Math.floor(groundPoint.x)
      const z = Math.floor(groundPoint.z)
      if (x >= 0 && x < MAP_SIZE && z >= 0 && z < MAP_SIZE) tile = { x, z }
    }
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
      stepDistance: 0,
      attackUntil: 0,
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
      entity.stepDistance = entity.from.distanceTo(entity.to)
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
      entity.view.hair.visible = player.equipment.head === null
      entity.view.weapon.visible = player.equipment.weapon !== null
      entity.view.axe.visible = player.equipment.weapon === 'bronze_axe'
      entity.view.sword.visible = player.equipment.weapon !== 'bronze_axe'
      if (player.anim === 'attack') {
        entity.attackUntil = performance.now() + ATTACK_ANIM_MILLIS
      }
      entity.labels.overhead.textContent = player.overheadText
      entity.labels.overhead.style.display = player.overheadText ? 'block' : 'none'
    })
    snapshot.npcs.forEach((npc) => {
      const def = NPCS[npc.defId]
      const entity = this.ensureEntity(
        npc.id,
        () => (npc.defId === 'cow' ? buildCow() : buildHumanoid(npcAppearance(npc.defId))),
        npc.defId === 'goblin' ? 1.3 : npc.defId === 'cow' ? 1.2 : 1.55,
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
      if (npc.anim === 'attack') {
        entity.attackUntil = performance.now() + ATTACK_ANIM_MILLIS
      }
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
      const running = entity.stepDistance > 1.5
      const swingSpeed = running ? 0.019 : 0.012
      const swingAmplitude = running ? 0.8 : 0.55
      const swing = moving ? Math.sin(now * swingSpeed) * swingAmplitude : 0
      leftLeg.rotation.x = swing
      rightLeg.rotation.x = -swing
      leftArm.rotation.x = -swing * 0.7
      if (now < entity.attackUntil) {
        const progress = 1 - (entity.attackUntil - now) / ATTACK_ANIM_MILLIS
        rightArm.rotation.x = -Math.sin(progress * Math.PI) * 2.1
      } else {
        rightArm.rotation.x = swing * 0.7
      }
      if (!moving) {
        group.position.y += Math.sin(now * 0.0022) * 0.012 + 0.012
      }
      group.rotation.x = moving && running ? -0.07 : 0
      const yawDelta = entity.targetYaw - group.rotation.y
      const wrapped = Math.atan2(Math.sin(yawDelta), Math.cos(yawDelta))
      group.rotation.y += wrapped * 0.2
    })
  }

  private updateCamera() {
    const self = this.selfId ? this.entities.get(this.selfId) : undefined
    const target = self
      ? self.view.group.position.clone()
      : new THREE.Vector3(GAME_MAP.spawnPoint.x, 0, GAME_MAP.spawnPoint.z)
    target.y += 1
    const offset = new THREE.Vector3(
      Math.sin(this.cameraAzimuth) * Math.sin(this.cameraPolar),
      Math.cos(this.cameraPolar),
      Math.cos(this.cameraAzimuth) * Math.sin(this.cameraPolar),
    ).multiplyScalar(this.cameraRadius)
    this.camera.position.copy(target).add(offset)
    this.camera.lookAt(target)
    this.sun.position.copy(target).add(SUN_OFFSET)
    this.sun.target.position.copy(target)
  }

  private animateAmbience(now: number) {
    this.water.position.y = -0.1 + Math.sin(now * 0.0012) * 0.03
    this.smokePuffs.forEach((puff) => {
      const cycle = (now * 0.00035 + puff.offset) % 1
      puff.mesh.position.set(
        puff.base.x + Math.sin((cycle + puff.offset) * 7) * 0.1,
        puff.base.y + cycle * 1.7,
        puff.base.z,
      )
      puff.mesh.scale.setScalar(0.6 + cycle * 1.2)
      ;(puff.mesh.material as THREE.MeshLambertMaterial).opacity = 0.45 * (1 - cycle)
    })
    this.butterflies.forEach((butterfly) => {
      const t = now * 0.001 + butterfly.phase
      butterfly.group.position.set(
        butterfly.anchor.x + Math.sin(t * 0.7) * 3,
        0.9 + Math.sin(t * 1.7) * 0.35,
        butterfly.anchor.z + Math.cos(t * 0.5) * 3,
      )
      const flap = Math.sin(now * 0.02) * 0.9
      const leftWing = butterfly.group.children[0]
      const rightWing = butterfly.group.children[1]
      if (leftWing) leftWing.rotation.z = flap
      if (rightWing) rightWing.rotation.z = -flap
    })
  }

  private readonly loop = () => {
    if (this.disposed) return
    const now = performance.now()
    this.animateEntities(now)
    this.animateAmbience(now)
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
