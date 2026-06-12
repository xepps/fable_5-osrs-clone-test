export const ITEM_IDS = [
  'coins',
  'bronze_sword',
  'bronze_med_helm',
  'bronze_axe',
  'logs',
  'bones',
  'small_fishing_net',
  'raw_shrimps',
  'shrimps',
  'raw_beef',
  'cooked_meat',
  'burnt_fish',
] as const

export type ItemId = (typeof ITEM_IDS)[number]

export type EquipSlot = 'head' | 'weapon'

export type ItemDef = Readonly<{
  id: ItemId
  name: string
  examine: string
  value: number
  stackable: boolean
  equipSlot?: EquipSlot
  attackBonus?: number
  strengthBonus?: number
  defenceBonus?: number
  isAxe?: boolean
  heals?: number
}>

export const ITEMS: Readonly<Record<ItemId, ItemDef>> = {
  coins: {
    id: 'coins',
    name: 'Coins',
    examine: 'Lovely money!',
    value: 1,
    stackable: true,
  },
  bronze_sword: {
    id: 'bronze_sword',
    name: 'Bronze sword',
    examine: 'A razor sharp sword.',
    value: 26,
    stackable: false,
    equipSlot: 'weapon',
    attackBonus: 7,
    strengthBonus: 6,
  },
  bronze_med_helm: {
    id: 'bronze_med_helm',
    name: 'Bronze med helm',
    examine: 'A medium sized helmet.',
    value: 24,
    stackable: false,
    equipSlot: 'head',
    defenceBonus: 4,
  },
  bronze_axe: {
    id: 'bronze_axe',
    name: 'Bronze axe',
    examine: "A woodcutter's axe.",
    value: 16,
    stackable: false,
    equipSlot: 'weapon',
    attackBonus: 4,
    strengthBonus: 3,
    isAxe: true,
  },
  logs: {
    id: 'logs',
    name: 'Logs',
    examine: 'A number of wooden logs.',
    value: 4,
    stackable: false,
  },
  bones: {
    id: 'bones',
    name: 'Bones',
    examine: 'Mmm, bones.',
    value: 1,
    stackable: false,
  },
  small_fishing_net: {
    id: 'small_fishing_net',
    name: 'Small fishing net',
    examine: 'Useful for catching small fish.',
    value: 5,
    stackable: false,
  },
  raw_shrimps: {
    id: 'raw_shrimps',
    name: 'Raw shrimps',
    examine: 'I should try cooking these.',
    value: 2,
    stackable: false,
  },
  shrimps: {
    id: 'shrimps',
    name: 'Shrimps',
    examine: 'Some nicely cooked shrimps.',
    value: 5,
    stackable: false,
    heals: 3,
  },
  raw_beef: {
    id: 'raw_beef',
    name: 'Raw beef',
    examine: 'I should try cooking this.',
    value: 2,
    stackable: false,
  },
  cooked_meat: {
    id: 'cooked_meat',
    name: 'Cooked meat',
    examine: 'A piece of nicely roasted meat.',
    value: 4,
    stackable: false,
    heals: 3,
  },
  burnt_fish: {
    id: 'burnt_fish',
    name: 'Burnt fish',
    examine: 'Oops. Maybe the seagulls will want it.',
    value: 1,
    stackable: false,
  },
}

export type ItemStack = Readonly<{ itemId: ItemId; quantity: number }>
