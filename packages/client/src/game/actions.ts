import { ITEMS, NPCS, type ClientMessage, type ItemId, type ItemStack } from '@osrs/shared'

export type GameAction =
  | Readonly<{ type: 'send'; message: ClientMessage }>
  | Readonly<{ type: 'examine'; text: string }>
  | Readonly<{ type: 'systemMessage'; text: string }>
  | Readonly<{ type: 'cancel' }>

export type MenuOption = Readonly<{
  label: string
  targetName?: string
  action: GameAction
}>

export type PickTarget =
  | Readonly<{ kind: 'groundItem'; x: number; z: number; itemId: ItemId }>
  | Readonly<{
      kind: 'npc'
      id: string
      defId: 'guide' | 'goblin'
      name: string
      attackable: boolean
    }>
  | Readonly<{ kind: 'tree'; objectId: string; name: string; examine: string }>
  | Readonly<{ kind: 'player'; id: string; name: string }>

const targetOptions = (target: PickTarget): MenuOption[] => {
  switch (target.kind) {
    case 'groundItem': {
      const def = ITEMS[target.itemId]
      return [
        {
          label: 'Take',
          targetName: def.name,
          action: {
            type: 'send',
            message: { type: 'takeItem', x: target.x, z: target.z, itemId: target.itemId },
          },
        },
      ]
    }
    case 'npc':
      return target.attackable
        ? [
            {
              label: 'Attack',
              targetName: target.name,
              action: { type: 'send', message: { type: 'attackNpc', npcId: target.id } },
            },
          ]
        : [
            {
              label: 'Talk-to',
              targetName: target.name,
              action: { type: 'send', message: { type: 'talkToNpc', npcId: target.id } },
            },
          ]
    case 'tree':
      return [
        {
          label: 'Chop down',
          targetName: target.name,
          action: { type: 'send', message: { type: 'chopTree', objectId: target.objectId } },
        },
      ]
    case 'player':
      return []
  }
}

const examineOption = (target: PickTarget): MenuOption => {
  switch (target.kind) {
    case 'groundItem': {
      const def = ITEMS[target.itemId]
      return {
        label: 'Examine',
        targetName: def.name,
        action: { type: 'examine', text: def.examine },
      }
    }
    case 'npc':
      return {
        label: 'Examine',
        targetName: target.name,
        action: { type: 'examine', text: NPCS[target.defId].examine },
      }
    case 'tree':
      return {
        label: 'Examine',
        targetName: target.name,
        action: { type: 'examine', text: target.examine },
      }
    case 'player':
      return {
        label: 'Examine',
        targetName: target.name,
        action: { type: 'examine', text: `${target.name} is exploring the world.` },
      }
  }
}

export const menuOptionsFor = (
  targets: readonly PickTarget[],
  tile: Readonly<{ x: number; z: number }> | null,
): MenuOption[] => {
  const actions = targets.flatMap(targetOptions)
  const walkHere: MenuOption[] = tile
    ? [
        {
          label: 'Walk here',
          action: { type: 'send', message: { type: 'moveTo', x: tile.x, z: tile.z } },
        },
      ]
    : []
  const examines = targets.map(examineOption)
  const cancel: MenuOption = { label: 'Cancel', action: { type: 'cancel' } }
  return [...actions, ...walkHere, ...examines, cancel]
}

export const inventoryMenuOptions = (stack: ItemStack, slot: number): MenuOption[] => {
  const def = ITEMS[stack.itemId]
  const equip: MenuOption[] = def.equipSlot
    ? [
        {
          label: def.equipSlot === 'head' ? 'Wear' : 'Wield',
          targetName: def.name,
          action: { type: 'send', message: { type: 'equipItem', slot } },
        },
      ]
    : []
  return [
    ...equip,
    {
      label: 'Use',
      targetName: def.name,
      action: { type: 'systemMessage', text: 'Nothing interesting happens.' },
    },
    {
      label: 'Drop',
      targetName: def.name,
      action: { type: 'send', message: { type: 'dropItem', slot } },
    },
    { label: 'Examine', targetName: def.name, action: { type: 'examine', text: def.examine } },
    { label: 'Cancel', action: { type: 'cancel' } },
  ]
}
