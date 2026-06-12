import {
  burnChance,
  buyPrice,
  cookableFor,
  GAME_MAP,
  isWalkable,
  ITEMS,
  levelForXp,
  NPCS,
  rollDamage,
  sellPrice,
  SHOP_BASE_STOCK,
  type ItemId,
  type ClientMessage,
  type PersistentPlayer,
  type CombatantStats,
  type GameEvent,
  type ItemStack,
  type NpcDef,
  type Position,
  type Skill,
  type SkillXp,
} from '@osrs/shared'
import { findPath, findPathToAdjacent } from '../pathfinding'
import {
  maxHpOf,
  createPlayer,
  type PlayerAction,
  type SimGroundItem,
  type SimNpc,
  type SimPlayer,
  type SimWorld,
} from './world'

export type SimIntent =
  | Readonly<{ kind: 'join'; playerId: string; name: string; restore?: PersistentPlayer }>
  | Readonly<{ kind: 'leave'; playerId: string }>
  | Readonly<{ kind: 'message'; playerId: string; message: ClientMessage }>

export type SimRng = Readonly<{
  combat: () => number
  skill: () => number
  wander: () => number
}>

export const defaultRng: SimRng = {
  combat: Math.random,
  skill: Math.random,
  wander: Math.random,
}

export type AddressedEvent = Readonly<{ audience: 'all' | string; event: GameEvent }>

export type TickResult = Readonly<{ world: SimWorld; events: AddressedEvent[] }>

const CHAT_OVERHEAD_TICKS = 7
const NPC_RESPAWN_TICKS = 25
const TREE_RESPAWN_TICKS = 50
const DROPPED_ITEM_DESPAWN_TICKS = 500
const PLAYER_ATTACK_SPEED_TICKS = 4
const WOODCUTTING_XP_PER_LOG = 25
const FISHING_XP_PER_CATCH = 10
const COOK_INTERVAL_TICKS = 3
const NO_SPACE_MESSAGE = "You don't have enough inventory space."

const SKILL_DISPLAY_NAMES: Record<Skill, string> = {
  attack: 'Attack',
  strength: 'Strength',
  defence: 'Defence',
  hitpoints: 'Hitpoints',
  woodcutting: 'Woodcutting',
  fishing: 'Fishing',
  cooking: 'Cooking',
}

const sign = (value: number): number => (value > 0 ? 1 : value < 0 ? -1 : 0)

const cardinallyAdjacent = (a: Position, b: Position): boolean =>
  Math.abs(a.x - b.x) + Math.abs(a.z - b.z) === 1

const faceTowards = (
  entity: { facing: { dx: number; dz: number } },
  from: Position,
  to: Position,
) => {
  if (from.x === to.x && from.z === to.z) return
  entity.facing = { dx: sign(to.x - from.x), dz: sign(to.z - from.z) }
}

const emit = (events: AddressedEvent[], audience: 'all' | string, event: GameEvent) => {
  events.push({ audience, event })
}

const sendMessage = (events: AddressedEvent[], playerId: string, text: string) => {
  emit(events, playerId, { kind: 'message', text })
}

const equipmentBonus = (
  player: SimPlayer,
  bonus: 'attackBonus' | 'strengthBonus' | 'defenceBonus',
): number =>
  [player.equipment.head, player.equipment.weapon].reduce(
    (total, stack) => total + (stack ? (ITEMS[stack.itemId][bonus] ?? 0) : 0),
    0,
  )

const playerStats = (player: SimPlayer): CombatantStats => ({
  attackLevel: levelForXp(player.skills.attack),
  strengthLevel: levelForXp(player.skills.strength),
  defenceLevel: levelForXp(player.skills.defence),
  attackBonus: equipmentBonus(player, 'attackBonus'),
  strengthBonus: equipmentBonus(player, 'strengthBonus'),
  defenceBonus: equipmentBonus(player, 'defenceBonus'),
})

const npcStats = (def: NpcDef): CombatantStats => ({
  attackLevel: def.combat?.attackLevel ?? 1,
  strengthLevel: def.combat?.strengthLevel ?? 1,
  defenceLevel: def.combat?.defenceLevel ?? 1,
  attackBonus: 0,
  strengthBonus: 0,
  defenceBonus: 0,
})

const awardXp = (events: AddressedEvent[], player: SimPlayer, skill: Skill, amount: number) => {
  const levelBefore = levelForXp(player.skills[skill])
  player.skills = { ...player.skills, [skill]: player.skills[skill] + amount } as SkillXp
  const levelAfter = levelForXp(player.skills[skill])
  if (levelAfter <= levelBefore) return
  emit(events, player.id, { kind: 'levelUp', skill, level: levelAfter })
  const name = SKILL_DISPLAY_NAMES[skill]
  sendMessage(
    events,
    player.id,
    `Congratulations, you've advanced ${name === 'Attack' ? 'an' : 'a'} ${name} level. Your ${name} level is now ${levelAfter}.`,
  )
  if (skill === 'hitpoints') player.hp += levelAfter - levelBefore
}

const addToInventory = (player: SimPlayer, stack: ItemStack): boolean => {
  if (ITEMS[stack.itemId].stackable) {
    const existingIndex = player.inventory.findIndex((slot) => slot?.itemId === stack.itemId)
    if (existingIndex !== -1) {
      const existing = player.inventory[existingIndex]!
      player.inventory[existingIndex] = {
        itemId: existing.itemId,
        quantity: existing.quantity + stack.quantity,
      }
      return true
    }
  }
  const freeIndex = player.inventory.indexOf(null)
  if (freeIndex === -1) return false
  player.inventory[freeIndex] = stack
  return true
}

const addGroundItem = (world: SimWorld, item: SimGroundItem) => {
  if (ITEMS[item.itemId].stackable) {
    const existing = world.groundItems.find(
      (candidate) =>
        candidate.x === item.x && candidate.z === item.z && candidate.itemId === item.itemId,
    )
    if (existing) {
      existing.quantity += item.quantity
      return
    }
  }
  world.groundItems.push(item)
}

const hasAxe = (player: SimPlayer): boolean =>
  player.inventory.some((stack) => stack !== null && ITEMS[stack.itemId].isAxe === true) ||
  (player.equipment.weapon !== null && ITEMS[player.equipment.weapon.itemId].isAxe === true)

const hasNet = (player: SimPlayer): boolean =>
  player.inventory.some((stack) => stack?.itemId === 'small_fishing_net')

const removeOneFromSlot = (player: SimPlayer, slot: number) => {
  const stack = player.inventory[slot]
  if (!stack) return
  player.inventory[slot] =
    stack.quantity > 1 ? { itemId: stack.itemId, quantity: stack.quantity - 1 } : null
}

const clearNpcTargets = (world: SimWorld, playerId: string) => {
  Object.values(world.npcs).forEach((npc) => {
    if (npc.targetPlayerId === playerId) npc.targetPlayerId = null
  })
}

const equipFromSlot = (events: AddressedEvent[], player: SimPlayer, slot: number) => {
  const stack = player.inventory[slot]
  if (!stack) return
  const def = ITEMS[stack.itemId]
  if (!def.equipSlot) {
    sendMessage(events, player.id, "You can't equip that.")
    return
  }
  const previouslyEquipped = player.equipment[def.equipSlot]
  player.inventory[slot] = previouslyEquipped
  player.equipment[def.equipSlot] = stack
}

const unequip = (events: AddressedEvent[], player: SimPlayer, slotName: 'head' | 'weapon') => {
  const stack = player.equipment[slotName]
  if (!stack) return
  if (!addToInventory(player, stack)) {
    sendMessage(events, player.id, NO_SPACE_MESSAGE)
    return
  }
  player.equipment[slotName] = null
}

const dropFromSlot = (world: SimWorld, player: SimPlayer, slot: number) => {
  const stack = player.inventory[slot]
  if (!stack) return
  player.inventory[slot] = null
  addGroundItem(world, {
    x: player.position.x,
    z: player.position.z,
    itemId: stack.itemId,
    quantity: stack.quantity,
    despawnAtTick: world.tick + DROPPED_ITEM_DESPAWN_TICKS,
  })
}

const setAction = (player: SimPlayer, action: PlayerAction) => {
  player.action = action
  player.path = []
  player.openInterface = null
}

const countOf = (player: SimPlayer, itemId: ItemStack['itemId']): number =>
  player.inventory.reduce(
    (total, stack) => total + (stack?.itemId === itemId ? stack.quantity : 0),
    0,
  )

const removeFromInventory = (player: SimPlayer, itemId: ItemStack['itemId'], amount: number) => {
  let remaining = amount
  player.inventory = player.inventory.map((stack) => {
    if (remaining === 0 || stack?.itemId !== itemId) return stack
    const taken = Math.min(stack.quantity, remaining)
    remaining -= taken
    return stack.quantity > taken ? { itemId, quantity: stack.quantity - taken } : null
  })
}

const depositToBank = (player: SimPlayer, slot: number, amount: number | 'all') => {
  if (player.openInterface !== 'bank') return
  const stack = player.inventory[slot]
  if (!stack) return
  const available = countOf(player, stack.itemId)
  const toDeposit = amount === 'all' ? available : Math.min(amount, available)
  if (toDeposit <= 0) return
  removeFromInventory(player, stack.itemId, toDeposit)
  const existing = player.bank.find((entry) => entry.itemId === stack.itemId)
  player.bank = existing
    ? player.bank.map((entry) =>
        entry.itemId === stack.itemId
          ? { itemId: entry.itemId, quantity: entry.quantity + toDeposit }
          : entry,
      )
    : [...player.bank, { itemId: stack.itemId, quantity: toDeposit }]
}

const withdrawFromBank = (
  events: AddressedEvent[],
  player: SimPlayer,
  bankIndex: number,
  amount: number | 'all',
) => {
  if (player.openInterface !== 'bank') return
  const entry = player.bank[bankIndex]
  if (!entry) return
  const requested = amount === 'all' ? entry.quantity : Math.min(amount, entry.quantity)
  let withdrawn = 0
  if (ITEMS[entry.itemId].stackable) {
    if (addToInventory(player, { itemId: entry.itemId, quantity: requested })) {
      withdrawn = requested
    }
  } else {
    while (withdrawn < requested && addToInventory(player, { itemId: entry.itemId, quantity: 1 })) {
      withdrawn += 1
    }
  }
  if (withdrawn < requested) sendMessage(events, player.id, NO_SPACE_MESSAGE)
  if (withdrawn === 0) return
  player.bank =
    entry.quantity > withdrawn
      ? player.bank.map((candidate, index) =>
          index === bankIndex
            ? { itemId: candidate.itemId, quantity: candidate.quantity - withdrawn }
            : candidate,
        )
      : player.bank.filter((_, index) => index !== bankIndex)
}

const eatFromSlot = (events: AddressedEvent[], player: SimPlayer, slot: number) => {
  const stack = player.inventory[slot]
  if (!stack) return
  const def = ITEMS[stack.itemId]
  if (def.heals === undefined) {
    sendMessage(events, player.id, "You can't eat that.")
    return
  }
  removeOneFromSlot(player, slot)
  player.hp = Math.min(maxHpOf(player), player.hp + def.heals)
  sendMessage(events, player.id, `You eat the ${def.name.toLowerCase()}.`)
}

const applyIntent = (world: SimWorld, events: AddressedEvent[], intent: SimIntent) => {
  if (intent.kind === 'join') {
    world.players[intent.playerId] = createPlayer(intent.playerId, intent.name, intent.restore)
    return
  }
  if (intent.kind === 'leave') {
    delete world.players[intent.playerId]
    clearNpcTargets(world, intent.playerId)
    return
  }
  const player = world.players[intent.playerId]
  if (!player) return
  const message = intent.message
  switch (message.type) {
    case 'hello':
      return
    case 'moveTo':
      player.action = null
      player.openInterface = null
      player.path = findPath(player.position, { x: message.x, z: message.z }, isWalkable)
      return
    case 'takeItem':
      setAction(player, { kind: 'take', x: message.x, z: message.z, itemId: message.itemId })
      return
    case 'talkToNpc':
      setAction(player, { kind: 'talk', npcId: message.npcId })
      return
    case 'attackNpc':
      setAction(player, { kind: 'attack', npcId: message.npcId })
      return
    case 'chopTree':
      setAction(player, { kind: 'chop', objectId: message.objectId })
      return
    case 'fish':
      setAction(player, { kind: 'fish', objectId: message.objectId })
      return
    case 'cook':
      setAction(player, { kind: 'cook', objectId: message.objectId, readyAtTick: null })
      return
    case 'eatItem':
      eatFromSlot(events, player, message.slot)
      return
    case 'openBank':
      setAction(player, { kind: 'openBank', objectId: message.objectId })
      return
    case 'depositItem':
      depositToBank(player, message.slot, message.amount)
      return
    case 'withdrawItem':
      withdrawFromBank(events, player, message.bankIndex, message.amount)
      return
    case 'closeInterface':
      player.openInterface = null
      return
    case 'openShop':
      setAction(player, { kind: 'openShop', npcId: message.npcId })
      return
    case 'buyItem':
      buyFromShop(world, events, player, message.itemId, message.amount)
      return
    case 'sellItem':
      sellToShop(world, events, player, message.slot, message.amount)
      return
    case 'equipItem':
      equipFromSlot(events, player, message.slot)
      return
    case 'unequipItem':
      unequip(events, player, message.equipSlot)
      return
    case 'dropItem':
      dropFromSlot(world, player, message.slot)
      return
    case 'setRun':
      player.runEnabled = message.enabled && player.runEnergy > 0
      return
    case 'chat':
      player.overhead = { text: message.text, expiresTick: world.tick + CHAT_OVERHEAD_TICKS }
      emit(events, 'all', {
        kind: 'chat',
        playerId: player.id,
        name: player.name,
        text: message.text,
      })
      return
  }
}

const respawnPlayer = (world: SimWorld, events: AddressedEvent[], player: SimPlayer) => {
  sendMessage(events, player.id, 'Oh dear, you are dead!')
  player.position = GAME_MAP.spawnPoint
  player.hp = maxHpOf(player)
  player.path = []
  player.action = null
  clearNpcTargets(world, player.id)
}

const npcAttacks = (
  world: SimWorld,
  events: AddressedEvent[],
  npc: SimNpc,
  target: SimPlayer,
  rng: SimRng,
) => {
  const def = NPCS[npc.defId]
  const damage = rollDamage(npcStats(def), playerStats(target), rng.combat)
  target.hp = Math.max(0, target.hp - damage)
  emit(events, 'all', { kind: 'hitsplat', targetKind: 'player', targetId: target.id, damage })
  npc.attackCooldown = def.combat?.attackSpeedTicks ?? 4
  npc.lastAttackTick = world.tick
  if (target.hp === 0) respawnPlayer(world, events, target)
}

const stepNpc = (npc: SimNpc, next: Position) => {
  faceTowards(npc, npc.position, next)
  npc.position = next
}

const wander = (npc: SimNpc, rng: SimRng) => {
  if (npc.wanderRadius === 0) return
  if (rng.wander() >= 0.15) return
  const dx = Math.floor(rng.wander() * 3) - 1
  const dz = Math.floor(rng.wander() * 3) - 1
  if (dx === 0 && dz === 0) return
  const next = { x: npc.position.x + dx, z: npc.position.z + dz }
  const withinLeash =
    Math.max(Math.abs(next.x - npc.home.x), Math.abs(next.z - npc.home.z)) <= npc.wanderRadius
  const diagonalAllowed =
    dx === 0 ||
    dz === 0 ||
    (isWalkable({ x: npc.position.x + dx, z: npc.position.z }) &&
      isWalkable({ x: npc.position.x, z: npc.position.z + dz }))
  if (withinLeash && diagonalAllowed && isWalkable(next)) stepNpc(npc, next)
}

const npcTurn = (world: SimWorld, events: AddressedEvent[], npc: SimNpc, rng: SimRng) => {
  if (npc.respawnAtTick !== null) return
  npc.attackCooldown = Math.max(0, npc.attackCooldown - 1)
  const target = npc.targetPlayerId ? world.players[npc.targetPlayerId] : undefined
  if (!target) {
    npc.targetPlayerId = null
    const distanceHome = Math.max(
      Math.abs(npc.position.x - npc.home.x),
      Math.abs(npc.position.z - npc.home.z),
    )
    if (distanceHome > npc.wanderRadius) {
      const path = findPath(npc.position, npc.home, isWalkable)
      if (path.length > 0) stepNpc(npc, path[0]!)
      return
    }
    wander(npc, rng)
    return
  }
  if (cardinallyAdjacent(npc.position, target.position)) {
    faceTowards(npc, npc.position, target.position)
    if (npc.attackCooldown === 0) npcAttacks(world, events, npc, target, rng)
    return
  }
  const path = findPathToAdjacent(npc.position, target.position, isWalkable)
  if (!path || path.length === 0) return
  stepNpc(npc, path[0]!)
}

const MAX_RUN_ENERGY = 100

const stepPlayer = (player: SimPlayer) => {
  const limit = player.runEnabled && player.runEnergy > 0 ? 2 : 1
  for (let step = 0; step < limit; step += 1) {
    const next = player.path[0]
    if (!next) return
    faceTowards(player, player.position, next)
    player.position = next
    player.path = player.path.slice(1)
    if (player.runEnabled) {
      player.runEnergy -= 1
      if (player.runEnergy === 0) {
        player.runEnabled = false
        return
      }
    }
  }
}

const abandonAction = (events: AddressedEvent[], player: SimPlayer, text?: string) => {
  if (text) sendMessage(events, player.id, text)
  player.action = null
  player.path = []
}

const approach = (events: AddressedEvent[], player: SimPlayer, target: Position): boolean => {
  const path = findPathToAdjacent(player.position, target, isWalkable)
  if (path === null) {
    abandonAction(events, player, "I can't reach that!")
    return false
  }
  player.path = path
  stepPlayer(player)
  return true
}

const resolveTake = (
  world: SimWorld,
  events: AddressedEvent[],
  player: SimPlayer,
  action: Extract<PlayerAction, { kind: 'take' }>,
) => {
  const targetTile = { x: action.x, z: action.z }
  if (player.position.x !== action.x || player.position.z !== action.z) {
    const path = findPath(player.position, targetTile, isWalkable)
    const destination = path[path.length - 1]
    if (!destination || destination.x !== action.x || destination.z !== action.z) {
      abandonAction(events, player, "I can't reach that!")
      return
    }
    player.path = path
    stepPlayer(player)
    return
  }
  const itemIndex = world.groundItems.findIndex(
    (item) => item.x === action.x && item.z === action.z && item.itemId === action.itemId,
  )
  if (itemIndex === -1) {
    abandonAction(events, player, "Too late - it's gone!")
    return
  }
  const item = world.groundItems[itemIndex]!
  if (!addToInventory(player, { itemId: item.itemId, quantity: item.quantity })) {
    abandonAction(events, player, NO_SPACE_MESSAGE)
    return
  }
  world.groundItems.splice(itemIndex, 1)
  if (item.spawnIndex !== undefined) {
    const spawn = GAME_MAP.itemSpawns[item.spawnIndex]
    world.itemRespawns[item.spawnIndex] = world.tick + (spawn?.respawnTicks ?? 50)
  }
  abandonAction(events, player)
}

const resolveTalk = (
  world: SimWorld,
  events: AddressedEvent[],
  player: SimPlayer,
  action: Extract<PlayerAction, { kind: 'talk' }>,
) => {
  const npc = world.npcs[action.npcId]
  if (!npc || npc.respawnAtTick !== null) {
    abandonAction(events, player)
    return
  }
  if (!cardinallyAdjacent(player.position, npc.position)) {
    approach(events, player, npc.position)
    return
  }
  faceTowards(player, player.position, npc.position)
  faceTowards(npc, npc.position, player.position)
  const def = NPCS[npc.defId]
  emit(events, player.id, {
    kind: 'dialogue',
    npcName: def.name,
    lines: [...(def.dialogue ?? [`${def.name} doesn't seem interested in talking.`])],
  })
  abandonAction(events, player)
}

const killNpc = (world: SimWorld, events: AddressedEvent[], npc: SimNpc, killer: SimPlayer) => {
  const def = NPCS[npc.defId]
  def.drops?.forEach((drop) =>
    addGroundItem(world, {
      x: npc.position.x,
      z: npc.position.z,
      itemId: drop.itemId,
      quantity: drop.quantity,
      despawnAtTick: world.tick + DROPPED_ITEM_DESPAWN_TICKS,
    }),
  )
  npc.respawnAtTick = world.tick + NPC_RESPAWN_TICKS
  npc.targetPlayerId = null
  sendMessage(events, killer.id, `You have defeated the ${def.name}.`)
  Object.values(world.players).forEach((player) => {
    if (player.action?.kind === 'attack' && player.action.npcId === npc.id) {
      player.action = null
    }
  })
}

const resolveAttack = (
  world: SimWorld,
  events: AddressedEvent[],
  player: SimPlayer,
  action: Extract<PlayerAction, { kind: 'attack' }>,
  rng: SimRng,
) => {
  const npc = world.npcs[action.npcId]
  if (!npc || npc.respawnAtTick !== null) {
    abandonAction(events, player)
    return
  }
  const def = NPCS[npc.defId]
  if (!def.combat) {
    abandonAction(events, player, `The ${def.name} doesn't want to fight.`)
    return
  }
  if (!cardinallyAdjacent(player.position, npc.position)) {
    approach(events, player, npc.position)
    return
  }
  faceTowards(player, player.position, npc.position)
  if (player.attackCooldown > 0) return
  const damage = rollDamage(playerStats(player), npcStats(def), rng.combat)
  npc.hp = Math.max(0, npc.hp - damage)
  npc.targetPlayerId = player.id
  emit(events, 'all', { kind: 'hitsplat', targetKind: 'npc', targetId: npc.id, damage })
  player.attackCooldown = PLAYER_ATTACK_SPEED_TICKS
  player.lastAttackTick = world.tick
  awardXp(events, player, 'attack', 2 * damage)
  awardXp(events, player, 'strength', 2 * damage)
  awardXp(events, player, 'hitpoints', 1.33 * damage)
  if (npc.hp === 0) killNpc(world, events, npc, player)
}

const chopSuccessChance = (woodcuttingLevel: number): number =>
  Math.min(0.95, 0.3 + woodcuttingLevel * 0.007)

const fishSuccessChance = (fishingLevel: number): number =>
  Math.min(0.95, 0.3 + fishingLevel * 0.007)

const resolveFish = (
  events: AddressedEvent[],
  player: SimPlayer,
  action: Extract<PlayerAction, { kind: 'fish' }>,
  rng: SimRng,
) => {
  const spot = GAME_MAP.objects.find(
    (object) => object.id === action.objectId && object.kind === 'fishing_spot',
  )
  if (!spot) {
    abandonAction(events, player)
    return
  }
  if (!cardinallyAdjacent(player.position, spot)) {
    approach(events, player, spot)
    return
  }
  faceTowards(player, player.position, spot)
  if (!hasNet(player)) {
    abandonAction(events, player, 'You need a small fishing net to catch these fish.')
    return
  }
  if (rng.skill() >= fishSuccessChance(levelForXp(player.skills.fishing))) return
  if (!addToInventory(player, { itemId: 'raw_shrimps', quantity: 1 })) {
    abandonAction(events, player, NO_SPACE_MESSAGE)
    return
  }
  sendMessage(events, player.id, 'You catch some shrimps.')
  awardXp(events, player, 'fishing', FISHING_XP_PER_CATCH)
}

const buyFromShop = (
  world: SimWorld,
  events: AddressedEvent[],
  player: SimPlayer,
  itemId: ItemId,
  amount: number,
) => {
  if (player.openInterface !== 'shop') return
  for (let bought = 0; bought < amount; bought += 1) {
    const stock = world.shopStock[itemId] ?? 0
    if (stock <= 0) {
      sendMessage(events, player.id, 'The shop has run out of stock.')
      return
    }
    const price = buyPrice(itemId)
    if (countOf(player, 'coins') < price) {
      sendMessage(events, player.id, "You don't have enough coins.")
      return
    }
    const coinSlot = player.inventory.findIndex((stack) => stack?.itemId === 'coins')
    removeFromInventory(player, 'coins', price)
    if (!addToInventory(player, { itemId, quantity: 1 })) {
      if (coinSlot !== -1) addToInventory(player, { itemId: 'coins', quantity: price })
      sendMessage(events, player.id, NO_SPACE_MESSAGE)
      return
    }
    world.shopStock[itemId] = stock - 1
  }
}

const sellToShop = (
  world: SimWorld,
  events: AddressedEvent[],
  player: SimPlayer,
  slot: number,
  amount: number | 'all',
) => {
  if (player.openInterface !== 'shop') return
  const stack = player.inventory[slot]
  if (!stack) return
  if (stack.itemId === 'coins') {
    sendMessage(events, player.id, "You can't sell that.")
    return
  }
  const available = countOf(player, stack.itemId)
  const toSell = amount === 'all' ? available : Math.min(amount, available)
  if (toSell <= 0) return
  removeFromInventory(player, stack.itemId, toSell)
  addToInventory(player, { itemId: 'coins', quantity: sellPrice(stack.itemId) * toSell })
  world.shopStock[stack.itemId] = (world.shopStock[stack.itemId] ?? 0) + toSell
}

const SHOP_RESTOCK_INTERVAL_TICKS = 25

const regenerateShopStock = (world: SimWorld) => {
  if (world.tick % SHOP_RESTOCK_INTERVAL_TICKS !== 0) return
  const itemIds = Object.keys(world.shopStock) as ItemId[]
  itemIds.forEach((itemId) => {
    const baseline = SHOP_BASE_STOCK[itemId] ?? 0
    const current = world.shopStock[itemId] ?? 0
    if (current === baseline) return
    const next = current < baseline ? current + 1 : current - 1
    if (next === 0 && baseline === 0) {
      delete world.shopStock[itemId]
      return
    }
    world.shopStock[itemId] = next
  })
}

const resolveOpenShop = (
  world: SimWorld,
  events: AddressedEvent[],
  player: SimPlayer,
  action: Extract<PlayerAction, { kind: 'openShop' }>,
) => {
  const npc = world.npcs[action.npcId]
  if (!npc || npc.respawnAtTick !== null || NPCS[npc.defId].shop !== true) {
    abandonAction(events, player)
    return
  }
  if (!cardinallyAdjacent(player.position, npc.position)) {
    approach(events, player, npc.position)
    return
  }
  faceTowards(player, player.position, npc.position)
  faceTowards(npc, npc.position, player.position)
  player.openInterface = 'shop'
  player.action = null
}

const resolveOpenBank = (
  events: AddressedEvent[],
  player: SimPlayer,
  action: Extract<PlayerAction, { kind: 'openBank' }>,
) => {
  const booth = GAME_MAP.objects.find(
    (object) => object.id === action.objectId && object.kind === 'bank_booth',
  )
  if (!booth) {
    abandonAction(events, player)
    return
  }
  if (!cardinallyAdjacent(player.position, booth)) {
    approach(events, player, booth)
    return
  }
  faceTowards(player, player.position, booth)
  player.openInterface = 'bank'
  player.action = null
}

const resolveCook = (
  world: SimWorld,
  events: AddressedEvent[],
  player: SimPlayer,
  action: Extract<PlayerAction, { kind: 'cook' }>,
  rng: SimRng,
) => {
  const station = GAME_MAP.objects.find(
    (object) =>
      object.id === action.objectId && (object.kind === 'range' || object.kind === 'campfire'),
  )
  if (!station) {
    abandonAction(events, player)
    return
  }
  if (!cardinallyAdjacent(player.position, station)) {
    approach(events, player, station)
    return
  }
  faceTowards(player, player.position, station)
  const rawSlot = player.inventory.findIndex(
    (stack) => stack !== null && cookableFor(stack.itemId) !== undefined,
  )
  if (rawSlot === -1) {
    abandonAction(
      events,
      player,
      action.readyAtTick === null ? 'You have nothing to cook.' : undefined,
    )
    return
  }
  if (action.readyAtTick === null || world.tick < action.readyAtTick) {
    if (action.readyAtTick === null) {
      player.action = { ...action, readyAtTick: world.tick + COOK_INTERVAL_TICKS }
    }
    return
  }
  const cookable = cookableFor(player.inventory[rawSlot]!.itemId)!
  removeOneFromSlot(player, rawSlot)
  const burned = rng.skill() < burnChance(levelForXp(player.skills.cooking), cookable)
  addToInventory(player, { itemId: burned ? cookable.burnt : cookable.cooked, quantity: 1 })
  sendMessage(events, player.id, burned ? cookable.burnMessage : cookable.successMessage)
  if (!burned) awardXp(events, player, 'cooking', cookable.xp)
  player.action = { ...action, readyAtTick: world.tick + COOK_INTERVAL_TICKS }
}

const resolveChop = (
  world: SimWorld,
  events: AddressedEvent[],
  player: SimPlayer,
  action: Extract<PlayerAction, { kind: 'chop' }>,
  rng: SimRng,
) => {
  const tree = GAME_MAP.objects.find((object) => object.id === action.objectId)
  if (!tree) {
    abandonAction(events, player)
    return
  }
  if (!cardinallyAdjacent(player.position, tree)) {
    approach(events, player, tree)
    return
  }
  faceTowards(player, player.position, tree)
  if (world.depletedTrees[tree.id] !== undefined) {
    abandonAction(events, player, 'There are no logs left in this tree.')
    return
  }
  if (!hasAxe(player)) {
    abandonAction(events, player, 'You need an axe to chop down this tree.')
    return
  }
  if (rng.skill() >= chopSuccessChance(levelForXp(player.skills.woodcutting))) return
  if (!addToInventory(player, { itemId: 'logs', quantity: 1 })) {
    abandonAction(events, player, NO_SPACE_MESSAGE)
    return
  }
  sendMessage(events, player.id, 'You get some logs.')
  awardXp(events, player, 'woodcutting', WOODCUTTING_XP_PER_LOG)
  world.depletedTrees[tree.id] = world.tick + TREE_RESPAWN_TICKS
  abandonAction(events, player)
}

const playerTurn = (world: SimWorld, events: AddressedEvent[], player: SimPlayer, rng: SimRng) => {
  player.attackCooldown = Math.max(0, player.attackCooldown - 1)
  const energyBefore = player.runEnergy
  takeTurn(world, events, player, rng)
  const ranThisTick = player.runEnergy < energyBefore
  if (!ranThisTick) player.runEnergy = Math.min(MAX_RUN_ENERGY, player.runEnergy + 1)
}

const takeTurn = (world: SimWorld, events: AddressedEvent[], player: SimPlayer, rng: SimRng) => {
  const action = player.action
  if (!action) {
    stepPlayer(player)
    return
  }
  switch (action.kind) {
    case 'take':
      resolveTake(world, events, player, action)
      return
    case 'talk':
      resolveTalk(world, events, player, action)
      return
    case 'attack':
      resolveAttack(world, events, player, action, rng)
      return
    case 'chop':
      resolveChop(world, events, player, action, rng)
      return
    case 'fish':
      resolveFish(events, player, action, rng)
      return
    case 'cook':
      resolveCook(world, events, player, action, rng)
      return
    case 'openBank':
      resolveOpenBank(events, player, action)
      return
    case 'openShop':
      resolveOpenShop(world, events, player, action)
      return
  }
}

const processRespawns = (world: SimWorld) => {
  Object.entries(world.itemRespawns).forEach(([indexKey, dueTick]) => {
    if (world.tick < dueTick) return
    const spawnIndex = Number(indexKey)
    const spawn = GAME_MAP.itemSpawns[spawnIndex]
    if (spawn) {
      addGroundItem(world, {
        x: spawn.x,
        z: spawn.z,
        itemId: spawn.itemId,
        quantity: spawn.quantity,
        spawnIndex,
      })
    }
    delete world.itemRespawns[spawnIndex]
  })
  Object.values(world.npcs).forEach((npc) => {
    if (npc.respawnAtTick === null || world.tick < npc.respawnAtTick) return
    npc.respawnAtTick = null
    npc.hp = NPCS[npc.defId].combat?.hitpoints ?? 1
    npc.position = npc.home
    npc.targetPlayerId = null
    npc.attackCooldown = 0
  })
  Object.entries(world.depletedTrees).forEach(([treeId, dueTick]) => {
    if (world.tick >= dueTick) delete world.depletedTrees[treeId]
  })
  world.groundItems = world.groundItems.filter(
    (item) => item.despawnAtTick === undefined || world.tick < item.despawnAtTick,
  )
}

const expireOverheads = (world: SimWorld) => {
  Object.values(world.players).forEach((player) => {
    if (player.overhead && world.tick >= player.overhead.expiresTick) {
      player.overhead = null
    }
  })
}

export const runTick = (
  previous: SimWorld,
  intents: readonly SimIntent[],
  rng: SimRng = defaultRng,
): TickResult => {
  const world = structuredClone(previous) as SimWorld
  const events: AddressedEvent[] = []
  world.tick += 1
  intents.forEach((intent) => applyIntent(world, events, intent))
  Object.values(world.npcs).forEach((npc) => npcTurn(world, events, npc, rng))
  Object.values(world.players).forEach((player) => playerTurn(world, events, player, rng))
  processRespawns(world)
  regenerateShopStock(world)
  expireOverheads(world)
  return { world, events }
}
