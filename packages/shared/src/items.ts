export const ITEM_IDS = [
  'coins',
  'bronze_sword',
  'bronze_med_helm',
  'bronze_axe',
  'logs',
  'bones',
] as const

export type ItemId = (typeof ITEM_IDS)[number]

export type EquipSlot = 'head' | 'weapon'

export type ItemDef = Readonly<{
  id: ItemId
  name: string
  examine: string
  stackable: boolean
  equipSlot?: EquipSlot
  attackBonus?: number
  strengthBonus?: number
  defenceBonus?: number
  isAxe?: boolean
}>

export const ITEMS: Readonly<Record<ItemId, ItemDef>> = {
  coins: {
    id: 'coins',
    name: 'Coins',
    examine: 'Lovely money!',
    stackable: true,
  },
  bronze_sword: {
    id: 'bronze_sword',
    name: 'Bronze sword',
    examine: 'A razor sharp sword.',
    stackable: false,
    equipSlot: 'weapon',
    attackBonus: 7,
    strengthBonus: 6,
  },
  bronze_med_helm: {
    id: 'bronze_med_helm',
    name: 'Bronze med helm',
    examine: 'A medium sized helmet.',
    stackable: false,
    equipSlot: 'head',
    defenceBonus: 4,
  },
  bronze_axe: {
    id: 'bronze_axe',
    name: 'Bronze axe',
    examine: "A woodcutter's axe.",
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
    stackable: false,
  },
  bones: {
    id: 'bones',
    name: 'Bones',
    examine: 'Mmm, bones.',
    stackable: false,
  },
}

export type ItemStack = Readonly<{ itemId: ItemId; quantity: number }>
