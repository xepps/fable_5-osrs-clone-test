import { describe, expect, it } from 'vitest'
import { inventoryMenuOptions, menuOptionsFor } from './actions'

describe('right-click menu for things in the world', () => {
  it('puts the primary action first, then walk here, then examine, then cancel', () => {
    const options = menuOptionsFor([{ kind: 'groundItem', x: 34, z: 30, itemId: 'bronze_sword' }], {
      x: 34,
      z: 30,
    })
    expect(options.map((option) => option.label)).toEqual([
      'Take',
      'Walk here',
      'Examine',
      'Cancel',
    ])
    expect(options[0]).toMatchObject({
      targetName: 'Bronze sword',
      action: { type: 'send', message: { type: 'takeItem', x: 34, z: 30, itemId: 'bronze_sword' } },
    })
  })

  it('offers Attack for attackable npcs and Talk-to for friendly ones', () => {
    const goblin = menuOptionsFor(
      [{ kind: 'npc', id: 'npc_goblin_0', defId: 'goblin', name: 'Goblin', attackable: true }],
      { x: 12, z: 48 },
    )
    expect(goblin[0]).toMatchObject({
      label: 'Attack',
      action: { type: 'send', message: { type: 'attackNpc', npcId: 'npc_goblin_0' } },
    })
    const guide = menuOptionsFor(
      [
        {
          kind: 'npc',
          id: 'npc_guide',
          defId: 'guide',
          name: 'Lumbridge Guide',
          attackable: false,
        },
      ],
      null,
    )
    expect(guide[0]).toMatchObject({
      label: 'Talk-to',
      action: { type: 'send', message: { type: 'talkToNpc', npcId: 'npc_guide' } },
    })
  })

  it('offers Chop down for trees', () => {
    const options = menuOptionsFor(
      [{ kind: 'tree', objectId: 'tree_0', name: 'Tree', examine: 'A leafy tree.' }],
      { x: 20, z: 21 },
    )
    expect(options[0]).toMatchObject({
      label: 'Chop down',
      action: { type: 'send', message: { type: 'chopTree', objectId: 'tree_0' } },
    })
  })

  it('offers Net for fishing spots and Cook for ranges and campfires', () => {
    const spot = menuOptionsFor(
      [
        {
          kind: 'object',
          objectId: 'fishing_spot_0',
          objectKind: 'fishing_spot',
          name: 'Fishing spot',
          examine: 'Fish are swimming here.',
        },
      ],
      null,
    )
    expect(spot[0]).toMatchObject({
      label: 'Net',
      action: { type: 'send', message: { type: 'fish', objectId: 'fishing_spot_0' } },
    })
    const range = menuOptionsFor(
      [
        {
          kind: 'object',
          objectId: 'range_0',
          objectKind: 'range',
          name: 'Cooking range',
          examine: 'A hot cooking range.',
        },
      ],
      null,
    )
    expect(range[0]).toMatchObject({
      label: 'Cook',
      action: { type: 'send', message: { type: 'cook', objectId: 'range_0' } },
    })
  })

  it('offers Trade first for the shopkeeper', () => {
    const options = menuOptionsFor(
      [
        {
          kind: 'npc',
          id: 'npc_shopkeeper',
          defId: 'shopkeeper',
          name: 'Shop keeper',
          attackable: false,
        },
      ],
      null,
    )
    expect(options[0]).toMatchObject({
      label: 'Trade',
      action: { type: 'send', message: { type: 'openShop', npcId: 'npc_shopkeeper' } },
    })
    expect(options[1]).toMatchObject({ label: 'Talk-to' })
  })

  it('offers Bank at a bank booth', () => {
    const options = menuOptionsFor(
      [
        {
          kind: 'object',
          objectId: 'bank_booth_0',
          objectKind: 'bank_booth',
          name: 'Bank booth',
          examine: 'A sturdy bank booth.',
        },
      ],
      null,
    )
    expect(options[0]).toMatchObject({
      label: 'Bank',
      action: { type: 'send', message: { type: 'openBank', objectId: 'bank_booth_0' } },
    })
  })

  it('only offers Walk here and Examine for other players', () => {
    const options = menuOptionsFor([{ kind: 'player', id: 'p2', name: 'Alice' }], { x: 5, z: 5 })
    expect(options.map((option) => option.label)).toEqual(['Walk here', 'Examine', 'Cancel'])
  })

  it('stacks several targets under the cursor into one menu', () => {
    const options = menuOptionsFor(
      [
        { kind: 'groundItem', x: 12, z: 48, itemId: 'bones' },
        { kind: 'npc', id: 'npc_goblin_0', defId: 'goblin', name: 'Goblin', attackable: true },
      ],
      { x: 12, z: 48 },
    )
    expect(options.map((option) => option.label)).toEqual([
      'Take',
      'Attack',
      'Walk here',
      'Examine',
      'Examine',
      'Cancel',
    ])
  })

  it('falls back to just Walk here on empty ground', () => {
    expect(menuOptionsFor([], { x: 3, z: 3 }).map((option) => option.label)).toEqual([
      'Walk here',
      'Cancel',
    ])
  })
})

describe('right-click menu for inventory items', () => {
  it('offers Wield first for weapons', () => {
    const options = inventoryMenuOptions({ itemId: 'bronze_sword', quantity: 1 }, 0)
    expect(options.map((option) => option.label)).toEqual([
      'Wield',
      'Use',
      'Drop',
      'Examine',
      'Cancel',
    ])
    expect(options[0]?.action).toEqual({ type: 'send', message: { type: 'equipItem', slot: 0 } })
  })

  it('offers Wear first for helmets', () => {
    const options = inventoryMenuOptions({ itemId: 'bronze_med_helm', quantity: 1 }, 3)
    expect(options[0]).toMatchObject({
      label: 'Wear',
      action: { type: 'send', message: { type: 'equipItem', slot: 3 } },
    })
  })

  it('offers Use first for items that cannot be equipped', () => {
    const options = inventoryMenuOptions({ itemId: 'logs', quantity: 1 }, 5)
    expect(options.map((option) => option.label)).toEqual(['Use', 'Drop', 'Examine', 'Cancel'])
    expect(options[1]?.action).toEqual({ type: 'send', message: { type: 'dropItem', slot: 5 } })
  })

  it('offers Eat first for food', () => {
    const options = inventoryMenuOptions({ itemId: 'shrimps', quantity: 1 }, 2)
    expect(options[0]).toMatchObject({
      label: 'Eat',
      action: { type: 'send', message: { type: 'eatItem', slot: 2 } },
    })
  })
})
